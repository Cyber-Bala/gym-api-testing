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


class StudentUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=120)
    room_no: Optional[str] = Field(None, max_length=20)
    phone: Optional[str] = Field(None, max_length=15)


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
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


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


class FaceRegistrationRequest(BaseModel):
    photo_base64: str = Field(..., min_length=1)


class FaceRegistrationResponse(BaseModel):
    success: bool
    message: str
    roll_no: str
    zkbio_synced: bool
