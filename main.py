import asyncio
import logging
import os
from datetime import date as dt_date, datetime, timedelta
from typing import Optional

from dotenv import load_dotenv

load_dotenv()

import base64
import binascii

from fastapi import Depends, FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from sqlalchemy import func, desc
from sqlalchemy.orm import Session

from database import get_db, init_db, SessionLocal
from models import AccessLog, AccessStatus, EventType, PaymentStatus, Student
from schemas import (
    AccessCheckResponse,
    AccessLogResponse,
    FaceRegisterRequest,
    FaceRegisterResponse,
    LogEntryExitRequest,
    PaymentUpdate,
    StatsResponse,
    StudentCreate,
    StudentResponse,
    StudentUpdate,
    SyncPullResponse,
    SyncStatusResponse,
)
import zkbio_client

logger = logging.getLogger("gym_access")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Gym Access Control", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

    # Start polling from 1 hour ago to catch recent events on startup
    _last_poll_time = datetime.utcnow() - timedelta(hours=1)

    while True:
        try:
            now = datetime.utcnow()
            start_str = _last_poll_time.strftime("%Y-%m-%d %H:%M:%S")
            end_str = now.strftime("%Y-%m-%d %H:%M:%S")

            transactions = zkbio_client.get_transactions(
                start_date=start_str,
                end_date=end_str,
                page_no=1,
                page_size=100,
            )

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

    # Find student by PIN (roll_no)
    pin = str(txn.get("pin", ""))
    if not pin:
        return

    student = db.query(Student).filter(Student.roll_no == pin).first()
    if not student:
        logger.warning(f"[Poller] Transaction for unknown PIN: {pin}")
        return

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

    status = AccessStatus.ALLOWED if student.access_enabled else AccessStatus.DENIED

    # Parse transaction timestamp
    event_time_str = txn.get("event_time", txn.get("eventTime", ""))
    try:
        timestamp = datetime.strptime(event_time_str, "%Y-%m-%d %H:%M:%S")
    except (ValueError, TypeError):
        timestamp = datetime.utcnow()

    # Create access log
    log = AccessLog(
        student_id=student.id,
        event_type=event_type,
        status=status,
        timestamp=timestamp,
        notes=f"ZKBio txn:{txn_id}",
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
#  PORTAL → LOCAL SYNC (ZKBio admin panel is the hardware source of truth)
# ══════════════════════════════════════════════════════════════════════
# Without this, persons added/deleted in the CVSecurity admin panel never
# appear/disappear in the api_app SQLite DB (and therefore never reach gym-app).

_SYNC_STATE: dict = {
    "last_pull_at": None,
    "last_pull_ok": None,
    "last_pull_message": None,
    "last_added": 0,
    "last_updated": 0,
    "last_removed": 0,
    "portal_count": 0,
}


def _portal_pin(item: dict) -> str:
    for key in ("pin", "personPin", "pinNumber", "empPin"):
        val = item.get(key)
        if val:
            return str(val).strip()
    return ""


def _portal_gender(item: dict) -> str | None:
    for key in ("gender", "sex"):
        val = item.get(key)
        if val:
            s = str(val).strip().lower()
            if s.startswith("f"):
                return "female"
            if s.startswith("m"):
                return "male"
            return s
    return None


def _portal_name(item: dict) -> str:
    for key in ("name", "personName", "empName"):
        val = item.get(key)
        if val:
            return str(val).strip()
    return ""


def _sweep_expired(db: Session) -> int:
    """Mark overdue PAID rows as EXPIRED (+revoke device level). Returns count."""
    today = dt_date.today()
    overdue = (
        db.query(Student)
        .filter(
            Student.payment_status == PaymentStatus.PAID,
            Student.payment_valid_until.isnot(None),
            Student.payment_valid_until < today,
        )
        .all()
    )
    for s in overdue:
        s.payment_status = PaymentStatus.EXPIRED
        s.access_enabled = False
        s.updated_at = datetime.utcnow()
    if overdue:
        db.commit()
        for s in overdue:
            try:
                zkbio_client.delete_level(pin=s.roll_no)
                zkbio_client.sync_person(pin=s.roll_no)
            except Exception:
                pass
            logger.info(f"[Expiry] {s.roll_no} marked EXPIRED (valid_until={s.payment_valid_until})")
    return len(overdue)


def _paywall_message(student: Student) -> str:
    until = student.payment_valid_until.isoformat() if student.payment_valid_until else "—"
    if student.payment_status == PaymentStatus.PAID and student.access_enabled:
        return f"Access allowed for {student.name} ({student.roll_no}). Valid until {until}."
    if student.payment_status == PaymentStatus.EXPIRED:
        return (
            f"Your gym access expired on {until}. Please pay to renew your pass — "
            f"contact the gym admin or complete payment in the gym app."
        )
    # unpaid (covers day_scholar without a pass + any unknown state)
    return (
        "You should pay to use the gym. Your pass is not active — "
        "complete payment in the gym app, then re-verify at the gate."
    )


def pull_portal_sync(db: Session) -> dict:
    """One portal → SQLite reconcile pass.

    - Portal persons missing locally → created (UNPAID, access off by default
      so the gate denies with a pay-wall message until gym-app confirms payment).
    - Name/dept changed on portal → updated locally.
    - Local rows missing on portal → deleted locally (admin-panel delete
      propagates to api_app; gym-app picks it up via /api/students diff).
      Deletes require BOTH a complete multi-page portal fetch AND a per-PIN
      portal lookup confirming the person is gone. A stale list entry alone
      can never wipe a local row, and a partial/failed fetch never deletes.
    Safe no-op when ZKBio is disabled/unreachable (never deletes then).
    """
    if not zkbio_client.ZKBIO_ENABLED:
        msg = "ZKBIO_ENABLED=false — bridge is DISABLED. Set ZKBIO_BASE_URL + ZKBIO_ACCESS_TOKEN and restart api_app; until then no portal data can be seen."
        _SYNC_STATE.update({
            "last_pull_at": datetime.utcnow(), "last_pull_ok": False,
            "last_pull_message": msg, "portal_count": 0,
        })
        return {"ok": False, "message": msg, "added": [], "updated": [], "removed": []}

    fetched = zkbio_client.fetch_all_portal_persons()
    portal_items = fetched["items"]
    if not fetched["complete"]:
        msg = (
            "Portal fetch INCOMPLETE — keeping local data untouched "
            f"(pages={fetched['pages']}, error={fetched['error']}). Check IP/token."
        )
        _SYNC_STATE.update({
            "last_pull_at": datetime.utcnow(), "last_pull_ok": False,
            "last_pull_message": msg, "portal_count": 0,
        })
        return {"ok": False, "message": msg, "added": [], "updated": [], "removed": []}

    portal_by_pin: dict[str, dict] = {}
    for item in portal_items:
        if not isinstance(item, dict):
            continue
        pin = _portal_pin(item)
        if pin and pin not in portal_by_pin:
            portal_by_pin[pin] = item

    local_students = db.query(Student).all()
    local_by_pin = {s.roll_no: s for s in local_students}

    added: list[str] = []
    updated: list[str] = []
    removed: list[str] = []
    kept_stale: list[str] = []

    for pin, item in portal_by_pin.items():
        name = _portal_name(item) or pin
        dept = str(item.get("deptCode") or item.get("dept_code") or "") or None
        portal_gender = _portal_gender(item)
        existing = local_by_pin.get(pin)
        if not existing:
            # New portal person → resolve 4-way dept locally when portal
            # didn't carry one, so api_app + gym-app agree on the bucket.
            if not dept:
                try:
                    dept = zkbio_client.resolve_dept_code(None, portal_gender)
                except Exception:
                    dept = None
            db.add(Student(
                roll_no=pin, name=name, room_no="N/A",
                payment_status=PaymentStatus.UNPAID, access_enabled=False,
                dept_code=dept, gender=portal_gender,
            ))
            added.append(pin)
        else:
            changed = False
            if existing.name != name:
                existing.name = name
                changed = True
            if dept and existing.dept_code != dept:
                existing.dept_code = dept
                changed = True
            if portal_gender and existing.gender != portal_gender:
                existing.gender = portal_gender
                changed = True
            if changed:
                existing.updated_at = datetime.utcnow()
                updated.append(pin)

    # Deletes: list-missing AND per-PIN lookup confirms gone.
    # If the lookup still finds the person (stale list), keep the local row.
    for pin, row in local_by_pin.items():
        if pin not in portal_by_pin:
            present = zkbio_client.check_person_present(pin)
            if present is True:
                kept_stale.append(pin)
                logger.warning(
                    f"[Sync] {pin} missing from portal list but per-PIN lookup "
                    f"still finds it — keeping local row (stale list page)."
                )
                continue
            db.delete(row)
            removed.append(pin)

    db.commit()
    _sweep_expired(db)

    detail = f"portal_total={fetched['total']}"
    _SYNC_STATE.update({
        "last_pull_at": datetime.utcnow(), "last_pull_ok": True,
        "last_pull_message": (
            f"Portal sync OK: +{len(added)} ~{len(updated)} -{len(removed)} "
            f"({detail}, kept_stale={len(kept_stale)})"
        ),
        "last_added": len(added), "last_updated": len(updated),
        "last_removed": len(removed), "portal_count": len(portal_by_pin),
    })
    logger.info(f"[Sync] portal→local: +{len(added)} ~{len(updated)} -{len(removed)} kept_stale={len(kept_stale)}")
    return {"ok": True, "message": _SYNC_STATE["last_pull_message"],
            "added": added, "updated": updated, "removed": removed,
            "kept_stale": kept_stale}


async def poll_person_sync():
    """Background task: reconcile portal persons into SQLite every SYNC_INTERVAL."""
    if not zkbio_client.ZKBIO_ENABLED:
        logger.info("[Sync] ZKBio disabled, portal sync poller will not run.")
        return
    logger.info(f"[Sync] Starting portal sync poller (interval={zkbio_client.ZKBIO_SYNC_INTERVAL}s)")
    await asyncio.sleep(10)  # let the app finish startup first
    while True:
        try:
            db = SessionLocal()
            try:
                pull_portal_sync(db)
            finally:
                db.close()
        except Exception as e:
            logger.error(f"[Sync] poller error: {e}")
        await asyncio.sleep(zkbio_client.ZKBIO_SYNC_INTERVAL)


# ══════════════════════════════════════════════════════════════════════
#  STARTUP
# ══════════════════════════════════════════════════════════════════════

@app.on_event("startup")
async def startup():
    init_db()
    logger.info("[Startup] Gym Access DB initialized.")
    if zkbio_client.ZKBIO_ENABLED:
        logger.info(f"[Startup] ZKBio integration ENABLED → {zkbio_client.ZKBIO_BASE_URL}")
        asyncio.create_task(poll_transactions())
        asyncio.create_task(poll_person_sync())
    else:
        logger.info("[Startup] ZKBio integration DISABLED (manual mode)")


# ── Dashboard ────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
@app.get("/api/health", tags=["Health"])
def health():
    return {
        "status": "ok",
        "service": "gym_api_app",
        "build": "portal-sync-v2",
        "zkbio_enabled": zkbio_client.ZKBIO_ENABLED,
        "zkbio_base_url": zkbio_client.ZKBIO_BASE_URL if zkbio_client.ZKBIO_ENABLED else None,
        "portal_sync_last_ok": _SYNC_STATE["last_pull_ok"],
        "portal_sync_last_message": _SYNC_STATE["last_pull_message"],
    }


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

@app.get("/api/students", response_model=list[StudentResponse], tags=["Students"])
def list_students(
    search: Optional[str] = Query(None),
    payment_status: Optional[PaymentStatus] = Query(None),
    residency: Optional[str] = Query(None, description="hosteller | day_scholar"),
    gender: Optional[str] = Query(None, description="male | female"),
    dept_code: Optional[str] = Query(None),
    category: Optional[str] = Query(None, description="day_scholar_boys | day_scholar_girls | hosteller_boys | hosteller_girls"),
    db: Session = Depends(get_db),
):
    _sweep_expired(db)
    # Combined 4-way bucket (same keys as gym-app) wins over individual fields.
    if category:
        if category == "day_scholar_boys":
            residency, gender = "day_scholar", "male"
        elif category == "day_scholar_girls":
            residency, gender = "day_scholar", "female"
        elif category == "hosteller_boys":
            residency, gender = "hosteller", "male"
        elif category == "hosteller_girls":
            residency, gender = "hosteller", "female"
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
    if residency:
        q = q.filter(Student.residency == residency)
    if gender:
        q = q.filter(Student.gender == gender)
    if dept_code:
        q = q.filter(Student.dept_code == dept_code)
    return q.order_by(Student.name).all()


@app.post("/api/students", response_model=StudentResponse, status_code=201, tags=["Students"])
def create_student(payload: StudentCreate, db: Session = Depends(get_db)):
    existing = db.query(Student).filter(Student.roll_no == payload.roll_no).first()
    if existing:
        raise HTTPException(400, f"Student with roll_no '{payload.roll_no}' already exists")
    # Resolve 4-way dept when the caller didn't send an explicit code:
    # Day Scholar Boys / Day Scholar Girls / Hosteller Boys / Hosteller Girls.
    dept_code = payload.dept_code or zkbio_client.resolve_dept_code(payload.residency, payload.gender)
    student = Student(
        roll_no=payload.roll_no,
        name=payload.name,
        room_no=payload.room_no,
        phone=payload.phone,
        payment_status=PaymentStatus.UNPAID,
        access_enabled=False,
        residency=(payload.residency or None),
        gender=(payload.gender or None),
        dept_code=dept_code,
    )
    db.add(student)
    db.commit()
    db.refresh(student)

    # ── Sync to ZKBio device ──
    # Register person on device in the CORRECT dept (no more General pile-up).
    # POST /api/person/add is upsert per the manual, so re-sending is safe.
    add_res = zkbio_client.add_person(
        pin=student.roll_no, name=student.name,
        dept_code=dept_code, gender=student.gender,
    )
    if zkbio_client.ZKBIO_ENABLED and not (isinstance(add_res, dict) and add_res.get("code") == 0):
        logger.warning(f"[ZKBio] add_person({student.roll_no}, dept={dept_code}) unexpected: {add_res}")

    return student


@app.get("/api/students/{roll_no}", response_model=StudentResponse, tags=["Students"])
def get_student(roll_no: str, db: Session = Depends(get_db)):
    _sweep_expired(db)
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
    # If residency/gender changed without an explicit dept_code, recompute
    # the 4-way dept so the device panel moves them to the right bucket.
    if ("residency" in update_data or "gender" in update_data) and "dept_code" not in update_data:
        new_residency = update_data.get("residency", student.residency)
        new_gender = update_data.get("gender", student.gender)
        try:
            update_data["dept_code"] = zkbio_client.resolve_dept_code(new_residency, new_gender)
        except Exception:
            pass
    for key, value in update_data.items():
        setattr(student, key, value)
    student.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(student)
    # Push dept/gender move to the physical device (person/add is upsert).
    if any(k in update_data for k in ("dept_code", "gender", "name")):
        try:
            zkbio_client.add_person(
                pin=student.roll_no, name=student.name,
                dept_code=student.dept_code, gender=student.gender,
            )
            zkbio_client.sync_person(pin=student.roll_no)
        except Exception as e:
            logger.warning(f"[ZKBio] dept re-sync for {roll_no} failed: {e}")
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
    portal_levels = ""
    vislight_path = ""

    if person_data.get("code") == 0 and "data" in person_data:
        person_details = person_data["data"]

        # Check standard fields for face template existence.
        # NOTE: vislightPhoto is often "" while vislightPhotoPath is set —
        # the path alone means the portal extracted a face (see manual §2.1.1.5).
        vislight_path = str(person_details.get("vislightPhotoPath") or "")
        has_vislight = bool(person_details.get("vislightPhoto") or vislight_path)

        # Or check if face templates are listed (Biometric Templates: 9 is vislight face)
        templates = person_details.get("biometricTemplates", [])
        has_face_template = any(t.get("bioType") == 9 for t in templates) if isinstance(templates, list) else False

        portal_levels = str(person_details.get("accLevelIds") or "")
        has_face = has_vislight or has_face_template

    # Cross-check the bio-template store directly (portal get_person
    # does not always include templates).
    bio = zkbio_client.get_bio_templates(pin=roll_no)
    try:
        has_bio_face = zkbio_client.has_face_bio_template(bio)
    except Exception:
        has_bio_face = False
    if has_bio_face:
        has_face = True

    # Door-level check: face without a level == "person not registered" on terminal
    configured = zkbio_client.ZKBIO_LEVEL_IDS
    level_ok = bool(portal_levels) and configured in portal_levels

    diagnosis = None
    if has_face and not level_ok:
        diagnosis = (
            f"Face IS on the portal (vislight path: {vislight_path or 'present'}), "
            f"but access level '{configured}' is not assigned (portal has '{portal_levels or 'none'}'). "
            f"The turnstile will say 'person not registered'. Fix ZKBIO_LEVEL_IDS then re-register."
        )
    elif not has_face:
        diagnosis = (
            "No face template on portal. Recapture frontal, well-lit JPEG and re-register. "
            "If detectFace rejects it, the photo quality is the problem."
        )

    return {
        "roll_no": roll_no,
        "enrolled": has_face,
        "level_ok": level_ok,
        "portal_levels": portal_levels,
        "configured_levels": configured,
        "vislight_path": vislight_path,
        "has_bio_face": has_bio_face,
        "diagnosis": diagnosis,
        "zkbio_raw": person_data.get("data") if person_data.get("code") == 0 else None,
    }


@app.get("/api/zkbio/levels", tags=["ZKBio"])
def list_zkbio_levels():
    """List access levels on the portal — copy the real `id` into ZKBIO_LEVEL_IDS.

    The default ZKBIO_LEVEL_IDS=1 is a placeholder; real systems use
    UUID-like ids (e.g. 8a888e23...). Wrong level == gate says
    'person not registered'.
    """
    data = zkbio_client.list_access_levels()
    if data is None:
        raise HTTPException(502, "ZKBio disabled or unreachable")
    return data


@app.get("/api/zkbio/departments", tags=["ZKBio"])
def list_zkbio_departments(
    page_no: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=200),
):
    """List departments on the ZKBio admin panel (manual §2.1.2.6).

    Each item is {name, code, parentCode}. Copy the 4 codes for
    Day Scholar Boys / Day Scholar Girls / Hosteller Boys / Hosteller
    Girls into the ZKBIO_DEPT_* env vars (api_app .env + gym-app backend
    .env) and restart both services. Until then new students fall back to
    the configured defaults.
    """
    data = zkbio_client.list_departments(page_no=page_no, page_size=page_size)
    if data is None:
        raise HTTPException(502, "ZKBio disabled or unreachable")
    return data


def _extract_photo_b64(payload: FaceRegisterRequest) -> str | None:
    """Return raw base64 (strip data: URL prefix, whitespace)."""
    raw = payload.photo_base64 or payload.personPhoto
    if not raw:
        return None
    raw = raw.strip()
    if "," in raw and raw.startswith("data:"):
        raw = raw.split(",", 1)[1]
    return raw.strip() or None


@app.post(
    "/api/students/{roll_no}/register-face",
    response_model=FaceRegisterResponse,
    tags=["Students"],
)
def register_face(roll_no: str, payload: FaceRegisterRequest, db: Session = Depends(get_db)):
    """
    Face registration bridge.

    Flow: gym-app (admin webcam) → Node backend → HERE → ZKBio device portal.

    1. Look up the student locally (auto-create a stub so the device PIN
       always has a local row, matching POST /api/students behaviour).
    2. Validate the photo (base64, JPEG/PNG magic bytes, sane size).
    3. If ZKBIO_ENABLED=false → dev-mock: accept and report enrolled=True
       so admin UI + tests work without hardware.
    4. Else → zkbio_client.register_face(): detectFace → add/update
       personPhoto → syncPerson → verify vislight template.
    """
    student = db.query(Student).filter(Student.roll_no == roll_no).first()
    if not student:
        # Auto-create stub so device PIN and local DB never diverge.
        # (gym-app syncs the full profile separately via POST /api/students.)
        student = Student(
            roll_no=roll_no,
            name=(payload.name or roll_no),
            room_no="N/A",
            payment_status=PaymentStatus.UNPAID,
            access_enabled=False,
        )
        db.add(student)
        db.commit()
        db.refresh(student)
        logger.info(f"[Face] Auto-created stub student {roll_no} for face registration")

    photo_b64 = _extract_photo_b64(payload)
    if not photo_b64:
        raise HTTPException(400, "photo_base64 (or personPhoto) is required")
    if len(photo_b64) < 1000:
        raise HTTPException(400, "Photo data too small — capture a real camera frame")

    try:
        raw_bytes = base64.b64decode(photo_b64, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(400, "photo_base64 is not valid base64")
    if len(raw_bytes) < 2000:
        raise HTTPException(400, "Decoded photo too small — recapture with better lighting")
    if len(raw_bytes) > 8 * 1024 * 1024:
        raise HTTPException(400, "Photo too large (max 8 MB decoded)")
    if not (
        raw_bytes.startswith(b"\xff\xd8\xff")  # JPEG
        or raw_bytes.startswith(b"\x89PNG")  # PNG
    ):
        raise HTTPException(400, "Photo must be JPEG or PNG")

    # ── Dev / no-hardware mode ──
    if not zkbio_client.ZKBIO_ENABLED:
        logger.info(f"[Face] dev-mock register for {roll_no} ({len(raw_bytes)} bytes)")
        return FaceRegisterResponse(
            roll_no=roll_no,
            enrolled=True,
            message=f"Face registered for {roll_no} (device bridge in dev-mock mode).",
            mode="dev-mock",
            zkbio=None,
        )

    # ── Real device portal flow ──
    # Resolve the student's 4-way dept so face registration doesn't dump
    # them in General — reuse their stored dept or recompute from residency/gender.
    face_dept = student.dept_code or zkbio_client.resolve_dept_code(student.residency, student.gender)
    result = zkbio_client.register_face(
        pin=roll_no,
        photo_base64=photo_b64,
        name=student.name,
        dept_code=face_dept,
        gender=student.gender,
    )
    if not result.get("ok"):
        raise HTTPException(
            status_code=502,
            detail=result.get("message", f"Device portal rejected face for {roll_no}"),
        )
    return FaceRegisterResponse(
        roll_no=roll_no,
        enrolled=bool(result.get("enrolled")),
        message=result.get("message", f"Face registered for {roll_no}."),
        mode="device",
        zkbio=result.get("steps"),
    )


@app.delete("/api/students/{roll_no}", status_code=204, tags=["Students"])
def delete_student(roll_no: str, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.roll_no == roll_no).first()
    if not student:
        raise HTTPException(404, "Student not found")

    # ── Remove from ZKBio device BEFORE deleting locally ──
    # Order matters: revoke level → delete bio templates → delete person.
    # Do NOT call sync_person() after delete_person — sync re-pushes the
    # person record to the terminal and resurrects them on the panel.
    device_errors: list[str] = []
    if zkbio_client.ZKBIO_ENABLED:
        try:
            lvl = zkbio_client.delete_level(pin=roll_no)
            if isinstance(lvl, dict) and lvl.get("code") not in (0, None):
                logger.warning(f"[ZKBio] delete_level({roll_no}) answered: {lvl}")
        except Exception as e:
            device_errors.append(f"delete_level: {e}")
        try:
            bio = zkbio_client.delete_bio_templates(pin=roll_no)
            if isinstance(bio, dict) and bio.get("code") not in (0, None):
                logger.warning(f"[ZKBio] delete_bio({roll_no}) answered: {bio}")
        except Exception as e:
            device_errors.append(f"delete_bio: {e}")
        person_res = zkbio_client.delete_person(pin=roll_no)
        if person_res is None:
            device_errors.append("delete_person unreachable (no response)")
            logger.error(f"[ZKBio] delete_person({roll_no}) unreachable — aborting local delete")
            raise HTTPException(502, f"Device unreachable — '{roll_no}' NOT deleted anywhere. Retry when the panel is reachable.")
        if isinstance(person_res, dict) and person_res.get("code") not in (0, None):
            # Code -22 = already gone on the panel — treat as success.
            if person_res.get("code") == -22:
                logger.info(f"[ZKBio] delete_person({roll_no}): already absent on panel (-22), continuing")
            else:
                logger.error(f"[ZKBio] delete_person({roll_no}) refused: {person_res}")
                raise HTTPException(
                    502,
                    f"Device refused to delete '{roll_no}' (code={person_res.get('code')}, msg={person_res.get('message')}). NOT deleted locally.",
                )
        logger.info(f"[ZKBio] {roll_no} removed from device (errors_nonfatal={device_errors})")

    db.delete(student)
    db.commit()


@app.patch("/api/students/{roll_no}/payment", response_model=StudentResponse, tags=["Students"])
def update_payment(roll_no: str, payload: PaymentUpdate, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.roll_no == roll_no).first()
    if not student:
        raise HTTPException(404, "Student not found")

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
    if student.access_enabled:
        zkbio_client.add_level_person(pin=roll_no)
        zkbio_client.sync_person(pin=roll_no)
        logger.info(f"[ZKBio] Access ENABLED for {roll_no} on device")
    else:
        zkbio_client.delete_level(pin=roll_no)
        zkbio_client.sync_person(pin=roll_no)
        logger.info(f"[ZKBio] Access DISABLED for {roll_no} on device")

    return student


# ══════════════════════════════════════════════════════════════════════
#  PORTAL SYNC API (admin panel ↔ api_app)
# ══════════════════════════════════════════════════════════════════════

@app.get("/api/zkbio/persons", tags=["ZKBio"])
def list_zkbio_persons(
    page_no: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=200),
):
    """Live read of persons on the ZKBio admin panel portal.

    Use this to prove the api_app can actually see portal data.
    When ZKBIO_ENABLED=false this returns 503 with setup instructions.
    """
    if not zkbio_client.ZKBIO_ENABLED:
        raise HTTPException(
            503,
            "ZKBio disabled (ZKBIO_ENABLED=false). Set ZKBIO_BASE_URL + "
            "ZKBIO_ACCESS_TOKEN from the CVSecurity admin panel and restart.",
        )
    data = zkbio_client.list_persons(page_no=page_no, page_size=page_size)
    if data is None:
        raise HTTPException(502, "ZKBio portal unreachable — check IP/token/network")
    return data


@app.post("/api/sync/pull", response_model=SyncPullResponse, tags=["Sync"])
def sync_pull(db: Session = Depends(get_db)):
    """Pull portal persons into the local DB now (portal → api_app).

    Creates rows missing locally, updates renamed rows, and deletes local
    rows whose PIN was deleted on the admin panel (double-confirmed via a
    per-PIN portal lookup). Safe no-op when the portal is
    disabled/unreachable/partially fetched (never deletes then).
    """
    result = pull_portal_sync(db)
    if not result["ok"]:
        msg = result["message"]
        code = 502 if ("INCOMPLETE" in msg or "nreachable" in msg) else 503
        raise HTTPException(code, msg)
    return SyncPullResponse(
        pulled_at=_SYNC_STATE["last_pull_at"],
        portal_count=_SYNC_STATE["portal_count"],
        added=len(result["added"]),
        updated=len(result["updated"]),
        removed=len(result["removed"]),
        added_pins=result["added"][:100],
        removed_pins=result["removed"][:100],
    )


@app.get("/api/sync/diff", tags=["Sync"])
def sync_diff(db: Session = Depends(get_db)):
    """Read-only portal-vs-local diff (changes nothing).

    Use this when a panel delete 'does nothing': it shows per-PIN whether
    the portal list API still reports the person and what the authoritative
    per-PIN lookup says, so you can see exactly which side is stale.
    """
    if not zkbio_client.ZKBIO_ENABLED:
        raise HTTPException(503, "ZKBio disabled (ZKBIO_ENABLED=false) — no portal to diff against.")
    fetched = zkbio_client.fetch_all_portal_persons()
    if not fetched["complete"]:
        raise HTTPException(
            502,
            f"Portal fetch INCOMPLETE (pages={fetched['pages']}, error={fetched['error']}). Check IP/token.",
        )
    portal_pins = set()
    for item in fetched["items"]:
        if isinstance(item, dict):
            pin = _portal_pin(item)
            if pin:
                portal_pins.add(pin)
    local_pins = {s.roll_no for s in db.query(Student).all()}
    only_portal = sorted(portal_pins - local_pins)
    only_local = sorted(local_pins - portal_pins)
    # Authoritative per-PIN verdict for every disputed local row.
    verdicts = {}
    for pin in only_local:
        present = zkbio_client.check_person_present(pin)
        verdicts[pin] = (
            "still_on_portal (stale list — kept)"
            if present is True
            else "confirmed_gone (next pull deletes it)"
            if present is False
            else "lookup_failed (kept this run)"
        )
    return {
        "portal_count": len(portal_pins),
        "local_count": len(local_pins),
        "portal_total_reported": fetched["total"],
        "only_on_portal_will_be_added": only_portal[:200],
        "only_local": [
            {"roll_no": pin, "verdict": verdicts[pin]} for pin in only_local[:200]
        ],
    }


@app.get("/api/sync/status", response_model=SyncStatusResponse, tags=["Sync"])
def sync_status(db: Session = Depends(get_db)):
    """Show portal-vs-local sync health (proves data is flowing)."""
    local_count = db.query(func.count(Student.id)).scalar() or 0
    return SyncStatusResponse(
        zkbio_enabled=zkbio_client.ZKBIO_ENABLED,
        zkbio_base_url=zkbio_client.ZKBIO_BASE_URL if zkbio_client.ZKBIO_ENABLED else None,
        last_pull_at=_SYNC_STATE["last_pull_at"],
        last_pull_ok=_SYNC_STATE["last_pull_ok"],
        last_pull_message=_SYNC_STATE["last_pull_message"],
        last_added=_SYNC_STATE["last_added"],
        last_updated=_SYNC_STATE["last_updated"],
        last_removed=_SYNC_STATE["last_removed"],
        portal_count=_SYNC_STATE["portal_count"],
        local_count=local_count,
    )


@app.post("/api/sync/push", tags=["Sync"])
def sync_push(db: Session = Depends(get_db)):
    """Push local rows missing on the portal back up (api_app → admin panel).

    Repair tool for the reverse direction: gym-app created a student while
    the portal was offline. Returns per-PIN results.
    """
    if not zkbio_client.ZKBIO_ENABLED:
        raise HTTPException(503, "ZKBio disabled — nothing to push to.")
    pushed, failed, skipped = [], [], []
    for s in db.query(Student).all():
        try:
            person = zkbio_client.get_person(pin=s.roll_no)
            if person and person.get("code") == 0:
                skipped.append(s.roll_no)
                continue
            dept = s.dept_code or zkbio_client.resolve_dept_code(s.residency, s.gender)
            res = zkbio_client.add_person(pin=s.roll_no, name=s.name, dept_code=dept, gender=s.gender)
            if res is not None and res.get("code") not in (0, None):
                failed.append(s.roll_no)
                continue
            if s.access_enabled:
                zkbio_client.add_level_person(pin=s.roll_no)
            zkbio_client.sync_person(pin=s.roll_no)
            pushed.append(s.roll_no)
        except Exception:
            failed.append(s.roll_no)
    return {"pushed": pushed, "failed": failed, "already_on_portal": skipped}


# ══════════════════════════════════════════════════════════════════════
#  ACCESS CHECK (single pay-wall decision for gym-app + frontend)
# ══════════════════════════════════════════════════════════════════════

@app.get("/api/access/check/{roll_no}", response_model=AccessCheckResponse, tags=["Access"])
def access_check(roll_no: str, db: Session = Depends(get_db)):
    """Authoritative gate decision: allowed? If not, message says pay/renew.

    gym-app calls this on every turnstile scan so an expired day-scholar
    pass shows 'You should pay…' instead of a generic deny.
    """
    _sweep_expired(db)
    student = db.query(Student).filter(Student.roll_no == roll_no).first()
    if not student:
        raise HTTPException(404, "Student not found")
    allowed = bool(student.access_enabled and student.payment_status == PaymentStatus.PAID)
    return AccessCheckResponse(
        roll_no=student.roll_no,
        allowed=allowed,
        payment_status=student.payment_status,
        access_enabled=student.access_enabled,
        residency=student.residency,
        payment_valid_until=student.payment_valid_until,
        message=_paywall_message(student) if not allowed else _paywall_message(student),
    )


@app.get("/api/occupancy/inside", tags=["Access"])
def occupancy_inside(zone_code: Optional[str] = Query(None)):
    """Device-side occupancy (manual §2.2.6.1 getWhoIsInsideByZone).

    Returns the PINs the PORTAL currently considers inside the zone —
    authoritative unlike our locally inferred access logs. Needs
    ZKBIO_ZONE_CODE (area code from the panel) unless passed explicitly.
    """
    if not zkbio_client.ZKBIO_ENABLED:
        raise HTTPException(503, "ZKBio disabled (ZKBIO_ENABLED=false).")
    inside = zkbio_client.get_who_is_inside(zone_code)
    return {"zone": zone_code or zkbio_client.ZKBIO_ZONE_CODE, "count": len(inside), "inside": inside}


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
#  STATS
# ══════════════════════════════════════════════════════════════════════

@app.get("/api/stats", response_model=StatsResponse, tags=["Stats"])
def get_stats(db: Session = Depends(get_db)):
    total = db.query(func.count(Student.id)).scalar() or 0
    paid = db.query(func.count(Student.id)).filter(Student.payment_status == PaymentStatus.PAID).scalar() or 0
    unpaid = db.query(func.count(Student.id)).filter(Student.payment_status == PaymentStatus.UNPAID).scalar() or 0
    expired = db.query(func.count(Student.id)).filter(Student.payment_status == PaymentStatus.EXPIRED).scalar() or 0

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
