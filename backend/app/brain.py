from __future__ import annotations

import json
import re
import uuid
from dataclasses import dataclass
from typing import Any

from sqlalchemy.orm import Session

from .llm import complete, provider_name
from .models import CandidatePolicy, KnowledgeItem
from .repositories import Repositories
from .rules import evaluate_condition, matches, select_policy
from .schemas import (
    BrainAnalyzeRequest,
    BrainBrief,
    BrainConditionCheck,
    BrainExtractedFacts,
    BrainPolicyAssessment,
    BrainSourceHit,
    PolicyRule,
)


ALLOWED_FACTS = {
    "dispute_type",
    "amount",
    "account_age_days",
    "region",
    "days_since_transaction",
    "prior_similar_disputes",
    "merchant_contacted",
    "outside_filing_window",
}

QUESTIONS = {
    "dispute_type": "What type of dispute is this?",
    "amount": "What is the disputed amount?",
    "account_age_days": "How old is the account in days?",
    "region": "Which customer region governs the case?",
    "days_since_transaction": "How many days have passed since the transaction?",
    "prior_similar_disputes": "How many similar disputes has this customer filed before?",
    "merchant_contacted": "Has the customer already contacted the merchant?",
    "outside_filing_window": "Is the case outside its regional filing window?",
}

STOP_WORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "customer",
    "for",
    "from",
    "has",
    "in",
    "is",
    "it",
    "of",
    "on",
    "or",
    "that",
    "the",
    "this",
    "to",
    "was",
    "with",
}


def _terms(value: str) -> set[str]:
    return {
        term
        for term in re.findall(r"[a-z0-9]+", value.lower())
        if len(term) > 1 and term not in STOP_WORDS
    }


def _number(value: str) -> int:
    words = {"zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5}
    return words.get(value.lower(), int(value) if value.isdigit() else 0)


def _duration_days(value: str, unit: str) -> int:
    amount = int(value)
    if unit.startswith("year"):
        return amount * 365
    if unit.startswith("month"):
        return amount * 30
    return amount


def _heuristic_facts(message: str) -> dict[str, Any]:
    text = message.lower()
    facts: dict[str, Any] = {}

    dispute_types = (
        ("friendly_fraud", ("friendly fraud", "household member", "family member")),
        ("duplicate_charge", ("duplicate charge", "charged twice", "duplicate billing")),
        ("atm_cash_not_received", ("atm", "cash not received", "cash-not-received")),
        ("unauthorized", ("unauthorized", "unrecognized", "not my purchase")),
    )
    for value, phrases in dispute_types:
        if any(phrase in text for phrase in phrases):
            facts["dispute_type"] = value
            break

    amount_match = re.search(r"(?:\$|usd\s*)(\d+(?:\.\d{1,2})?)", text)
    if not amount_match:
        amount_match = re.search(
            r"(?:amount|claim|dispute|charge|purchase)(?:\s+(?:of|for|is))?\s*(\d+(?:\.\d{1,2})?)\s*(?:dollars?|usd)",
            text,
        )
    if amount_match:
        facts["amount"] = float(amount_match.group(1))

    account_patterns = (
        r"(\d+)\s*[- ]\s*(day|month|year)s?[- ]old\s+account",
        r"account(?:\s+age)?(?:\s+is|\s+of)?\s*(\d+)\s*(day|month|year)s?\s+old",
        r"account\s+(?:opened|created)\s+(\d+)\s*(day|month|year)s?\s+ago",
    )
    for pattern in account_patterns:
        match = re.search(pattern, text)
        if match:
            facts["account_age_days"] = _duration_days(match.group(1), match.group(2))
            break

    transaction_patterns = (
        r"(?:transaction|purchase|charge)(?:\s+(?:happened|occurred|was))?\s*(\d+)\s*days?\s+ago",
        r"(?:filed|reported|raised|submitted)(?:\s+the\s+(?:claim|dispute))?\s+(?:after|at day)\s*(\d+)\s*days?",
        r"(\d+)\s*days?\s+(?:after|since)\s+the\s+(?:transaction|purchase|charge)",
    )
    for pattern in transaction_patterns:
        match = re.search(pattern, text)
        if match:
            facts["days_since_transaction"] = int(match.group(1))
            break

    region_patterns = (
        ("EU", r"\b(?:eu|european union|europe)\b"),
        ("UK", r"\b(?:uk|united kingdom|britain|british)\b"),
        ("CA", r"\b(?:ca|canada|canadian)\b"),
        ("US", r"\b(?:usa|united states|american)\b|\bu\.s\.\b"),
    )
    for region, pattern in region_patterns:
        if re.search(pattern, text):
            facts["region"] = region
            break

    prior_match = re.search(
        r"(zero|one|two|three|four|five|\d+)\s+(?:prior|previous|earlier|similar)\s+(?:similar\s+)?(?:disputes?|claims?)",
        text,
    )
    if prior_match:
        facts["prior_similar_disputes"] = _number(prior_match.group(1))

    negative_merchant = (
        "not contacted the merchant",
        "hasn't contacted the merchant",
        "has not contacted the merchant",
        "didn't contact the merchant",
        "did not contact the merchant",
    )
    if any(phrase in text for phrase in negative_merchant):
        facts["merchant_contacted"] = False
    elif "contacted the merchant" in text or "merchant was contacted" in text:
        facts["merchant_contacted"] = True

    if "outside the filing window" in text or "past the filing window" in text:
        facts["outside_filing_window"] = True

    return facts


def _normalise_fact(name: str, value: Any) -> Any:
    if value is None:
        return None
    if name in {"amount"}:
        return float(value)
    if name in {"account_age_days", "days_since_transaction", "prior_similar_disputes"}:
        return int(value)
    if name in {"merchant_contacted", "outside_filing_window"}:
        if isinstance(value, bool):
            return value
        raw = str(value).strip().lower()
        if raw in {"1", "true", "yes", "y"}:
            return True
        if raw in {"0", "false", "no", "n"}:
            return False
        raise ValueError(f"{name} must be true, false, or omitted when unknown")
    if name == "region":
        aliases = {"CANADA": "CA", "UNITED STATES": "US", "USA": "US", "EUROPE": "EU"}
        raw = str(value).strip().upper()
        return aliases.get(raw, raw)
    if name == "dispute_type":
        raw = str(value).strip().lower().replace("-", "_").replace(" ", "_")
        aliases = {"friendlyfraud": "friendly_fraud", "duplicate": "duplicate_charge"}
        return aliases.get(raw, raw)
    return value


def _fact_model(
    message: str, provided: dict[str, Any]
) -> tuple[BrainExtractedFacts, list[str]]:
    heuristic = _heuristic_facts(message)
    mock = {
        "dispute_type": heuristic.get("dispute_type"),
        "amount": heuristic.get("amount"),
        "account_age_days": heuristic.get("account_age_days"),
        "region": heuristic.get("region"),
        "days_since_transaction": heuristic.get("days_since_transaction"),
        "prior_similar_disputes": heuristic.get("prior_similar_disputes"),
        "merchant_contacted": heuristic.get("merchant_contacted"),
        "outside_filing_window": heuristic.get("outside_filing_window"),
        "summary": "Operational situation parsed from the submitted narrative.",
    }
    prompt = (
        "Extract only facts explicitly stated or directly calculable from this fintech dispute narrative. "
        "Do not invent missing values. Allowed fields are dispute_type, amount, account_age_days, region, "
        "days_since_transaction, prior_similar_disputes, merchant_contacted, and outside_filing_window. "
        "Use null for anything unknown. Normalize dispute types to unauthorized, friendly_fraud, "
        "duplicate_charge, or atm_cash_not_received; normalize region to US, EU, UK, or CA.\n\n"
        f"NARRATIVE:\n{message}\n\nHEURISTIC_DRAFT:\n{json.dumps(mock, indent=2)}"
    )
    extracted = complete(
        prompt,
        BrainExtractedFacts,
        mock,
        schema_name="bullyx_brain_intake",
        operation="Brain intake",
    )
    values = extracted.model_dump(exclude={"summary"}, exclude_none=True)
    conflicts: list[str] = []
    for name, value in provided.items():
        if name in ALLOWED_FACTS and value is not None:
            normalised = _normalise_fact(name, value)
            if name in values and values[name] != normalised:
                conflicts.append(
                    f"The narrative suggested {name}={values[name]!r}, but the supplied fact says {normalised!r}. Confirm the governing value."
                )
            values[name] = normalised
    if "region" in values and "days_since_transaction" in values:
        limits = {"US": 30, "EU": 60}
        limit = limits.get(values["region"])
        if limit is not None:
            values["outside_filing_window"] = values["days_since_transaction"] > limit
    return BrainExtractedFacts(
        dispute_type=values.get("dispute_type"),
        amount=values.get("amount"),
        account_age_days=values.get("account_age_days"),
        region=values.get("region"),
        days_since_transaction=values.get("days_since_transaction"),
        prior_similar_disputes=values.get("prior_similar_disputes"),
        merchant_contacted=values.get("merchant_contacted"),
        outside_filing_window=values.get("outside_filing_window"),
        summary=extracted.summary,
    ), conflicts


def _summary(facts: dict[str, Any], fallback: str) -> str:
    parts: list[str] = []
    if facts.get("dispute_type"):
        parts.append(str(facts["dispute_type"]).replace("_", " ").title())
    if facts.get("amount") is not None:
        parts.append(f"${facts['amount']:,.2f}")
    if facts.get("region"):
        parts.append(str(facts["region"]))
    if facts.get("account_age_days") is not None:
        parts.append(f"{facts['account_age_days']}-day account")
    return " · ".join(parts) if parts else fallback


def _resolve(facts: dict[str, Any], field: str) -> tuple[bool, Any]:
    current: Any = facts
    for part in field.split("."):
        if not isinstance(current, dict) or part not in current:
            return False, None
        current = current[part]
    return True, current


def _condition_text(field: str, operator: str, expected: Any, actual: Any) -> str:
    return f"{field} must satisfy {operator} {expected!r} (received {actual!r})"


@dataclass(slots=True)
class AssessedPolicy:
    policy: CandidatePolicy
    rule: PolicyRule
    response: BrainPolicyAssessment


def _assess_policy(policy: CandidatePolicy, facts: dict[str, Any], query_terms: set[str]) -> AssessedPolicy:
    rule = PolicyRule.model_validate(policy.structured_rule)
    matched = 0
    missing: list[str] = []
    failed: list[str] = []
    trace: list[BrainConditionCheck] = []
    for condition in rule.conditions:
        exists, actual = _resolve(facts, condition.field)
        if not exists:
            missing.append(condition.field)
            state = "missing"
        elif evaluate_condition(condition, facts):
            matched += 1
            state = "satisfied"
        else:
            failed.append(
                _condition_text(
                    condition.field,
                    condition.operator.value,
                    condition.value,
                    actual,
                )
            )
            state = "failed"
        trace.append(
            BrainConditionCheck(
                field=condition.field,
                operator=condition.operator.value,
                expected=condition.value,
                actual=actual if exists else None,
                state=state,
            )
        )
    total = len(rule.conditions)
    exact = matched == total
    policy_terms = _terms(
        " ".join([policy.title, policy.rule_text, rule.action, policy.rationale])
    )
    lexical = min(1.0, len(query_terms & policy_terms) / 5)
    condition_score = matched / total if total else 0
    score = condition_score * 0.65 + lexical * 0.25 + (0.1 if policy.status == "approved" else 0.03)
    if exact:
        score = max(score, 0.94 if policy.status == "approved" else 0.82)
    return AssessedPolicy(
        policy=policy,
        rule=rule,
        response=BrainPolicyAssessment(
            policy_id=policy.id,
            title=policy.title,
            status=policy.status,
            version=policy.version,
            action=rule.action,
            required_approvals=rule.required_approvals,
            evidence=policy.evidence,
            relevance_score=round(min(score, 1.0), 3),
            matched_conditions=matched,
            total_conditions=total,
            missing_fields=list(dict.fromkeys(missing)),
            failed_conditions=failed,
            condition_trace=trace,
            exact_match=exact,
        ),
    )


def _source_hits(
    documents: list[KnowledgeItem],
    query_terms: set[str],
    relevant_policies: list[AssessedPolicy],
) -> list[BrainSourceHit]:
    boosted: dict[str, list[str]] = {}
    for assessed in relevant_policies[:3]:
        for evidence_id in assessed.policy.evidence:
            boosted.setdefault(evidence_id, []).append(assessed.policy.title)
    hits: list[BrainSourceHit] = []
    for document in documents:
        overlap = len(query_terms & _terms(document.text))
        policy_source_id = document.extra_data.get("policy_source_id")
        policy_titles = boosted.get(policy_source_id or document.id, [])
        if not overlap and not policy_titles:
            continue
        score = min(1.0, overlap / 6 + (0.55 if policy_titles else 0))
        reason = (
            "Cited by " + ", ".join(policy_titles[:2])
            if policy_titles
            else f"Shares {overlap} important terms with the situation"
        )
        hits.append(
            BrainSourceHit(
                id=document.id,
                type=document.source_type,
                title=document.title,
                author=document.author,
                timestamp=document.timestamp,
                thread_id=document.thread_id,
                text=document.text,
                relevance_score=round(score, 3),
                reason=reason,
            )
        )
    hits.sort(key=lambda item: (-item.relevance_score, item.id))
    return hits[:5]


def analyze_situation(session: Session, request: BrainAnalyzeRequest) -> BrainBrief:
    repositories = Repositories.from_session(session)
    extracted, intake_conflicts = _fact_model(request.message, request.facts)
    facts = extracted.model_dump(exclude={"summary"}, exclude_none=True)
    query_terms = _terms(request.message + " " + " ".join(map(str, facts.values())))
    policies = [
        policy
        for policy in repositories.policies.list()
        if policy.status in {"approved", "candidate", "edited"}
    ]
    assessed = [_assess_policy(policy, facts, query_terms) for policy in policies]
    assessed.sort(
        key=lambda item: (
            not item.response.exact_match,
            item.policy.status != "approved",
            -item.response.relevance_score,
            item.policy.id,
        )
    )

    approved = [item.policy for item in assessed if item.policy.status == "approved"]
    match = select_policy(approved, facts)
    exact_approved = [
        item for item in assessed if item.policy.status == "approved" and matches(item.rule, facts)
    ]
    exact_pending = [
        item for item in assessed if item.policy.status != "approved" and matches(item.rule, facts)
    ]
    conflicts: list[str] = list(intake_conflicts)
    actions = sorted({item.rule.action for item in exact_approved})
    if len(actions) > 1:
        conflicts.append(
            "Multiple approved policies match with different actions: "
            + ", ".join(actions)
            + ". Deterministic precedence selects the most specific, then most restrictive rule."
        )

    policy_match_ready = bool(match.policy and match.rule)
    governing_policy_id = match.policy.id if match.policy else None
    policy_version = match.policy.version if match.policy else None
    required_approvals = match.rule.required_approvals if match.rule else []
    missing_information: list[str] = []

    blocking_conflict = bool(conflicts)
    if blocking_conflict:
        recommendation = (
            "Pause for human review — multiple approved policies match with different actions."
        )
        confidence = 0.42
        status = "human_review_required"
    elif match.policy and match.rule:
        recommendation = match.rule.action
        confidence = 0.96 if len(actions) <= 1 else 0.82
        status = "approval_required" if required_approvals else "ready"
    elif exact_pending:
        recommendation = (
            "Hold for human approval — a relevant policy candidate exists, but it is not active."
        )
        confidence = 0.52
        status = "policy_approval_required"
    else:
        near_approved = [item for item in assessed if item.policy.status == "approved"]
        best = near_approved[0] if near_approved else None
        if best and best.response.missing_fields and not best.response.failed_conditions:
            missing_information = best.response.missing_fields
            recommendation = (
                f"Gather missing information before applying: {best.rule.action}."
            )
            confidence = 0.58
            status = "context_required"
        else:
            recommendation = (
                "Escalate to a human reviewer — no approved policy fully governs this situation."
            )
            confidence = 0.28
            status = "human_review_required"

    execution_ready = policy_match_ready and not required_approvals and not blocking_conflict

    if not missing_information and not policy_match_ready:
        for item in assessed:
            if item.response.missing_fields:
                missing_information = item.response.missing_fields
                break
    missing_information = list(dict.fromkeys(missing_information))
    questions = [QUESTIONS.get(field, f"What is the value for {field}?") for field in missing_information]
    confidence_label = "high" if confidence >= 0.8 else "medium" if confidence >= 0.5 else "low"
    approved_count = sum(item.policy.status == "approved" for item in assessed)
    pending_count = sum(item.policy.status != "approved" for item in assessed)
    reasoning_trace = [
        f"Understood {len(facts)} explicit or directly derived facts from the situation.",
        f"Checked {approved_count} approved policy versions and {pending_count} pending candidates.",
        f"Found {len(exact_approved)} exact approved matches and {len(exact_pending)} exact pending matches.",
    ]
    if policy_match_ready and not blocking_conflict:
        reasoning_trace.append(
            "The policy match can be committed only through the deterministic decision endpoint and its approval gate."
        )
    else:
        reasoning_trace.append(
            "Bullyx is withholding execution until missing context or human governance resolves the gap."
        )

    relevant = assessed[:5]
    return BrainBrief(
        analysis_id=f"brain-{uuid.uuid4().hex[:16]}",
        provider=provider_name(),
        summary=_summary(facts, extracted.summary),
        understood_facts=facts,
        recommendation=recommendation,
        status=status,
        confidence=confidence,
        confidence_label=confidence_label,
        policy_match_ready=policy_match_ready,
        execution_ready=execution_ready,
        governing_policy_id=governing_policy_id,
        policy_version=policy_version,
        required_approvals=required_approvals,
        missing_information=missing_information,
        questions=questions,
        conflicts=conflicts,
        reasoning_trace=reasoning_trace,
        relevant_policies=[item.response for item in relevant],
        relevant_sources=_source_hits(repositories.knowledge.list(), query_terms, relevant),
        guardrail=(
            "Brain briefs are advisory. Only approved policy versions can execute, and feedback is queued for human review rather than changing rules automatically."
        ),
    )
