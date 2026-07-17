from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import create_app


def _approve_mid_value_policy(client: TestClient) -> dict:
    candidates = client.post("/extract").json()["candidates"]
    target = next(
        candidate
        for candidate in candidates
        if candidate["title"] == "Analyst approval for mid-value provisional credit"
    )
    response = client.post(f"/policies/{target['id']}/approve", json={})
    assert response.status_code == 200
    return response.json()


def test_brain_understands_retrieves_and_hands_off_to_rules(tmp_path, monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    app = create_app(f"sqlite:///{(tmp_path / 'brain.db').as_posix()}")

    with TestClient(app) as client:
        approved = _approve_mid_value_policy(client)
        response = client.post(
            "/brain/analyze",
            json={
                "message": (
                    "A US customer reports an unauthorized $320 charge. "
                    "The account is 200 days old and the transaction happened 15 days ago."
                )
            },
        )
        assert response.status_code == 200
        brief = response.json()
        assert brief["understood_facts"]["dispute_type"] == "unauthorized"
        assert brief["understood_facts"]["amount"] == 320
        assert brief["understood_facts"]["account_age_days"] == 200
        assert brief["understood_facts"]["days_since_transaction"] == 15
        assert brief["policy_match_ready"] is True
        assert brief["execution_ready"] is False
        assert brief["status"] == "approval_required"
        assert brief["governing_policy_id"] == approved["id"]
        assert brief["recommendation"] == "approve provisional credit"
        assert brief["confidence_label"] == "high"
        assert brief["relevant_policies"][0]["exact_match"] is True
        assert all(
            check["state"] == "satisfied"
            for check in brief["relevant_policies"][0]["condition_trace"]
        )
        assert brief["relevant_sources"]

        decision = client.post("/decide", json=brief["understood_facts"])
        assert decision.status_code == 200
        assert decision.json()["matched_policy_id"] == approved["id"]


def test_brain_withholds_execution_and_asks_for_missing_context(tmp_path, monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    app = create_app(f"sqlite:///{(tmp_path / 'brain-missing.db').as_posix()}")

    with TestClient(app) as client:
        _approve_mid_value_policy(client)
        response = client.post(
            "/brain/analyze",
            json={"message": "A US customer reports an unauthorized $320 charge."},
        )
        assert response.status_code == 200
        brief = response.json()
        assert brief["execution_ready"] is False
        assert brief["policy_match_ready"] is False
        assert brief["status"] == "context_required"
        assert "account_age_days" in brief["missing_information"]
        assert "days_since_transaction" in brief["missing_information"]
        assert brief["questions"]
        assert "withholding execution" in brief["reasoning_trace"][-1]


def test_brain_feedback_is_governed_memory_not_policy_mutation(tmp_path, monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    app = create_app(f"sqlite:///{(tmp_path / 'brain-feedback.db').as_posix()}")

    with TestClient(app) as client:
        _approve_mid_value_policy(client)
        brief = client.post(
            "/brain/analyze",
            json={
                "message": (
                    "An unauthorized $320 charge on a 200-day-old US account; "
                    "the transaction happened 15 days ago."
                )
            },
        ).json()
        before = client.get("/health").json()["approved_policies"]
        feedback = client.post(
            "/brain/feedback",
            json={
                "analysis_id": brief["analysis_id"],
                "message": "An unauthorized $320 charge on a mature account.",
                "understood_facts": brief["understood_facts"],
                "recommendation": brief["recommendation"],
                "rating": "needs_review",
                "note": "Confirm the customer communication wording.",
            },
        )
        assert feedback.status_code == 201
        assert feedback.json()["rating"] == "needs_review"
        assert client.get("/brain/feedback").json()[0]["analysis_id"] == brief["analysis_id"]
        health = client.get("/health").json()
        assert health["brain_feedback"] == 1
        assert health["approved_policies"] == before
