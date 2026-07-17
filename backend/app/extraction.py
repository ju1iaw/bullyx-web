from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass

from sqlalchemy.orm import Session

from .llm import complete, provider_name
from .models import CandidatePolicy, SourceDocument
from .repositories import Repositories
from .schemas import ExtractionEnvelope


MOCK_CANDIDATES = {
    "candidates": [
        {
            "title": "Auto-credit low-value unauthorized disputes",
            "rule_text": "Automatically issue provisional credit for unauthorized disputes under $50 when the account is at least 90 days old and the claim is filed within 30 days.",
            "structured_rule": {
                "conditions": [
                    {"field": "dispute_type", "operator": "eq", "value": "unauthorized"},
                    {"field": "amount", "operator": "lt", "value": 50},
                    {"field": "account_age_days", "operator": "gte", "value": 90},
                    {"field": "days_since_transaction", "operator": "lte", "value": 30},
                ],
                "action": "approve provisional credit",
                "required_approvals": [],
            },
            "evidence": ["src-001", "src-010", "src-017", "src-026", "src-033"],
            "rationale": "Slack guidance, passed QA cases, and the working playbook consistently describe the same low-value shortcut for mature accounts.",
        },
        {
            "title": "Analyst approval for mid-value provisional credit",
            "rule_text": "Issue provisional credit for unauthorized disputes from $50 through $500 on accounts at least 90 days old when filed within 30 days, after risk analyst approval.",
            "structured_rule": {
                "conditions": [
                    {"field": "dispute_type", "operator": "eq", "value": "unauthorized"},
                    {"field": "amount", "operator": "gte", "value": 50},
                    {"field": "amount", "operator": "lte", "value": 500},
                    {"field": "account_age_days", "operator": "gte", "value": 90},
                    {"field": "days_since_transaction", "operator": "lte", "value": 30},
                ],
                "action": "approve provisional credit",
                "required_approvals": ["risk_analyst"],
            },
            "evidence": ["src-006", "src-014", "src-018", "src-027", "src-034"],
            "rationale": "Two team explanations, two resolved tickets, and QA calibration notes converge on the same band, tenure, window, and approval.",
        },
        {
            "title": "Manual review for high-value disputes",
            "rule_text": "Route any dispute over $500 to manual review and require approval from a disputes lead.",
            "structured_rule": {
                "conditions": [{"field": "amount", "operator": "gt", "value": 500}],
                "action": "manual review",
                "required_approvals": ["disputes_lead"],
            },
            "evidence": ["src-002", "src-011", "src-019", "src-028", "src-035"],
            "rationale": "The threshold and lead approval repeat across Slack, handled cases, and the escalation matrix, including an explicit override of customer risk indicators.",
        },
        {
            "title": "Deny repeat friendly-fraud claims",
            "rule_text": "Deny friendly-fraud disputes when the customer has two or more prior similar disputes.",
            "structured_rule": {
                "conditions": [
                    {"field": "dispute_type", "operator": "eq", "value": "friendly_fraud"},
                    {"field": "prior_similar_disputes", "operator": "gte", "value": 2},
                ],
                "action": "deny dispute",
                "required_approvals": [],
            },
            "evidence": ["src-003", "src-012", "src-020", "src-029", "src-036"],
            "rationale": "Risk guidance and two adjudicated cases consistently treat two prior similar claims as repeat friendly fraud requiring denial.",
        },
        {
            "title": "Accept EU disputes within 60 days",
            "rule_text": "Accept EU customer disputes for intake when they are filed no later than 60 calendar days after the transaction.",
            "structured_rule": {
                "conditions": [
                    {"field": "region", "operator": "eq", "value": "EU"},
                    {"field": "days_since_transaction", "operator": "lte", "value": 60},
                ],
                "action": "accept dispute for investigation",
                "required_approvals": [],
            },
            "evidence": ["src-004", "src-013", "src-021", "src-030", "src-037"],
            "rationale": "Current compliance confirmation, accepted cases, and the addendum support 60 days; the linked source set also distinguishes this from the retired 45-day macro.",
        },
        {
            "title": "Manual review for young high-risk accounts",
            "rule_text": "Route disputes over $100 to manual risk review when the account is younger than 30 days, with disputes lead approval required.",
            "structured_rule": {
                "conditions": [
                    {"field": "account_age_days", "operator": "lt", "value": 30},
                    {"field": "amount", "operator": "gt", "value": 100},
                ],
                "action": "manual risk review",
                "required_approvals": ["disputes_lead"],
            },
            "evidence": ["src-005", "src-022", "src-031", "src-038"],
            "rationale": "Operational guidance, two recent cases, and the new-account control document identify the same age and value thresholds.",
        },
        {
            "title": "Merchant contact first for small duplicate charges",
            "rule_text": "For duplicate-charge disputes of $150 or less, request that the customer contact the merchant before considering platform-funded credit.",
            "structured_rule": {
                "conditions": [
                    {"field": "dispute_type", "operator": "eq", "value": "duplicate_charge"},
                    {"field": "amount", "operator": "lte", "value": 150},
                    {"field": "merchant_contacted", "operator": "eq", "value": False},
                ],
                "action": "request merchant contact",
                "required_approvals": [],
            },
            "evidence": ["src-007", "src-023", "src-032", "src-039"],
            "rationale": "Team guidance, case outcomes, and the duplicate-billing runbook show merchant outreach as the first step for low-value duplicates.",
        },
        {
            "title": "Escalate disputes outside the filing window",
            "rule_text": "Escalate a dispute to a human limitations review when it is outside the applicable regional filing window; do not automatically deny it.",
            "structured_rule": {
                "conditions": [{"field": "outside_filing_window", "operator": "eq", "value": True}],
                "action": "escalate to human limitations review",
                "required_approvals": ["limitations_reviewer"],
            },
            "evidence": ["src-016", "src-024", "src-040"],
            "rationale": "The operations note, a handled US case, and limitations guidance all reject automatic denial in favor of human review.",
        },
    ]
}


@dataclass(slots=True)
class ExtractionRun:
    provider: str
    created_count: int
    policies: list[CandidatePolicy]


def _prompt(documents: list[SourceDocument]) -> str:
    sources = [
        {
            "id": document.id,
            "type": document.type,
            "author": document.author,
            "timestamp": document.timestamp.isoformat(),
            "thread_id": document.thread_id,
            "text": document.text,
        }
        for document in documents
    ]
    return (
        "You are extracting operational policy candidates for a governed fintech "
        "dispute system. Mine recurring decision patterns only. Every candidate MUST "
        "cite one or more exact source ids from the supplied list; never invent an id "
        "or a rule without evidence. Capture contradictions in the rationale and prefer "
        "the most current corroborated practice. Conditions must be deterministic field "
        "comparisons using only eq, neq, lt, lte, gt, gte, in, not_in, contains, or exists. "
        "Return concise rules suitable for human review.\n\nSOURCE_DOCUMENTS:\n"
        + json.dumps(sources, ensure_ascii=False, indent=2)
    )


def _fingerprint(candidate: dict) -> str:
    canonical = json.dumps(candidate, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def extract_candidates(session: Session) -> ExtractionRun:
    repositories = Repositories.from_session(session)
    documents = repositories.sources.list()
    envelope = complete(
        _prompt(documents),
        ExtractionEnvelope,
        MOCK_CANDIDATES,
        schema_name="bullyx_policy_extraction",
        operation="Policy extraction",
    )
    source_ids = {document.id for document in documents}
    created_count = 0
    policies: list[CandidatePolicy] = []
    seen_fingerprints: set[str] = set()

    for candidate_model in envelope.candidates:
        candidate = candidate_model.model_dump(mode="json", by_alias=True)
        unknown_evidence = set(candidate["evidence"]) - source_ids
        if unknown_evidence:
            raise ValueError(
                "Extractor returned unknown evidence ids: "
                + ", ".join(sorted(unknown_evidence))
            )
        fingerprint = _fingerprint(candidate)
        if fingerprint in seen_fingerprints:
            continue
        seen_fingerprints.add(fingerprint)
        existing = repositories.policies.get_by_fingerprint(fingerprint)
        if existing:
            if existing.status in {"candidate", "edited"}:
                policies.append(existing)
            continue
        policy = CandidatePolicy(
            id=f"pol-{fingerprint[:12]}",
            title=candidate["title"],
            rule_text=candidate["rule_text"],
            structured_rule=candidate["structured_rule"],
            status="candidate",
            evidence=candidate["evidence"],
            rationale=candidate["rationale"],
            version=0,
            fingerprint=fingerprint,
        )
        repositories.policies.add(policy)
        policies.append(policy)
        created_count += 1

    session.commit()
    return ExtractionRun(
        provider=provider_name(), created_count=created_count, policies=policies
    )
