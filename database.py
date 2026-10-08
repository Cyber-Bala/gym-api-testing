import os
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from collections.abc import Generator

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "gym_access.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
    class_=Session,
)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    import models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    # Lightweight auto-migration for SQLite DBs created before
    # the residency/dept_code/gender columns existed (ALTER is a no-op if present).
    try:
        from sqlalchemy import text
        with engine.begin() as conn:
            cols = [r[1] for r in conn.execute(text("PRAGMA table_info(students)")).fetchall()]
            if "residency" not in cols:
                conn.execute(text("ALTER TABLE students ADD COLUMN residency VARCHAR(20)"))
            if "dept_code" not in cols:
                conn.execute(text("ALTER TABLE students ADD COLUMN dept_code VARCHAR(10)"))
            if "gender" not in cols:
                conn.execute(text("ALTER TABLE students ADD COLUMN gender VARCHAR(10)"))
    except Exception:
        pass
