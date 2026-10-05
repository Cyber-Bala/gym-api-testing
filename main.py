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
    AccessLogResponse,
    FaceRegisterRequest,
    FaceRegisterResponse,
    LogEntryExitRequest,
    PaymentUpdate,
    StatsResponse,
    StudentCreate,
    StudentResponse,
    StudentUpdate,
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
#  STARTUP
# ══════════════════════════════════════════════════════════════════════

@app.on_event("startup")
async def startup():
    init_db()
    logger.info("[Startup] Gym Access DB initialized.")
    if zkbio_client.ZKBIO_ENABLED:
        logger.info(f"[Startup] ZKBio integration ENABLED → {zkbio_client.ZKBIO_BASE_URL}")
        asyncio.create_task(poll_transactions())
    else:
        logger.info("[Startup] ZKBio integration DISABLED (manual mode)")


# ── Dashboard ────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
@app.get("/api/health", tags=["Health"])
def health():
    return {
        "status": "ok",
        "service": "gym_api_app",
        "zkbio_enabled": zkbio_client.ZKBIO_ENABLED,
        "zkbio_base_url": zkbio_client.ZKBIO_BASE_URL if zkbio_client.ZKBIO_ENABLED else None,
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
        payment_status=PaymentStatus.UNPAID,
        access_enabled=False,
    )
    db.add(student)
    db.commit()
    db.refresh(student)

    # ── Sync to ZKBio device ──
    # Register person on device (no access level yet — unpaid by default)
    zkbio_client.add_person(pin=student.roll_no, name=student.name, dept_code=payload.dept_code)

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
    has_bio_face = False
    try:
        if isinstance(bio, dict) and bio.get("code") == 0:
            payload = bio.get("data", [])
            items = payload if isinstance(payload, list) else payload.get("data", []) if isinstance(payload, dict) else []
            if isinstance(items, list):
                has_bio_face = any(
                    isinstance(t, dict) and t.get("bioType") in (9, "9") for t in items
                )
    except Exception:
        pass
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
    result = zkbio_client.register_face(
        pin=roll_no,
        photo_base64=photo_b64,
        name=student.name,
        dept_code=None,
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

    # ── Revoke access + remove person on ZKBio device before deleting ──
    # (delete_level alone leaves the person listed in the CVSecurity panel)
    zkbio_client.delete_level(pin=roll_no)
    zkbio_client.delete_person(pin=roll_no)
    zkbio_client.sync_person(pin=roll_no)

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
