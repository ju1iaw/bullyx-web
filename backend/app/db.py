from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator

from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from .models import Base


class Database:
    """Small storage boundary; services depend on repositories, not engine details."""

    def __init__(self, url: str):
        connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
        self.url = url
        self.engine = create_engine(url, connect_args=connect_args, future=True)
        if url.startswith("sqlite"):
            event.listen(self.engine, "connect", self._configure_sqlite)
        self.session_factory = sessionmaker(
            bind=self.engine, expire_on_commit=False, autoflush=False
        )

    @staticmethod
    def _configure_sqlite(dbapi_connection, _connection_record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()

    def initialize(self) -> None:
        Base.metadata.create_all(self.engine)
        if self.url.startswith("sqlite"):
            self._install_audit_guards(self.engine)

    @staticmethod
    def _install_audit_guards(engine: Engine) -> None:
        statements = (
            """
            CREATE TRIGGER IF NOT EXISTS audit_log_no_update
            BEFORE UPDATE ON audit_log_entries
            BEGIN
              SELECT RAISE(ABORT, 'audit log entries are immutable');
            END
            """,
            """
            CREATE TRIGGER IF NOT EXISTS audit_log_no_delete
            BEFORE DELETE ON audit_log_entries
            BEGIN
              SELECT RAISE(ABORT, 'audit log entries are immutable');
            END
            """,
            """
            CREATE TRIGGER IF NOT EXISTS brain_feedback_no_update
            BEFORE UPDATE ON brain_feedback_entries
            BEGIN
              SELECT RAISE(ABORT, 'brain feedback entries are immutable');
            END
            """,
            """
            CREATE TRIGGER IF NOT EXISTS brain_feedback_no_delete
            BEFORE DELETE ON brain_feedback_entries
            BEGIN
              SELECT RAISE(ABORT, 'brain feedback entries are immutable');
            END
            """,
        )
        with engine.begin() as connection:
            for statement in statements:
                connection.execute(text(statement))

    @contextmanager
    def session(self) -> Iterator[Session]:
        session = self.session_factory()
        try:
            yield session
        finally:
            session.close()
