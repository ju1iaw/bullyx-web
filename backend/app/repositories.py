from __future__ import annotations

import hashlib
import json
import threading
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import (
    AuditLogEntry,
    BrainFeedbackEntry,
    CandidatePolicy,
    KnowledgeItem,
    PolicyRevision,
    SourceDocument,
)


def _utc_iso(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat(timespec="microseconds")


def audit_digest(
    *,
    entry_id: str,
    timestamp: datetime,
    query_input: dict[str, Any],
    matched_policy_id: str | None,
    policy_version: int | None,
    decision: dict[str, Any],
    evidence_ids: list[str],
    prev_hash: str,
) -> str:
    payload = {
        "id": entry_id,
        "timestamp": _utc_iso(timestamp),
        "query_input": query_input,
        "matched_policy_id": matched_policy_id,
        "policy_version": policy_version,
        "decision": decision,
        "evidence_ids": evidence_ids,
    }
    canonical = json.dumps(
        payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False
    ).encode("utf-8")
    return hashlib.sha256(canonical + prev_hash.encode("ascii")).hexdigest()


class SourceRepository:
    def __init__(self, session: Session):
        self.session = session

    def count(self) -> int:
        return self.session.scalar(select(func.count(SourceDocument.id))) or 0

    def list(self) -> list[SourceDocument]:
        return list(
            self.session.scalars(
                select(SourceDocument).order_by(SourceDocument.timestamp, SourceDocument.id)
            )
        )

    def get_many(self, ids: list[str]) -> list[SourceDocument]:
        if not ids:
            return []
        documents = list(
            self.session.scalars(select(SourceDocument).where(SourceDocument.id.in_(ids)))
        )
        positions = {document_id: index for index, document_id in enumerate(ids)}
        return sorted(documents, key=lambda document: positions.get(document.id, len(ids)))

    def add_all(self, documents: list[SourceDocument]) -> None:
        self.session.add_all(documents)


class PolicyRepository:
    def __init__(self, session: Session):
        self.session = session

    def list(self, status: str | None = None) -> list[CandidatePolicy]:
        statement = select(CandidatePolicy)
        if status:
            statement = statement.where(CandidatePolicy.status == status)
        statement = statement.order_by(
            CandidatePolicy.updated_at.desc(), CandidatePolicy.created_at.desc()
        )
        return list(self.session.scalars(statement))

    def get(self, policy_id: str) -> CandidatePolicy | None:
        return self.session.get(CandidatePolicy, policy_id)

    def get_by_fingerprint(self, fingerprint: str) -> CandidatePolicy | None:
        return self.session.scalar(
            select(CandidatePolicy).where(CandidatePolicy.fingerprint == fingerprint)
        )

    def add(self, policy: CandidatePolicy) -> None:
        self.session.add(policy)

    def add_revision(self, revision: PolicyRevision) -> None:
        self.session.add(revision)

    def history(self, policy_id: str) -> list[PolicyRevision]:
        return list(
            self.session.scalars(
                select(PolicyRevision)
                .where(PolicyRevision.policy_id == policy_id)
                .order_by(PolicyRevision.version.desc())
            )
        )


_audit_lock = threading.Lock()


class AuditRepository:
    def __init__(self, session: Session):
        self.session = session

    def list(self) -> list[AuditLogEntry]:
        return list(
            self.session.scalars(
                select(AuditLogEntry).order_by(AuditLogEntry.sequence.asc())
            )
        )

    def append(
        self,
        *,
        query_input: dict[str, Any],
        matched_policy_id: str | None,
        policy_version: int | None,
        decision: dict[str, Any],
        evidence_ids: list[str],
    ) -> AuditLogEntry:
        with _audit_lock:
            previous = self.session.scalar(
                select(AuditLogEntry).order_by(AuditLogEntry.sequence.desc()).limit(1)
            )
            entry_id = str(uuid.uuid4())
            timestamp = datetime.now(timezone.utc)
            prev_hash = previous.hash if previous else ""
            digest = audit_digest(
                entry_id=entry_id,
                timestamp=timestamp,
                query_input=query_input,
                matched_policy_id=matched_policy_id,
                policy_version=policy_version,
                decision=decision,
                evidence_ids=evidence_ids,
                prev_hash=prev_hash,
            )
            entry = AuditLogEntry(
                id=entry_id,
                timestamp=timestamp,
                query_input=query_input,
                matched_policy_id=matched_policy_id,
                policy_version=policy_version,
                decision=decision,
                evidence_ids=evidence_ids,
                prev_hash=prev_hash,
                hash=digest,
            )
            self.session.add(entry)
            self.session.flush()
            # Keep the process-level lock through commit so concurrent callers cannot
            # both observe the same chain head in this embedded deployment.
            self.session.commit()
            return entry

    def verify(self) -> dict[str, Any]:
        entries = self.list()
        previous_hash = ""
        for entry in entries:
            expected = audit_digest(
                entry_id=entry.id,
                timestamp=entry.timestamp,
                query_input=entry.query_input,
                matched_policy_id=entry.matched_policy_id,
                policy_version=entry.policy_version,
                decision=entry.decision,
                evidence_ids=entry.evidence_ids,
                prev_hash=previous_hash,
            )
            if entry.prev_hash != previous_hash or entry.hash != expected:
                return {
                    "valid": False,
                    "entries_checked": entry.sequence,
                    "broken_at": entry.id,
                    "head_hash": entries[-1].hash if entries else None,
                }
            previous_hash = entry.hash
        return {
            "valid": True,
            "entries_checked": len(entries),
            "broken_at": None,
            "head_hash": entries[-1].hash if entries else None,
        }


class BrainFeedbackRepository:
    def __init__(self, session: Session):
        self.session = session

    def count(self) -> int:
        return self.session.scalar(select(func.count(BrainFeedbackEntry.id))) or 0

    def list(self, limit: int = 50) -> list[BrainFeedbackEntry]:
        return list(
            self.session.scalars(
                select(BrainFeedbackEntry)
                .order_by(BrainFeedbackEntry.created_at.desc())
                .limit(limit)
            )
        )

    def add(self, entry: BrainFeedbackEntry) -> None:
        self.session.add(entry)


class KnowledgeRepository:
    def __init__(self, session: Session):
        self.session = session

    def count(self) -> int:
        return self.session.scalar(select(func.count(KnowledgeItem.id))) or 0

    def list(
        self,
        *,
        source_types: list[str] | None = None,
        limit: int | None = None,
    ) -> list[KnowledgeItem]:
        statement = select(KnowledgeItem)
        if source_types:
            statement = statement.where(KnowledgeItem.source_type.in_(source_types))
        statement = statement.order_by(KnowledgeItem.timestamp.desc(), KnowledgeItem.id)
        if limit:
            statement = statement.limit(limit)
        return list(self.session.scalars(statement))

    def get_by_source_external(
        self, source_type: str, external_id: str
    ) -> KnowledgeItem | None:
        return self.session.scalar(
            select(KnowledgeItem).where(
                KnowledgeItem.source_type == source_type,
                KnowledgeItem.external_id == external_id,
            )
        )

    def add(self, item: KnowledgeItem) -> None:
        self.session.add(item)


@dataclass(slots=True)
class Repositories:
    sources: SourceRepository
    policies: PolicyRepository
    audits: AuditRepository
    brain_feedback: BrainFeedbackRepository
    knowledge: KnowledgeRepository

    @classmethod
    def from_session(cls, session: Session) -> "Repositories":
        return cls(
            sources=SourceRepository(session),
            policies=PolicyRepository(session),
            audits=AuditRepository(session),
            brain_feedback=BrainFeedbackRepository(session),
            knowledge=KnowledgeRepository(session),
        )
