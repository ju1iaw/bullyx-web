from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class Operator(str, Enum):
    eq = "eq"
    neq = "neq"
    lt = "lt"
    lte = "lte"
    gt = "gt"
    gte = "gte"
    in_ = "in"
    not_in = "not_in"
    contains = "contains"
    exists = "exists"


class Condition(BaseModel):
    model_config = ConfigDict(extra="forbid")

    field: str = Field(min_length=1, max_length=80)
    operator: Operator
    value: Any = None

    @field_validator("field")
    @classmethod
    def safe_field(cls, value: str) -> str:
        value = value.strip()
        if value.startswith("_") or "__" in value:
            raise ValueError("unsafe field name")
        return value


class PolicyRule(BaseModel):
    model_config = ConfigDict(extra="forbid")

    conditions: list[Condition] = Field(min_length=1, max_length=20)
    action: str = Field(min_length=1, max_length=160)
    required_approvals: list[str] = Field(default_factory=list, max_length=10)


class SourceDocumentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    type: str
    author: str
    timestamp: datetime
    text: str
    thread_id: str | None


class ExtractionCandidate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=3, max_length=180)
    rule_text: str = Field(min_length=10)
    structured_rule: PolicyRule
    evidence: list[str] = Field(min_length=1)
    rationale: str = Field(min_length=10)


class ExtractionEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    candidates: list[ExtractionCandidate] = Field(min_length=1, max_length=20)


class PolicyRead(BaseModel):
    id: str
    title: str
    rule_text: str
    structured_rule: PolicyRule
    status: str
    evidence: list[str]
    evidence_documents: list[SourceDocumentRead]
    rationale: str
    version: int
    created_at: datetime
    updated_at: datetime


class PolicyRevisionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    policy_id: str
    version: int
    title: str
    rule_text: str
    structured_rule: PolicyRule
    evidence: list[str]
    rationale: str
    change_note: str
    created_at: datetime


class ApprovalRequest(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=180)
    rule_text: str | None = Field(default=None, min_length=10)
    structured_rule: PolicyRule | None = None
    evidence: list[str] | None = Field(default=None, min_length=1)
    rationale: str | None = Field(default=None, min_length=10)
    change_note: str | None = Field(default=None, max_length=240)


class RejectRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=500)


class ExtractionResult(BaseModel):
    provider: str
    created_count: int
    candidates: list[PolicyRead]


class DecisionResponse(BaseModel):
    decision: str
    required_approvals: list[str]
    matched_policy_id: str | None
    policy_version: int | None
    evidence: list[str]
    rationale: str


class BrainAnalyzeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str = Field(min_length=5, max_length=4000)
    facts: dict[str, Any] = Field(default_factory=dict)
    principal: str = Field(default="company:all", min_length=1, max_length=180)


class BrainExtractedFacts(BaseModel):
    model_config = ConfigDict(extra="forbid")

    dispute_type: str | None
    amount: float | None
    account_age_days: int | None
    region: str | None
    days_since_transaction: int | None
    prior_similar_disputes: int | None
    merchant_contacted: bool | None
    outside_filing_window: bool | None
    summary: str


class BrainConditionCheck(BaseModel):
    field: str
    operator: str
    expected: Any
    actual: Any
    state: Literal["satisfied", "missing", "failed"]


class BrainPolicyAssessment(BaseModel):
    policy_id: str
    title: str
    status: str
    version: int
    action: str
    required_approvals: list[str]
    evidence: list[str]
    relevance_score: float = Field(ge=0, le=1)
    matched_conditions: int
    total_conditions: int
    missing_fields: list[str]
    failed_conditions: list[str]
    condition_trace: list[BrainConditionCheck]
    exact_match: bool


class BrainSourceHit(BaseModel):
    id: str
    type: str
    title: str
    author: str
    timestamp: datetime
    thread_id: str | None
    text: str
    relevance_score: float = Field(ge=0, le=1)
    reason: str


class BrainBrief(BaseModel):
    analysis_id: str
    provider: str
    summary: str
    understood_facts: dict[str, Any]
    recommendation: str
    status: Literal[
        "ready",
        "approval_required",
        "context_required",
        "human_review_required",
        "policy_approval_required",
    ]
    confidence: float = Field(ge=0, le=1)
    confidence_label: Literal["high", "medium", "low"]
    policy_match_ready: bool
    execution_ready: bool
    governing_policy_id: str | None
    policy_version: int | None
    required_approvals: list[str]
    missing_information: list[str]
    questions: list[str]
    conflicts: list[str]
    reasoning_trace: list[str]
    relevant_policies: list[BrainPolicyAssessment]
    relevant_sources: list[BrainSourceHit]
    guardrail: str


class BrainFeedbackRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    analysis_id: str = Field(min_length=8, max_length=60)
    message: str = Field(min_length=5, max_length=4000)
    understood_facts: dict[str, Any] = Field(default_factory=dict)
    recommendation: str = Field(min_length=3, max_length=500)
    rating: Literal["helpful", "needs_review"]
    note: str = Field(default="", max_length=1000)


class BrainFeedbackRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    analysis_id: str
    message: str
    understood_facts: dict[str, Any]
    recommendation: str
    rating: str
    note: str
    created_at: datetime


class KnowledgeItemIngest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    external_id: str = Field(min_length=1, max_length=180)
    source_type: str = Field(min_length=2, max_length=40)
    title: str = Field(default="Untitled", max_length=300)
    author: str = Field(default="Unknown", max_length=180)
    participants: list[str] = Field(default_factory=list, max_length=100)
    timestamp: datetime
    text: str = Field(min_length=1, max_length=100000)
    thread_id: str | None = Field(default=None, max_length=180)
    url: str | None = Field(default=None, max_length=2000)
    entities: list[str] = Field(default_factory=list, max_length=100)
    metadata: dict[str, Any] = Field(default_factory=dict)
    permissions: list[str] = Field(default_factory=lambda: ["company:all"], max_length=100)


class KnowledgeIngestRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    connector: str = Field(min_length=2, max_length=60)
    items: list[KnowledgeItemIngest] = Field(min_length=1, max_length=500)


class KnowledgeItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    source_type: str
    external_id: str
    title: str
    author: str
    participants: list[str]
    timestamp: datetime
    text: str
    thread_id: str | None
    url: str | None
    entities: list[str]
    extra_data: dict[str, Any]
    permissions: list[str]
    created_at: datetime
    updated_at: datetime


class KnowledgeIngestResult(BaseModel):
    connector: str
    created_count: int
    updated_count: int
    items: list[KnowledgeItemRead]


class KnowledgeSearchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    query: str = Field(min_length=2, max_length=1000)
    source_types: list[str] = Field(default_factory=list, max_length=20)
    principal: str = Field(default="company:all", min_length=1, max_length=180)
    limit: int = Field(default=10, ge=1, le=50)


class KnowledgeSearchHit(BaseModel):
    item: KnowledgeItemRead
    relevance_score: float = Field(ge=0, le=1)
    reason: str


class KnowledgeConnectorRead(BaseModel):
    id: str
    label: str
    category: str
    status: Literal["synced", "ready"]
    item_count: int
    last_synced_at: datetime | None


class KnowledgeEntityRead(BaseModel):
    entity: str
    item_count: int
    source_types: list[str]
    last_seen_at: datetime
    item_ids: list[str]


class CompanyBrainQueryRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question: str = Field(min_length=3, max_length=2000)
    principal: str = Field(default="company:all", min_length=1, max_length=180)
    source_types: list[str] = Field(default_factory=list, max_length=20)
    limit: int = Field(default=8, ge=1, le=20)


class CompanyBrainSynthesis(BaseModel):
    model_config = ConfigDict(extra="forbid")

    answer: str = Field(min_length=1, max_length=6000)
    key_points: list[str] = Field(default_factory=list, max_length=8)
    gaps: list[str] = Field(default_factory=list, max_length=8)
    recommended_actions: list[str] = Field(default_factory=list, max_length=8)


class CompanyBrainAnswer(BaseModel):
    query_id: str
    provider: str
    answer: str
    confidence_label: Literal["high", "medium", "low"]
    key_points: list[str]
    sources: list[KnowledgeSearchHit]
    entities: list[str]
    gaps: list[str]
    recommended_actions: list[str]
    guardrail: str


class AuditLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sequence: int
    id: str
    timestamp: datetime
    query_input: dict[str, Any]
    matched_policy_id: str | None
    policy_version: int | None
    decision: dict[str, Any]
    evidence_ids: list[str]
    prev_hash: str
    hash: str


class AuditVerification(BaseModel):
    valid: bool
    entries_checked: int
    broken_at: str | None
    head_hash: str | None
