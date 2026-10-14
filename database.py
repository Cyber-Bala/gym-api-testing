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
    # create_all never alters existing tables: add newer columns by hand
    with engine.begin() as conn:
        cols = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info(students)")}
        if "category" not in cols:
            conn.exec_driver_sql("ALTER TABLE students ADD COLUMN category VARCHAR(40)")
            conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_students_category ON students (category)")
