from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import JSON, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class SourceDocument(Base):
    __tablename__ = "source_documents"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    type: Mapped[str] = mapped_column(String(24), index=True)
    author: Mapped[str] = mapped_column(String(120))
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    text: Mapped[str] = mapped_column(Text)
    thread_id: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)


class CandidatePolicy(Base):
    __tablename__ = "candidate_policies"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    title: Mapped[str] = mapped_column(String(180))
    rule_text: Mapped[str] = mapped_column(Text)
    structured_rule: Mapped[dict[str, Any]] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(20), default="candidate", index=True)
    evidence: Mapped[list[str]] = mapped_column(JSON, default=list)
    rationale: Mapped[str] = mapped_column(Text)
    version: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )
    fingerprint: Mapped[str] = mapped_column(String(64), unique=True, index=True)

    revisions: Mapped[list["PolicyRevision"]] = relationship(
        back_populates="policy",
        cascade="all, delete-orphan",
        order_by="PolicyRevision.version.desc()",
    )


class PolicyRevision(Base):
    __tablename__ = "policy_revisions"
    __table_args__ = (
        Index("ix_policy_revision_policy_version", "policy_id", "version", unique=True),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    policy_id: Mapped[str] = mapped_column(
        ForeignKey("candidate_policies.id", ondelete="CASCADE"), index=True
    )
    version: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(180))
    rule_text: Mapped[str] = mapped_column(Text)
    structured_rule: Mapped[dict[str, Any]] = mapped_column(JSON)
    evidence: Mapped[list[str]] = mapped_column(JSON, default=list)
    rationale: Mapped[str] = mapped_column(Text)
    change_note: Mapped[str] = mapped_column(String(240), default="Approved")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )

    policy: Mapped[CandidatePolicy] = relationship(back_populates="revisions")


class AuditLogEntry(Base):
    __tablename__ = "audit_log_entries"

    sequence: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, index=True
    )
    query_input: Mapped[dict[str, Any]] = mapped_column(JSON)
    matched_policy_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    policy_version: Mapped[int | None] = mapped_column(Integer, nullable=True)
    decision: Mapped[dict[str, Any]] = mapped_column(JSON)
    evidence_ids: Mapped[list[str]] = mapped_column(JSON, default=list)
    prev_hash: Mapped[str] = mapped_column(String(64), default="")
    hash: Mapped[str] = mapped_column(String(64), unique=True)


class BrainFeedbackEntry(Base):
    __tablename__ = "brain_feedback_entries"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    analysis_id: Mapped[str] = mapped_column(String(60), index=True)
    message: Mapped[str] = mapped_column(Text)
    understood_facts: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    recommendation: Mapped[str] = mapped_column(Text)
    rating: Mapped[str] = mapped_column(String(24), index=True)
    note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, index=True
    )


class KnowledgeItem(Base):
    __tablename__ = "knowledge_items"
    __table_args__ = (
        UniqueConstraint("source_type", "external_id", name="uq_knowledge_source_external"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    source_type: Mapped[str] = mapped_column(String(40), index=True)
    external_id: Mapped[str] = mapped_column(String(180))
    title: Mapped[str] = mapped_column(String(300), default="Untitled")
    author: Mapped[str] = mapped_column(String(180), default="Unknown")
    participants: Mapped[list[str]] = mapped_column(JSON, default=list)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    text: Mapped[str] = mapped_column(Text)
    thread_id: Mapped[str | None] = mapped_column(String(180), nullable=True, index=True)
    url: Mapped[str | None] = mapped_column(Text, nullable=True)
    entities: Mapped[list[str]] = mapped_column(JSON, default=list)
    extra_data: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    permissions: Mapped[list[str]] = mapped_column(JSON, default=list)
    content_hash: Mapped[str] = mapped_column(String(64), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now, index=True
    )
