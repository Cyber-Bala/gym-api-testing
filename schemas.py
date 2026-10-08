from datetime import date as dt_date, datetime
from typing import Optional

from pydantic import BaseModel, Field

from models import AccessStatus, EventType, PaymentStatus


# ── Student Schemas ──────────────────────────────────────────────────

class StudentCreate(BaseModel):
    roll_no: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=120)
    room_no: str = Field(..., min_length=1, max_length=20)
    phone: Optional[str] = Field(None, max_length=15)
    dept_code: Optional[str] = Field(None, max_length=10)
    residency: Optional[str] = Field(None, max_length=20, description="hosteller | day_scholar")
    gender: Optional[str] = Field(None, max_length=10, description="male | female")


class StudentUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=120)
    room_no: Optional[str] = Field(None, max_length=20)
    phone: Optional[str] = Field(None, max_length=15)
    residency: Optional[str] = Field(None, max_length=20)
    gender: Optional[str] = Field(None, max_length=10)
    dept_code: Optional[str] = Field(None, max_length=10)


class FaceRegisterRequest(BaseModel):
    # gym-app sends `photo_base64`; accept `personPhoto` alias too
    photo_base64: Optional[str] = Field(None, description="Raw base64 JPEG (no data: prefix required)")
    personPhoto: Optional[str] = Field(None, description="Alias for photo_base64")
    name: Optional[str] = Field(None, max_length=120)
    dept_code: Optional[str] = Field(None, max_length=10)

    model_config = {"populate_by_name": True}


class FaceRegisterResponse(BaseModel):
    roll_no: str
    enrolled: bool
    message: str
    mode: str  # "device" | "dev-mock"
    zkbio: Optional[dict] = None


class PaymentUpdate(BaseModel):
    payment_status: PaymentStatus
    payment_valid_from: Optional[dt_date] = None
    payment_valid_until: Optional[dt_date] = None


class StudentResponse(BaseModel):
    id: int
    roll_no: str
    name: str
    room_no: str
    phone: Optional[str]
    payment_status: PaymentStatus
    payment_valid_from: Optional[dt_date]
    payment_valid_until: Optional[dt_date]
    access_enabled: bool
    residency: Optional[str] = None
    gender: Optional[str] = None
    dept_code: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DepartmentInfo(BaseModel):
    name: str = ""
    code: str = ""
    parentCode: Optional[str] = None


# ── Portal sync / access-check schemas ─────────────────────────────────

class SyncPullResponse(BaseModel):
    pulled_at: datetime
    portal_count: int
    added: int
    updated: int
    removed: int
    added_pins: list[str] = []
    removed_pins: list[str] = []


class SyncStatusResponse(BaseModel):
    zkbio_enabled: bool
    zkbio_base_url: Optional[str] = None
    last_pull_at: Optional[datetime] = None
    last_pull_ok: Optional[bool] = None
    last_pull_message: Optional[str] = None
    last_added: int = 0
    last_updated: int = 0
    last_removed: int = 0
    portal_count: int = 0
    local_count: int = 0


class AccessCheckResponse(BaseModel):
    roll_no: str
    allowed: bool
    payment_status: PaymentStatus
    access_enabled: bool
    residency: Optional[str] = None
    payment_valid_until: Optional[dt_date] = None
    message: str


# ── Access Log Schemas ───────────────────────────────────────────────

class LogEntryExitRequest(BaseModel):
    roll_no: str = Field(..., min_length=1)
    event_type: EventType
    notes: Optional[str] = None


class AccessLogResponse(BaseModel):
    id: int
    student_id: int
    roll_no: str
    student_name: str
    event_type: EventType
    status: AccessStatus
    timestamp: datetime
    notes: Optional[str]

    model_config = {"from_attributes": True}


# ── Stats ────────────────────────────────────────────────────────────

class StatsResponse(BaseModel):
    total_students: int
    paid_count: int
    unpaid_count: int
    expired_count: int
    currently_inside: int
