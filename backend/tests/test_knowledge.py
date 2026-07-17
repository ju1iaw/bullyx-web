from __future__ import annotations

from copy import deepcopy

from fastapi.testclient import TestClient

from app.main import create_app


def _private_email() -> dict:
    return {
        "connector": "gmail",
        "items": [
            {
                "external_id": "gmail-message-private-001",
                "source_type": "email",
                "title": "Project Phoenix renewal risk",
                "author": "cfo@example.com",
                "participants": ["sales@example.com", "legal@example.com"],
                "timestamp": "2026-07-16T14:30:00Z",
                "text": (
                    "Project Phoenix renewal is at risk. Contact owner@example.com "
                    "before Friday and keep this inside #finance-review."
                ),
                "thread_id": "gmail-thread-private-001",
                "url": "https://mail.example.test/thread/private-001",
                "entities": ["company:Project Phoenix"],
                "metadata": {"mailbox": "finance@example.com"},
                "permissions": ["user:finance"],
            }
        ],
    }


def test_startup_seeds_company_memory_and_reports_connector_state(tmp_path, monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    app = create_app(f"sqlite:///{(tmp_path / 'knowledge-seed.db').as_posix()}")

    with TestClient(app) as client:
        health = client.get("/health")
        assert health.status_code == 200
        assert health.json()["knowledge_items"] == 40

        items = client.get("/knowledge/items", params={"limit": 100})
        assert items.status_code == 200
        assert len(items.json()) == 40
        assert {item["source_type"] for item in items.json()} == {
            "document",
            "slack",
            "support",
        }
        assert all(item["permissions"] == ["company:all"] for item in items.json())

        response = client.get("/knowledge/connectors")
        assert response.status_code == 200
        connectors = {connector["id"]: connector for connector in response.json()}
        assert set(connectors) == {
            "calendar",
            "crm",
            "github",
            "gmail",
            "google_drive",
            "notion",
            "slack",
            "support",
        }
        for connector_id in ("google_drive", "slack", "support"):
            assert connectors[connector_id]["status"] == "synced"
            assert connectors[connector_id]["item_count"] > 0
            assert connectors[connector_id]["last_synced_at"] is not None
        for connector_id in ("calendar", "crm", "github", "gmail", "notion"):
            assert connectors[connector_id]["status"] == "ready"
            assert connectors[connector_id]["item_count"] == 0
            assert connectors[connector_id]["last_synced_at"] is None


def test_ingest_search_permissions_idempotent_updates_and_entities(tmp_path, monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    app = create_app(f"sqlite:///{(tmp_path / 'knowledge-private.db').as_posix()}")
    payload = _private_email()

    with TestClient(app) as client:
        created = client.post("/knowledge/ingest", json=payload)
        assert created.status_code == 200
        created_body = created.json()
        assert created_body["created_count"] == 1
        assert created_body["updated_count"] == 0
        assert created_body["connector"] == "gmail"
        item = created_body["items"][0]
        item_id = item["id"]
        assert item["source_type"] == "email"
        assert item["permissions"] == ["user:finance"]
        assert item["extra_data"] == {
            "connector": "gmail",
            "mailbox": "finance@example.com",
        }
        assert {
            "company:Project Phoenix",
            "email:owner@example.com",
            "person:cfo@example.com",
            "person:legal@example.com",
            "person:sales@example.com",
            "thread:gmail-thread-private-001",
            "topic:finance-review",
        }.issubset(set(item["entities"]))

        hidden = client.post(
            "/knowledge/search",
            json={
                "query": "Project Phoenix renewal risk",
                "principal": "company:all",
                "source_types": ["email"],
            },
        )
        assert hidden.status_code == 200
        assert hidden.json() == []

        visible = client.post(
            "/knowledge/search",
            json={
                "query": "Project Phoenix renewal risk",
                "principal": "user:finance",
                "source_types": ["email"],
            },
        )
        assert visible.status_code == 200
        assert [hit["item"]["id"] for hit in visible.json()] == [item_id]
        assert visible.json()[0]["relevance_score"] > 0
        assert visible.json()[0]["reason"].startswith("Matched ")

        duplicate = client.post("/knowledge/ingest", json=payload)
        assert duplicate.status_code == 200
        assert duplicate.json()["created_count"] == 0
        assert duplicate.json()["updated_count"] == 0
        assert duplicate.json()["items"][0]["id"] == item_id
        assert client.get("/health").json()["knowledge_items"] == 41

        update_payload = deepcopy(payload)
        update_payload["items"][0]["title"] = "Project Phoenix renewal recovered"
        update_payload["items"][0]["text"] = (
            "Project Phoenix renewed after legal approved the amendment. "
            "Notify owner@example.com and archive #finance-review."
        )
        updated = client.post("/knowledge/ingest", json=update_payload)
        assert updated.status_code == 200
        assert updated.json()["created_count"] == 0
        assert updated.json()["updated_count"] == 1
        assert updated.json()["items"][0]["id"] == item_id
        assert updated.json()["items"][0]["title"] == "Project Phoenix renewal recovered"

        stale_search = client.post(
            "/knowledge/search",
            json={
                "query": "renewal at risk",
                "principal": "user:finance",
                "source_types": ["email"],
            },
        )
        assert stale_search.status_code == 200
        assert stale_search.json() == []
        updated_search = client.post(
            "/knowledge/search",
            json={
                "query": "legal approved amendment",
                "principal": "user:finance",
                "source_types": ["email"],
            },
        )
        assert [hit["item"]["id"] for hit in updated_search.json()] == [item_id]

        entities = client.get("/knowledge/entities", params={"limit": 100})
        assert entities.status_code == 200
        graph = {entity["entity"]: entity for entity in entities.json()}
        for entity_name in (
            "company:Project Phoenix",
            "email:owner@example.com",
            "person:cfo@example.com",
            "topic:finance-review",
        ):
            assert graph[entity_name]["item_ids"] == [item_id]
            assert graph[entity_name]["source_types"] == ["email"]

        connectors = {
            connector["id"]: connector
            for connector in client.get("/knowledge/connectors").json()
        }
        assert connectors["gmail"]["status"] == "synced"
        assert connectors["gmail"]["item_count"] == 1

