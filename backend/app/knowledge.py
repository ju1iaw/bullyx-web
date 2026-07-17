from __future__ import annotations

import hashlib
import json
import re
from collections import defaultdict
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from .models import KnowledgeItem, utc_now
from .repositories import Repositories
from .schemas import (
    KnowledgeConnectorRead,
    KnowledgeEntityRead,
    KnowledgeIngestRequest,
    KnowledgeIngestResult,
    KnowledgeItemIngest,
    KnowledgeItemRead,
    KnowledgeSearchHit,
    KnowledgeSearchRequest,
)


STOP_WORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
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

CONNECTORS = (
    ("gmail", "Gmail", "Communication", {"email", "gmail"}),
    ("slack", "Slack", "Communication", {"slack", "slack_message"}),
    ("google_drive", "Google Drive", "Documents", {"google_drive", "document", "doc"}),
    ("notion", "Notion", "Documents", {"notion"}),
    ("github", "GitHub", "Engineering", {"github", "pull_request", "issue"}),
    ("calendar", "Calendar", "Meetings", {"calendar", "meeting"}),
    ("support", "Support", "Customers", {"support", "ticket"}),
    ("crm", "CRM", "Customers", {"crm", "salesforce", "hubspot"}),
)


def _terms(value: str) -> set[str]:
    return {
        term
        for term in re.findall(r"[a-z0-9]+", value.lower())
        if len(term) > 1 and term not in STOP_WORDS
    }


def _content_hash(item: KnowledgeItemIngest) -> str:
    payload = item.model_dump(mode="json")
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _stable_id(source_type: str, external_id: str) -> str:
    digest = hashlib.sha256(f"{source_type}:{external_id}".encode("utf-8")).hexdigest()
    return f"know-{digest[:16]}"


def _normalise_source_type(value: str) -> str:
    return re.sub(r"[^a-z0-9_]+", "_", value.strip().lower()).strip("_")


def infer_entities(item: KnowledgeItemIngest) -> list[str]:
    entities = {value.strip() for value in item.entities if value.strip()}
    if item.author and item.author != "Unknown":
        entities.add(f"person:{item.author.strip()}")
    for participant in item.participants:
        if participant.strip():
            entities.add(f"person:{participant.strip()}")
    for email in re.findall(r"[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}", item.text):
        entities.add(f"email:{email.lower()}")
    for tag in re.findall(r"(?<!\w)#([a-zA-Z][\w-]{1,40})", item.text):
        entities.add(f"topic:{tag.lower()}")
    if item.thread_id:
        entities.add(f"thread:{item.thread_id}")
    return sorted(entities)


def ingest_knowledge(session: Session, payload: KnowledgeIngestRequest) -> KnowledgeIngestResult:
    repository = Repositories.from_session(session).knowledge
    created = 0
    updated = 0
    stored: list[KnowledgeItem] = []
    for incoming in payload.items:
        source_type = _normalise_source_type(incoming.source_type)
        content_hash = _content_hash(incoming)
        existing = repository.get_by_source_external(source_type, incoming.external_id)
        entities = infer_entities(incoming)
        if existing:
            if existing.content_hash != content_hash:
                existing.title = incoming.title or "Untitled"
                existing.author = incoming.author or "Unknown"
                existing.participants = incoming.participants
                existing.timestamp = incoming.timestamp
                existing.text = incoming.text
                existing.thread_id = incoming.thread_id
                existing.url = incoming.url
                existing.entities = entities
                existing.extra_data = {**incoming.metadata, "connector": payload.connector}
                existing.permissions = incoming.permissions
                existing.content_hash = content_hash
                existing.updated_at = utc_now()
                updated += 1
            stored.append(existing)
            continue
        item = KnowledgeItem(
            id=_stable_id(source_type, incoming.external_id),
            source_type=source_type,
            external_id=incoming.external_id,
            title=incoming.title or "Untitled",
            author=incoming.author or "Unknown",
            participants=incoming.participants,
            timestamp=incoming.timestamp,
            text=incoming.text,
            thread_id=incoming.thread_id,
            url=incoming.url,
            entities=entities,
            extra_data={**incoming.metadata, "connector": payload.connector},
            permissions=incoming.permissions,
            content_hash=content_hash,
        )
        repository.add(item)
        stored.append(item)
        created += 1
    session.commit()
    return KnowledgeIngestResult(
        connector=payload.connector,
        created_count=created,
        updated_count=updated,
        items=[KnowledgeItemRead.model_validate(item) for item in stored],
    )


def seed_company_knowledge(session: Session) -> int:
    repositories = Repositories.from_session(session)
    source_documents = repositories.sources.list()
    if not source_documents:
        return 0
    type_map = {"slack_message": "slack", "ticket": "support", "doc": "document"}
    payload = KnowledgeIngestRequest(
        connector="demo_seed",
        items=[
            KnowledgeItemIngest(
                external_id=document.id,
                source_type=type_map.get(document.type, document.type),
                title=(
                    f"Slack · {document.thread_id or document.author}"
                    if document.type == "slack_message"
                    else document.author
                ),
                author=document.author,
                participants=[document.author],
                timestamp=document.timestamp,
                text=document.text,
                thread_id=document.thread_id,
                entities=[],
                metadata={"policy_source_id": document.id},
                permissions=["company:all"],
            )
            for document in source_documents
        ],
    )
    return ingest_knowledge(session, payload).created_count


def _visible(item: KnowledgeItem, principal: str) -> bool:
    permissions = item.permissions or ["company:all"]
    return "company:all" in permissions or principal in permissions


def search_knowledge(session: Session, payload: KnowledgeSearchRequest) -> list[KnowledgeSearchHit]:
    repository = Repositories.from_session(session).knowledge
    query_terms = _terms(payload.query)
    query_lower = payload.query.lower().strip()
    hits: list[tuple[float, datetime, KnowledgeSearchHit]] = []
    for item in repository.list(source_types=payload.source_types or None):
        if not _visible(item, payload.principal):
            continue
        title_matches = query_terms & _terms(item.title)
        text_matches = query_terms & _terms(item.text)
        entity_matches = query_terms & _terms(" ".join(item.entities))
        people_matches = query_terms & _terms(" ".join([item.author, *item.participants]))
        title_overlap = len(title_matches)
        text_overlap = len(text_matches)
        entity_overlap = len(entity_matches)
        people_overlap = len(people_matches)
        phrase_match = bool(query_lower and query_lower in f"{item.title} {item.text}".lower())
        matched_terms = title_matches | text_matches | entity_matches | people_matches
        if len(query_terms) > 1 and len(matched_terms) < 2 and not phrase_match:
            continue
        raw = title_overlap * 2 + text_overlap + entity_overlap * 2 + people_overlap
        if phrase_match:
            raw += 4
        if raw <= 0:
            continue
        denominator = max(4, len(query_terms) * 2.5)
        score = min(1.0, raw / denominator)
        reasons = []
        if title_overlap:
            reasons.append(f"{title_overlap} title terms")
        if text_overlap:
            reasons.append(f"{text_overlap} content terms")
        if entity_overlap or people_overlap:
            reasons.append("connected people or entities")
        if phrase_match:
            reasons.append("exact phrase")
        hit = KnowledgeSearchHit(
            item=KnowledgeItemRead.model_validate(item),
            relevance_score=round(score, 3),
            reason="Matched " + ", ".join(reasons),
        )
        hits.append((score, item.timestamp, hit))
    hits.sort(key=lambda entry: (-entry[0], -entry[1].timestamp(), entry[2].item.id))
    return [entry[2] for entry in hits[: payload.limit]]


def connector_status(session: Session) -> list[KnowledgeConnectorRead]:
    items = Repositories.from_session(session).knowledge.list()
    result: list[KnowledgeConnectorRead] = []
    for connector_id, label, category, source_types in CONNECTORS:
        connected = [item for item in items if item.source_type in source_types]
        result.append(
            KnowledgeConnectorRead(
                id=connector_id,
                label=label,
                category=category,
                status="synced" if connected else "ready",
                item_count=len(connected),
                last_synced_at=max((item.updated_at for item in connected), default=None),
            )
        )
    return result


def entity_graph(session: Session, limit: int = 30) -> list[KnowledgeEntityRead]:
    grouped: dict[str, list[KnowledgeItem]] = defaultdict(list)
    for item in Repositories.from_session(session).knowledge.list():
        for entity in item.entities:
            grouped[entity].append(item)
    result = [
        KnowledgeEntityRead(
            entity=entity,
            item_count=len(items),
            source_types=sorted({item.source_type for item in items}),
            last_seen_at=max(item.timestamp for item in items),
            item_ids=[item.id for item in items[:5]],
        )
        for entity, items in grouped.items()
    ]
    result.sort(key=lambda item: (-item.item_count, -item.last_seen_at.timestamp(), item.entity))
    return result[:limit]
