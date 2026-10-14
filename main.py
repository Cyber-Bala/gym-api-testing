import asyncio
import logging
import os
from datetime import date as dt_date, datetime, timedelta
from typing import Optional

from dotenv import load_dotenv

load_dotenv()

from fastapi import Depends, FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from sqlalchemy import func, desc
from sqlalchemy.orm import Session

from database import get_db, init_db, SessionLocal
from models import AccessLog, AccessStatus, EventType, PaymentStatus, Student
from schemas import (
    AccessLogResponse,
    LogEntryExitRequest,
    PaymentUpdate,
    StatsResponse,
    StudentCreate,
    StudentResponse,
    StudentUpdate,
    FaceRegistrationRequest,
    FaceRegistrationResponse,
)
import zkbio_client

logger = logging.getLogger("gym_access")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Gym Access Control", version="1.0.0")

# ── Static files ─────────────────────────────────────────────────────
STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")


# ── WebSocket manager ────────────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, data: dict):
        for ws in self.active[:]:
            try:
                await ws.send_json(data)
            except Exception:
                if ws in self.active:
                    self.active.remove(ws)


manager = ConnectionManager()


# ══════════════════════════════════════════════════════════════════════
#  ZKBIO TRANSACTION POLLER (background task)
# ══════════════════════════════════════════════════════════════════════

# Track last poll time and seen transaction IDs to avoid duplicates
_last_poll_time: datetime | None = None
_seen_txn_ids: set[str] = set()


async def poll_transactions():
    """Background task: poll ZKBio device for new face-scan transactions."""
    global _last_poll_time

    if not zkbio_client.ZKBIO_ENABLED:
        logger.info("[Poller] ZKBio disabled, transaction poller will not run.")
        return

    logger.info(f"[Poller] Starting transaction poller (interval={zkbio_client.ZKBIO_POLL_INTERVAL}s)")

    # ZKBio stamps events in server-local time, so poll in local time too.
    # Start 1 hour back to catch recent events on startup.
    _last_poll_time = datetime.now() - timedelta(hours=1)

    while True:
        try:
            now = datetime.now()
            # 60 s overlap: the device can upload a scan late. Duplicates are
            # dropped by the txn id check in _process_transaction.
            start_str = (_last_poll_time - timedelta(seconds=60)).strftime("%Y-%m-%d %H:%M:%S")
            end_str = now.strftime("%Y-%m-%d %H:%M:%S")

            transactions = []
            for page_no in range(1, 11):
                batch = zkbio_client.get_transactions(
                    start_date=start_str,
                    end_date=end_str,
                    page_no=page_no,
                    page_size=100,
                )
                transactions.extend(batch)
                if len(batch) < 100:
                    break
            # ZKBio returns newest first; log oldest first so the latest
            # event per student is the last row (used by "currently inside").
            transactions.sort(key=lambda t: str(t.get("eventTime", t.get("event_time", ""))))

            if transactions:
                db = SessionLocal()
                try:
                    for txn in transactions:
                        await _process_transaction(txn, db)
                finally:
                    db.close()

            _last_poll_time = now

        except Exception as e:
            logger.error(f"[Poller] Error: {e}")

        await asyncio.sleep(zkbio_client.ZKBIO_POLL_INTERVAL)


async def _process_transaction(txn: dict, db: Session):
    """Process a single ZKBio transaction into an AccessLog entry."""
    # Deduplicate by transaction ID or composite key
    txn_id = str(txn.get("id", txn.get("sn", "")))
    if not txn_id:
        # Build composite key from pin + timestamp
        txn_id = f"{txn.get('pin', '')}_{txn.get('event_time', txn.get('eventTime', ''))}"

    if txn_id in _seen_txn_ids:
        return
    _seen_txn_ids.add(txn_id)

    # Keep set from growing unbounded (keep last 10000)
    if len(_seen_txn_ids) > 10000:
        _seen_txn_ids.clear()

    # Only successful scans at gym doors (not pool, door-open events, failures)
    if not zkbio_client.is_gym_scan(txn):
        return

    # Find student by PIN (roll_no)
    pin = str(txn.get("pin", ""))
    if not pin:
        return

    # Already logged (e.g. after a restart or an overlapping poll window)
    note = f"ZKBio txn:{txn_id}"
    if db.query(AccessLog.id).filter(AccessLog.notes == note).first():
        return

    student = db.query(Student).filter(Student.roll_no == pin).first()
    if not student:
        # Someone ZKBio let in who is not in our table yet (staff, new person):
        # add them so the entry shows up.
        dept_name = txn.get("deptName") or ""
        name = " ".join(x for x in (txn.get("name"), txn.get("lastName")) if x).strip() or pin
        student = Student(
            roll_no=pin,
            name=name,
            room_no=dept_name,
            category=_category_for(None, dept_name),
            payment_status=PaymentStatus.NOT_REQUIRED,
            access_enabled=True,
        )
        db.add(student)
        db.commit()
        db.refresh(student)
        logger.info(f"[Poller] Added unknown PIN {pin} ({name}, {dept_name}) from a gym scan")

    # Determine entry vs exit
    event_type_str = zkbio_client.determine_event_type(txn)
    event_type = EventType.ENTRY if event_type_str == "entry" else EventType.EXIT

    # Check access status
    today = dt_date.today()
    if (
        student.payment_status == PaymentStatus.PAID
        and student.payment_valid_until
        and student.payment_valid_until < today
    ):
        student.payment_status = PaymentStatus.EXPIRED
        student.access_enabled = False

    # ZKBio only reports a success when the gate opened: that is what happened
    status = AccessStatus.ALLOWED

    # Parse transaction timestamp
    event_time_str = txn.get("event_time", txn.get("eventTime", ""))
    try:
        timestamp = datetime.strptime(event_time_str, "%Y-%m-%d %H:%M:%S")
    except (ValueError, TypeError):
        timestamp = datetime.now()

    # Create access log
    log = AccessLog(
        student_id=student.id,
        event_type=event_type,
        status=status,
        timestamp=timestamp,
        notes=note,
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    # Build response and broadcast
    response = AccessLogResponse(
        id=log.id,
        student_id=student.id,
        roll_no=student.roll_no,
        student_name=student.name,
        event_type=log.event_type,
        status=log.status,
        timestamp=log.timestamp,
        notes=log.notes,
    )
    await manager.broadcast(response.model_dump(mode="json"))
    logger.info(f"[Poller] {student.roll_no} → {event_type_str} ({status.value})")


# ══════════════════════════════════════════════════════════════════════
#  ZKBIO PERSON IMPORT (ZKBio → local students table)
# ══════════════════════════════════════════════════════════════════════

# Departments that hold gym students (see ZKBIO_DEPT_* in .env)
_STUDENT_DEPT_CODES = {
    c.strip()
    for c in (
        os.getenv("ZKBIO_DEPT_DAY_SCHOLAR_BOYS", ""),
        os.getenv("ZKBIO_DEPT_DAY_SCHOLAR_GIRLS", ""),
        os.getenv("ZKBIO_DEPT_HOSTELLER_BOYS", ""),
        os.getenv("ZKBIO_DEPT_HOSTELLER_GIRLS", ""),
    )
    if c.strip()
}
# Category label per ZKBio department code (used for filtering)
_CATEGORY_BY_DEPT = {
    os.getenv("ZKBIO_DEPT_DAY_SCHOLAR_BOYS", "").strip(): "Day Scholar Boys",
    os.getenv("ZKBIO_DEPT_DAY_SCHOLAR_GIRLS", "").strip(): "Day Scholar Girls",
    os.getenv("ZKBIO_DEPT_HOSTELLER_BOYS", "").strip(): "Hosteller Boys",
    os.getenv("ZKBIO_DEPT_HOSTELLER_GIRLS", "").strip(): "Hosteller Girls",
}
_CATEGORY_BY_DEPT.pop("", None)


def _category_for(dept_code, dept_name=None) -> str | None:
    cat = _CATEGORY_BY_DEPT.get(str(dept_code).strip())
    return cat or (dept_name or None)


# Access level per category: each department goes to its own ZKBio level
_LEVEL_BY_CATEGORY = {
    "Day Scholar Boys": os.getenv("ZKBIO_LEVEL_DAY_SCHOLAR_BOYS", "").strip(),
    "Day Scholar Girls": os.getenv("ZKBIO_LEVEL_DAY_SCHOLAR_GIRLS", "").strip(),
    "Hosteller Boys": os.getenv("ZKBIO_LEVEL_HOSTELLER_BOYS", "").strip(),
    "Hosteller Girls": os.getenv("ZKBIO_LEVEL_HOSTELLER_GIRLS", "").strip(),
}


def _level_for(category: str | None) -> str | None:
    """ZKBio level id for a category; None falls back to ZKBIO_LEVEL_IDS (General)."""
    return _LEVEL_BY_CATEGORY.get(category or "") or None


# Hostellers get free gym access: no payment tracked
_HOSTELLER_DEPT_CODES = {
    c.strip()
    for c in (
        os.getenv("ZKBIO_DEPT_HOSTELLER_BOYS", ""),
        os.getenv("ZKBIO_DEPT_HOSTELLER_GIRLS", ""),
    )
    if c.strip()
}
# Access levels that grant gym entry
_GYM_LEVEL_IDS = {
    v.strip()
    for k, v in os.environ.items()
    if k.startswith("ZKBIO_LEVEL_") and v.strip()
}
_IMPORT_INTERVAL = int(os.getenv("ZKBIO_IMPORT_INTERVAL", "600"))
_IMPORT_PAGE_SIZE = 500

# Health of the ZKBio -> students pull, served by GET /api/sync/status
_sync_state: dict = {"last_pull_ok": None, "last_pull_at": None, "last_result": None}


def import_zkbio_persons(db: Session, all_departments: bool = False) -> dict:
    """Pull persons from ZKBio into students. New rows are created; existing
    rows only get name/phone refreshed (payment data is never overwritten)."""
    created = updated = skipped = 0
    page = 1
    while True:
        persons = zkbio_client.get_person_list(page_no=page, page_size=_IMPORT_PAGE_SIZE)
        if persons is None:
            db.commit()
            raise RuntimeError(f"ZKBio person list failed on page {page}")
        if not persons:
            break
        for p in persons:
            pin = str(p.get("pin") or "").strip()
            if not pin:
                continue
            if not all_departments and str(p.get("deptCode")) not in _STUDENT_DEPT_CODES:
                skipped += 1
                continue
            name = " ".join(x for x in (p.get("name"), p.get("lastName")) if x).strip() or pin
            phone = (p.get("mobilePhone") or "").strip()[:15] or None
            is_hosteller = str(p.get("deptCode")) in _HOSTELLER_DEPT_CODES
            student = db.query(Student).filter(Student.roll_no == pin).first()
            if student:
                changed = False
                category = _category_for(p.get("deptCode"), p.get("deptName"))
                if student.category != category:
                    student.category = category
                    changed = True
                if student.name != name or (phone and student.phone != phone):
                    student.name = name
                    student.phone = phone or student.phone
                    changed = True
                # Hostellers never pay: fix rows imported earlier as paid/unpaid
                if is_hosteller and (
                    student.payment_status != PaymentStatus.NOT_REQUIRED
                    or student.access_enabled == bool(p.get("isDisabled"))
                ):
                    student.payment_status = PaymentStatus.NOT_REQUIRED
                    student.payment_valid_from = student.payment_valid_until = None
                    student.access_enabled = not p.get("isDisabled")
                    changed = True
                updated += changed
                continue
            if is_hosteller:
                payment_status = PaymentStatus.NOT_REQUIRED
                has_access = not p.get("isDisabled")
            else:
                level_ids = {x.strip() for x in (p.get("accLevelIds") or "").split(",") if x.strip()}
                has_access = bool(level_ids & _GYM_LEVEL_IDS) and not p.get("isDisabled")
                payment_status = PaymentStatus.PAID if has_access else PaymentStatus.UNPAID
            db.add(Student(
                roll_no=pin,
                name=name,
                room_no=p.get("deptName") or "",
                phone=phone,
                category=_category_for(p.get("deptCode"), p.get("deptName")),
                payment_status=payment_status,
                access_enabled=has_access,
            ))
            created += 1
        db.commit()
        if len(persons) < _IMPORT_PAGE_SIZE:
            break
        page += 1
    return {"created": created, "updated": updated, "skipped_other_departments": skipped}


async def import_persons_loop():
    """Background task: keep students in sync with ZKBio persons."""
    while True:
        try:
            db = SessionLocal()
            try:
                result = await asyncio.to_thread(import_zkbio_persons, db)
            finally:
                db.close()
            _sync_state.update(last_pull_ok=True, last_pull_at=datetime.utcnow().isoformat(), last_result=result)
            logger.info(f"[Import] ZKBio persons → students: {result}")
        except Exception as e:
            _sync_state.update(last_pull_ok=False, last_pull_at=datetime.utcnow().isoformat())
            logger.error(f"[Import] Error: {e}")
        await asyncio.sleep(_IMPORT_INTERVAL)


# ══════════════════════════════════════════════════════════════════════
#  STARTUP
# ══════════════════════════════════════════════════════════════════════

@app.on_event("startup")
async def startup():
    init_db()
    logger.info("[Startup] Gym Access DB initialized.")
    if zkbio_client.ZKBIO_ENABLED:
        logger.info(f"[Startup] ZKBio integration ENABLED → {zkbio_client.ZKBIO_BASE_URL}")
        asyncio.create_task(import_persons_loop())
        asyncio.create_task(poll_transactions())
    else:
        logger.info("[Startup] ZKBio integration DISABLED (manual mode)")


# ── Dashboard ────────────────────────────────────────────────────────
@app.get("/", response_class=HTMLResponse, include_in_schema=False)
def dashboard():
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        with open(index_path, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse("<h1>Dashboard not found</h1>", status_code=404)


# ══════════════════════════════════════════════════════════════════════
#  STUDENTS API
# ══════════════════════════════════════════════════════════════════════

@app.post("/api/zkbio/import-students", tags=["Students"])
def import_students_now(all_departments: bool = Query(False), db: Session = Depends(get_db)):
    """Pull persons from ZKBio into students right now."""
    if not zkbio_client.ZKBIO_ENABLED:
        raise HTTPException(400, "ZKBio integration disabled")
    result = import_zkbio_persons(db, all_departments=all_departments)
    _sync_state.update(last_pull_ok=True, last_pull_at=datetime.utcnow().isoformat(), last_result=result)
    return result


@app.get("/api/sync/status", tags=["Stats"])
def sync_status():
    """Health of the ZKBio bridge, polled by the gym-app backend."""
    return {"zkbio_enabled": zkbio_client.ZKBIO_ENABLED, **_sync_state}


@app.get("/api/categories", tags=["Students"])
def list_categories(db: Session = Depends(get_db)):
    """Distinct student categories with counts, for filter dropdowns."""
    rows = (
        db.query(Student.category, func.count(Student.id))
        .filter(Student.category.isnot(None))
        .group_by(Student.category)
        .order_by(Student.category)
        .all()
    )
    return [{"category": c, "count": n} for c, n in rows]


@app.get("/api/students", response_model=list[StudentResponse], tags=["Students"])
def list_students(
    search: Optional[str] = Query(None),
    payment_status: Optional[PaymentStatus] = Query(None),
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Student)
    if search:
        pattern = f"%{search}%"
        q = q.filter(
            (Student.name.ilike(pattern))
            | (Student.roll_no.ilike(pattern))
            | (Student.room_no.ilike(pattern))
        )
    if payment_status:
        q = q.filter(Student.payment_status == payment_status)
    if category:
        q = q.filter(Student.category == category)
    return q.order_by(Student.name).all()


@app.post("/api/students", response_model=StudentResponse, status_code=201, tags=["Students"])
def create_student(payload: StudentCreate, db: Session = Depends(get_db)):
    existing = db.query(Student).filter(Student.roll_no == payload.roll_no).first()
    if existing:
        raise HTTPException(400, f"Student with roll_no '{payload.roll_no}' already exists")
    student = Student(
        roll_no=payload.roll_no,
        name=payload.name,
        room_no=payload.room_no,
        phone=payload.phone,
        category=_category_for(payload.dept_code),
        payment_status=PaymentStatus.UNPAID,
        access_enabled=False,
    )
    if payload.dept_code and payload.dept_code in _HOSTELLER_DEPT_CODES:
        student.payment_status = PaymentStatus.NOT_REQUIRED
        student.access_enabled = True
    db.add(student)
    db.commit()
    db.refresh(student)

    # ── Sync to ZKBio device ──
    # Hostellers get their hostel level at once; day scholars get none until paid
    level = _level_for(student.category)
    zkbio_client.add_person(
        pin=student.roll_no,
        name=student.name,
        dept_code=payload.dept_code,
        level_ids=(level or "") if student.access_enabled else "",
    )

    return student


@app.get("/api/students/{roll_no}", response_model=StudentResponse, tags=["Students"])
def get_student(roll_no: str, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.roll_no == roll_no).first()
    if not student:
        raise HTTPException(404, "Student not found")
    return student


@app.patch("/api/students/{roll_no}", response_model=StudentResponse, tags=["Students"])
def update_student(roll_no: str, payload: StudentUpdate, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.roll_no == roll_no).first()
    if not student:
        raise HTTPException(404, "Student not found")
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(student, key, value)
    student.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(student)
    return student


@app.get("/api/students/{roll_no}/face-status", tags=["Students"])
def get_face_status(roll_no: str, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.roll_no == roll_no).first()
    if not student:
        raise HTTPException(404, "Student not found")
        
    person_data = zkbio_client.get_person(pin=roll_no)
    if not person_data:
        return {"roll_no": roll_no, "enrolled": False, "reason": "Not found in ZKBio or ZKBio disabled"}
        
    # Check if ZKBio indicates a face is registered.
    # Often represented by "hasPhoto", "vislightPhoto", "hasFace", or template counts > 0.
    # Note: ZKBio CVSecurity API typically returns 'vislightPhoto' or 'biometricTemplates'
    has_face = False
    
    if person_data.get("code") == 0 and "data" in person_data:
        person_details = person_data["data"]
        
        # Check standard fields for face template existence
        has_vislight = bool(person_details.get("vislightPhoto") or person_details.get("vislightPhotoPath"))
        
        # Or check if face templates are listed (Biometric Templates: 9 is vislight face)
        templates = person_details.get("biometricTemplates", [])
        has_face_template = any(t.get("bioType") == 9 for t in templates) if isinstance(templates, list) else False
        
        has_face = has_vislight or has_face_template
    
    return {"roll_no": roll_no, "enrolled": has_face, "zkbio_raw": person_data.get("data") if person_data.get("code") == 0 else None}


@app.delete("/api/students/{roll_no}", status_code=204, tags=["Students"])
def delete_student(roll_no: str, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.roll_no == roll_no).first()
    if not student:
        raise HTTPException(404, "Student not found")

    # ── Remove the person from ZKBio first, then locally ──
    # If ZKBio fails we keep the local row: otherwise the person import
    # would bring the student straight back and the two systems would differ.
    level = _level_for(student.category)
    zkbio_client.delete_level(pin=roll_no, level_ids=level)
    zkbio_client.sync_person(pin=roll_no, level_ids=level)
    result = zkbio_client.delete_person(pin=roll_no)
    if result == "failed":
        raise HTTPException(502, f"Could not delete {roll_no} from ZKBio; nothing was deleted")
    logger.info(f"[ZKBio] Delete {roll_no}: {result}")

    db.delete(student)
    db.commit()


@app.patch("/api/students/{roll_no}/payment", response_model=StudentResponse, tags=["Students"])
def update_payment(roll_no: str, payload: PaymentUpdate, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.roll_no == roll_no).first()
    if not student:
        raise HTTPException(404, "Student not found")

    # Hostellers have no payment: ignore payment updates
    if student.payment_status == PaymentStatus.NOT_REQUIRED:
        return student

    student.payment_status = payload.payment_status
    student.payment_valid_from = payload.payment_valid_from
    student.payment_valid_until = payload.payment_valid_until

    # Auto-toggle access based on payment
    if payload.payment_status == PaymentStatus.PAID:
        today = dt_date.today()
        if payload.payment_valid_until and payload.payment_valid_until < today:
            student.payment_status = PaymentStatus.EXPIRED
            student.access_enabled = False
        else:
            student.access_enabled = True
    else:
        student.access_enabled = False

    student.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(student)

    # ── Sync access level on ZKBio device ──
    level = _level_for(student.category)
    if student.access_enabled:
        zkbio_client.add_level_person(pin=roll_no, level_ids=level)
        zkbio_client.sync_person(pin=roll_no, level_ids=level)
        logger.info(f"[ZKBio] Access ENABLED for {roll_no} on device")
    else:
        zkbio_client.delete_level(pin=roll_no, level_ids=level)
        zkbio_client.sync_person(pin=roll_no, level_ids=level)
        logger.info(f"[ZKBio] Access DISABLED for {roll_no} on device")

    return student


# ══════════════════════════════════════════════════════════════════════
#  ACCESS LOG API (manual logging — still works alongside device poller)
# ══════════════════════════════════════════════════════════════════════

@app.post("/api/access/log", response_model=AccessLogResponse, status_code=201, tags=["Access"])
async def log_access(payload: LogEntryExitRequest, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.roll_no == payload.roll_no).first()
    if not student:
        raise HTTPException(404, "Student not found")

    # Check expiry on-the-fly
    today = dt_date.today()
    if (
        student.payment_status == PaymentStatus.PAID
        and student.payment_valid_until
        and student.payment_valid_until < today
    ):
        student.payment_status = PaymentStatus.EXPIRED
        student.access_enabled = False
        db.commit()

    status = AccessStatus.ALLOWED if student.access_enabled else AccessStatus.DENIED

    log = AccessLog(
        student_id=student.id,
        event_type=payload.event_type,
        status=status,
        timestamp=datetime.utcnow(),
        notes=payload.notes or "manual",
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    response = AccessLogResponse(
        id=log.id,
        student_id=student.id,
        roll_no=student.roll_no,
        student_name=student.name,
        event_type=log.event_type,
        status=log.status,
        timestamp=log.timestamp,
        notes=log.notes,
    )

    await manager.broadcast(response.model_dump(mode="json"))
    return response


@app.get("/api/access/logs", response_model=list[AccessLogResponse], tags=["Access"])
def list_access_logs(
    roll_no: Optional[str] = Query(None),
    event_type: Optional[EventType] = Query(None),
    status: Optional[AccessStatus] = Query(None),
    date: Optional[dt_date] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    q = db.query(AccessLog).join(Student)
    if roll_no:
        q = q.filter(Student.roll_no == roll_no)
    if event_type:
        q = q.filter(AccessLog.event_type == event_type)
    if status:
        q = q.filter(AccessLog.status == status)
    if date:
        q = q.filter(func.date(AccessLog.timestamp) == date)

    logs = q.order_by(desc(AccessLog.timestamp)).limit(limit).all()
    return [
        AccessLogResponse(
            id=log.id,
            student_id=log.student_id,
            roll_no=log.student.roll_no,
            student_name=log.student.name,
            event_type=log.event_type,
            status=log.status,
            timestamp=log.timestamp,
            notes=log.notes,
        )
        for log in logs
    ]


@app.get("/api/access/active", response_model=list[AccessLogResponse], tags=["Access"])
def get_active_students(db: Session = Depends(get_db)):
    """Students whose last event was 'entry' and status was 'allowed'."""
    latest_subq = (
        db.query(
            AccessLog.student_id,
            func.max(AccessLog.id).label("max_id"),
        )
        .group_by(AccessLog.student_id)
        .subquery()
    )

    logs = (
        db.query(AccessLog)
        .join(latest_subq, AccessLog.id == latest_subq.c.max_id)
        .join(Student)
        .filter(
            AccessLog.event_type == EventType.ENTRY,
            AccessLog.status == AccessStatus.ALLOWED,
        )
        .all()
    )

    return [
        AccessLogResponse(
            id=log.id,
            student_id=log.student_id,
            roll_no=log.student.roll_no,
            student_name=log.student.name,
            event_type=log.event_type,
            status=log.status,
            timestamp=log.timestamp,
            notes=log.notes,
        )
        for log in logs
    ]


# ══════════════════════════════════════════════════════════════════════
#  FACE REGISTRATION (admin webcam / Face Upload -> ZKBio)
# ══════════════════════════════════════════════════════════════════════
@app.post("/api/students/{roll_no}/register-face", response_model=FaceRegistrationResponse, tags=["Students"])
def register_student_face(roll_no: str, payload: FaceRegistrationRequest, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.roll_no == roll_no).first()
    if not student:
        student = Student(
            roll_no=roll_no,
            name=roll_no,
            room_no="N/A",
            phone="",
            payment_status=PaymentStatus.PAID,
            access_enabled=True,
        )
        db.add(student)
        db.commit()
        db.refresh(student)

    zkbio_client.upload_person_photo(pin=roll_no, photo_base64=payload.photo_base64)
    zkbio_client.sync_person(pin=roll_no, level_ids=_level_for(student.category))

    return FaceRegistrationResponse(
        success=True,
        message=f"Face registered successfully for student {roll_no} and synced to device gate.",
        roll_no=roll_no,
        zkbio_synced=bool(zkbio_client.ZKBIO_ENABLED),
    )


# ══════════════════════════════════════════════════════════════════════
#  STATS
# ══════════════════════════════════════════════════════════════════════

@app.get("/api/stats", response_model=StatsResponse, tags=["Stats"])
def get_stats(db: Session = Depends(get_db)):
    total = db.query(func.count(Student.id)).scalar() or 0
    paid = db.query(func.count(Student.id)).filter(Student.payment_status == PaymentStatus.PAID).scalar() or 0
    unpaid = db.query(func.count(Student.id)).filter(Student.payment_status == PaymentStatus.UNPAID).scalar() or 0
    expired = db.query(func.count(Student.id)).filter(Student.payment_status == PaymentStatus.EXPIRED).scalar() or 0
    not_required = db.query(func.count(Student.id)).filter(Student.payment_status == PaymentStatus.NOT_REQUIRED).scalar() or 0

    latest_subq = (
        db.query(
            AccessLog.student_id,
            func.max(AccessLog.id).label("max_id"),
        )
        .group_by(AccessLog.student_id)
        .subquery()
    )
    inside = (
        db.query(func.count())
        .select_from(AccessLog)
        .join(latest_subq, AccessLog.id == latest_subq.c.max_id)
        .filter(
            AccessLog.event_type == EventType.ENTRY,
            AccessLog.status == AccessStatus.ALLOWED,
        )
        .scalar()
    ) or 0

    return StatsResponse(
        total_students=total,
        paid_count=paid,
        unpaid_count=unpaid,
        expired_count=expired,
        not_required_count=not_required,
        currently_inside=inside,
    )


# ══════════════════════════════════════════════════════════════════════
#  WEBSOCKET
# ══════════════════════════════════════════════════════════════════════

@app.websocket("/api/access/live")
async def websocket_live(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(ws)


# ══════════════════════════════════════════════════════════════════════
#  RUN
# ══════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=44444, reload=True)
