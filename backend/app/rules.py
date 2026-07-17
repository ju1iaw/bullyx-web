from __future__ import annotations

from dataclasses import dataclass
from numbers import Real
from typing import Any

from .models import CandidatePolicy
from .schemas import Condition, Operator, PolicyRule


RESTRICTIVENESS = {
    "deny": 100,
    "manual": 90,
    "escalate": 85,
    "request": 60,
    "approve": 30,
    "accept": 20,
}


def _resolve(situation: dict[str, Any], field: str) -> tuple[bool, Any]:
    current: Any = situation
    for part in field.split("."):
        if not isinstance(current, dict) or part not in current:
            return False, None
        current = current[part]
    return True, current


def _numeric(value: Any) -> bool:
    return isinstance(value, Real) and not isinstance(value, bool)


def evaluate_condition(condition: Condition, situation: dict[str, Any]) -> bool:
    exists, actual = _resolve(situation, condition.field)
    operator = condition.operator
    expected = condition.value

    if operator == Operator.exists:
        return exists is bool(expected)
    if not exists:
        return False
    if operator == Operator.eq:
        return actual == expected
    if operator == Operator.neq:
        return actual != expected
    if operator in {Operator.lt, Operator.lte, Operator.gt, Operator.gte}:
        if not (_numeric(actual) and _numeric(expected)):
            return False
        if operator == Operator.lt:
            return actual < expected
        if operator == Operator.lte:
            return actual <= expected
        if operator == Operator.gt:
            return actual > expected
        return actual >= expected
    if operator == Operator.in_:
        return isinstance(expected, list) and actual in expected
    if operator == Operator.not_in:
        return isinstance(expected, list) and actual not in expected
    if operator == Operator.contains:
        return isinstance(actual, (str, list, tuple, set)) and expected in actual
    return False


def matches(rule: PolicyRule, situation: dict[str, Any]) -> bool:
    return all(evaluate_condition(condition, situation) for condition in rule.conditions)


def specificity(rule: PolicyRule) -> int:
    operator_weight = {
        Operator.eq: 4,
        Operator.in_: 3,
        Operator.lt: 2,
        Operator.lte: 2,
        Operator.gt: 2,
        Operator.gte: 2,
        Operator.neq: 1,
        Operator.not_in: 1,
        Operator.contains: 2,
        Operator.exists: 1,
    }
    return len(rule.conditions) * 10 + sum(
        operator_weight[condition.operator] for condition in rule.conditions
    )


def restrictiveness(action: str) -> int:
    normalized = action.lower()
    return max(
        (rank for word, rank in RESTRICTIVENESS.items() if word in normalized),
        default=50,
    )


@dataclass(slots=True)
class MatchResult:
    policy: CandidatePolicy | None
    rule: PolicyRule | None
    matched_count: int


def select_policy(
    policies: list[CandidatePolicy], situation: dict[str, Any]
) -> MatchResult:
    matched: list[tuple[int, int, str, CandidatePolicy, PolicyRule]] = []
    for policy in policies:
        if policy.status != "approved":
            continue
        rule = PolicyRule.model_validate(policy.structured_rule)
        if matches(rule, situation):
            matched.append(
                (
                    specificity(rule),
                    restrictiveness(rule.action),
                    policy.id,
                    policy,
                    rule,
                )
            )
    if not matched:
        return MatchResult(policy=None, rule=None, matched_count=0)
    matched.sort(key=lambda item: (-item[0], -item[1], item[2]))
    winner = matched[0]
    return MatchResult(policy=winner[3], rule=winner[4], matched_count=len(matched))
