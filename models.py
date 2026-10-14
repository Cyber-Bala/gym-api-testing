from datetime import date as dt_date, datetime
from enum import Enum as PyEnum

from sqlalchemy import Boolean, Date, DateTime, Enum as SqlEnum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class PaymentStatus(str, PyEnum):
    PAID = "paid"
    UNPAID = "unpaid"
    EXPIRED = "expired"


class EventType(str, PyEnum):
    ENTRY = "entry"
    EXIT = "exit"


class AccessStatus(str, PyEnum):
    ALLOWED = "allowed"
    DENIED = "denied"


def _enum_values(enum_cls: type[PyEnum]) -> list[str]:
    return [m.value for m in enum_cls]


class Student(Base):
    __tablename__ = "students"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    roll_no: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    room_no: Mapped[str] = mapped_column(String(20), nullable=False)
    phone: Mapped[str] = mapped_column(String(15), nullable=True)
    payment_status: Mapped[PaymentStatus] = mapped_column(
        SqlEnum(PaymentStatus, name="payment_status", native_enum=False,
                validate_strings=True, values_callable=_enum_values),
        nullable=False,
        default=PaymentStatus.UNPAID,
    )
    payment_valid_from: Mapped[dt_date | None] = mapped_column(Date, nullable=True)
    payment_valid_until: Mapped[dt_date | None] = mapped_column(Date, nullable=True)
    access_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow,
    )

    access_logs: Mapped[list["AccessLog"]] = relationship(
        back_populates="student", cascade="all, delete-orphan",
    )


class AccessLog(Base):
    __tablename__ = "access_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    student_id: Mapped[int] = mapped_column(
        ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    event_type: Mapped[EventType] = mapped_column(
        SqlEnum(EventType, name="event_type", native_enum=False,
                validate_strings=True, values_callable=_enum_values),
        nullable=False,
    )
    status: Mapped[AccessStatus] = mapped_column(
        SqlEnum(AccessStatus, name="access_status", native_enum=False,
                validate_strings=True, values_callable=_enum_values),
        nullable=False,
    )
    timestamp: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    student: Mapped[Student] = relationship(back_populates="access_logs")
