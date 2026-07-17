from __future__ import annotations

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DatabaseError

from app.db import Database
from app.repositories import Repositories


def append(repo, number: int):
    return repo.audits.append(
        query_input={"amount": number},
        matched_policy_id=None,
        policy_version=None,
        decision={"decision": "escalate", "required_approvals": ["human_reviewer"]},
        evidence_ids=[],
    )


def test_audit_chain_verifies_and_sqlite_guards_mutation(tmp_path):
    database = Database(f"sqlite:///{(tmp_path / 'audit.db').as_posix()}")
    database.initialize()
    with database.session() as session:
        repositories = Repositories.from_session(session)
        append(repositories, 10)
        append(repositories, 20)
        verification = repositories.audits.verify()
        assert verification["valid"] is True
        assert verification["entries_checked"] == 2

    with pytest.raises(DatabaseError):
        with database.engine.begin() as connection:
            connection.execute(
                text("UPDATE audit_log_entries SET policy_version = 99 WHERE sequence = 1")
            )


def test_verifier_detects_out_of_band_tampering(tmp_path):
    database = Database(f"sqlite:///{(tmp_path / 'tampered.db').as_posix()}")
    database.initialize()
    with database.session() as session:
        repositories = Repositories.from_session(session)
        append(repositories, 10)
        append(repositories, 20)

    # Simulate a privileged actor bypassing the database guard itself.
    with database.engine.begin() as connection:
        connection.execute(text("DROP TRIGGER audit_log_no_update"))
        connection.execute(
            text("UPDATE audit_log_entries SET policy_version = 99 WHERE sequence = 1")
        )

    with database.session() as session:
        verification = Repositories.from_session(session).audits.verify()
        assert verification["valid"] is False
        assert verification["broken_at"] is not None
