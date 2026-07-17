from __future__ import annotations

from datetime import datetime, timezone

from app.models import CandidatePolicy
from app.rules import evaluate_condition, select_policy
from app.schemas import Condition


def policy(policy_id: str, action: str, conditions: list[dict], status: str = "approved"):
    return CandidatePolicy(
        id=policy_id,
        title=policy_id,
        rule_text=f"Rule for {policy_id}",
        structured_rule={
            "conditions": conditions,
            "action": action,
            "required_approvals": [],
        },
        status=status,
        evidence=["src-001"],
        rationale="Test policy rationale.",
        version=1,
        fingerprint=f"fingerprint-{policy_id}",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )


def test_condition_evaluation_is_typed_and_missing_fields_do_not_match():
    amount = Condition(field="amount", operator="gte", value=50)
    assert evaluate_condition(amount, {"amount": 50})
    assert not evaluate_condition(amount, {"amount": "50"})
    assert not evaluate_condition(amount, {})


def test_most_specific_policy_wins_before_restrictiveness():
    broad_manual = policy(
        "broad",
        "manual review",
        [{"field": "amount", "operator": "gt", "value": 100}],
    )
    specific_approval = policy(
        "specific",
        "approve provisional credit",
        [
            {"field": "amount", "operator": "gt", "value": 100},
            {"field": "dispute_type", "operator": "eq", "value": "unauthorized"},
        ],
    )
    result = select_policy(
        [broad_manual, specific_approval],
        {"amount": 320, "dispute_type": "unauthorized"},
    )
    assert result.policy.id == "specific"
    assert result.matched_count == 2


def test_restrictive_action_breaks_equal_specificity_tie_and_candidates_are_ignored():
    approve = policy(
        "approve",
        "approve provisional credit",
        [{"field": "amount", "operator": "gt", "value": 100}],
    )
    manual = policy(
        "manual",
        "manual review",
        [{"field": "amount", "operator": "gt", "value": 100}],
    )
    candidate_deny = policy(
        "candidate",
        "deny dispute",
        [{"field": "amount", "operator": "gt", "value": 100}],
        status="candidate",
    )
    result = select_policy([approve, candidate_deny, manual], {"amount": 320})
    assert result.policy.id == "manual"
    assert result.matched_count == 2
