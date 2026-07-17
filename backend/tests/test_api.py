from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import create_app


def test_full_offline_vertical_slice(tmp_path, monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    app = create_app(f"sqlite:///{(tmp_path / 'bullyx.db').as_posix()}")

    with TestClient(app) as client:
        health = client.get("/health").json()
        assert health["source_documents"] == 40
        assert health["llm_provider"] == "deterministic-mock"

        extraction = client.post("/extract")
        assert extraction.status_code == 200
        candidates = extraction.json()["candidates"]
        assert len(candidates) == 8
        assert all(candidate["status"] == "candidate" for candidate in candidates)
        assert all(candidate["evidence_documents"] for candidate in candidates)

        target = next(
            candidate
            for candidate in candidates
            if candidate["title"] == "Analyst approval for mid-value provisional credit"
        )
        approved = client.post(f"/policies/{target['id']}/approve", json={})
        assert approved.status_code == 200
        assert approved.json()["version"] == 1

        revised = client.post(
            f"/policies/{target['id']}/approve",
            json={
                "rule_text": target["rule_text"] + " Controls review confirmed this wording.",
                "change_note": "Clarified after controls review",
            },
        )
        assert revised.status_code == 200
        assert revised.json()["version"] == 2
        history = client.get(f"/policies/{target['id']}/history").json()
        assert [revision["version"] for revision in history] == [2, 1]
        assert history[0]["change_note"] == "Clarified after controls review"

        decision = client.post(
            "/decide",
            json={
                "dispute_type": "unauthorized",
                "amount": 320,
                "account_age_days": 200,
                "region": "US",
                "days_since_transaction": 15,
            },
        )
        assert decision.status_code == 200
        body = decision.json()
        assert body["decision"] == "approve provisional credit"
        assert body["required_approvals"] == ["risk_analyst"]
        assert body["matched_policy_id"] == target["id"]
        assert body["policy_version"] == 2
        assert body["evidence"] == target["evidence"]

        audit = client.get("/audit").json()
        assert len(audit) == 1
        assert audit[0]["query_input"]["amount"] == 320
        assert client.get("/audit/verify").json()["valid"] is True
