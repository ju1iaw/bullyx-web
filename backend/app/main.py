from __future__ import annotations

import uuid
from contextlib import asynccontextmanager
from typing import Any

from fastapi import Body, Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .brain import analyze_situation
from .config import cors_origins, database_url
from .db import Database
from .extraction import extract_candidates
from .knowledge import (
    connector_status,
    entity_graph,
    ingest_knowledge,
    search_knowledge,
    seed_company_knowledge,
)
from .llm import LLMError, provider_name
from .models import BrainFeedbackEntry, CandidatePolicy, PolicyRevision, utc_now
from .repositories import Repositories
from .rules import select_policy
from .schemas import (
    ApprovalRequest,
    AuditLogRead,
    AuditVerification,
    BrainAnalyzeRequest,
    BrainBrief,
    BrainFeedbackRead,
    BrainFeedbackRequest,
    DecisionResponse,
    ExtractionResult,
    KnowledgeConnectorRead,
    KnowledgeEntityRead,
    KnowledgeIngestRequest,
    KnowledgeIngestResult,
    KnowledgeItemRead,
    KnowledgeSearchHit,
    KnowledgeSearchRequest,
    PolicyRead,
    PolicyRevisionRead,
    PolicyRule,
    RejectRequest,
    SourceDocumentRead,
)
from .seed import seed_sources


def create_app(db_url: str | None = None) -> FastAPI:
    database = Database(db_url or database_url())

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        database.initialize()
        with database.session() as session:
            seed_sources(session)
            seed_company_knowledge(session)
        try:
            yield
        finally:
            database.engine.dispose()

    app = FastAPI(
        title="Bullyx Policy API",
        version="0.1.0",
        description="Governed, evidence-linked operational policies for AI agents.",
        lifespan=lifespan,
    )
    app.state.database = database
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    def get_session(request: Request):
        with request.app.state.database.session() as session:
            yield session

    def render_policy(policy: CandidatePolicy, repositories: Repositories) -> PolicyRead:
        return PolicyRead(
            id=policy.id,
            title=policy.title,
            rule_text=policy.rule_text,
            structured_rule=PolicyRule.model_validate(policy.structured_rule),
            status=policy.status,
            evidence=policy.evidence,
            evidence_documents=[
                SourceDocumentRead.model_validate(document)
                for document in repositories.sources.get_many(policy.evidence)
            ],
            rationale=policy.rationale,
            version=policy.version,
            created_at=policy.created_at,
            updated_at=policy.updated_at,
        )

    @app.get("/")
    def root() -> dict[str, Any]:
        return {
            "service": "Bullyx Policy API",
            "status": "ready",
            "docs": "/docs",
            "decision_endpoint": "/decide",
            "brain_endpoint": "/brain/analyze",
            "knowledge_endpoint": "/knowledge/search",
        }

    @app.get("/health")
    def health(session: Session = Depends(get_session)) -> dict[str, Any]:
        repositories = Repositories.from_session(session)
        return {
            "status": "ok",
            "llm_provider": provider_name(),
            "source_documents": repositories.sources.count(),
            "candidate_policies": len(repositories.policies.list("candidate")),
            "approved_policies": len(repositories.policies.list("approved")),
            "audit_entries": len(repositories.audits.list()),
            "brain_feedback": repositories.brain_feedback.count(),
            "knowledge_items": repositories.knowledge.count(),
        }

    @app.get("/sources", response_model=list[SourceDocumentRead])
    def list_sources(session: Session = Depends(get_session)):
        return Repositories.from_session(session).sources.list()

    @app.get("/knowledge/items", response_model=list[KnowledgeItemRead])
    def list_knowledge_items(
        source_type: str | None = Query(default=None),
        limit: int = Query(default=100, ge=1, le=500),
        session: Session = Depends(get_session),
    ):
        source_types = [source_type] if source_type else None
        return Repositories.from_session(session).knowledge.list(
            source_types=source_types,
            limit=limit,
        )

    @app.post("/knowledge/ingest", response_model=KnowledgeIngestResult)
    def knowledge_ingest(
        payload: KnowledgeIngestRequest,
        session: Session = Depends(get_session),
    ):
        return ingest_knowledge(session, payload)

    @app.post("/knowledge/search", response_model=list[KnowledgeSearchHit])
    def knowledge_search(
        payload: KnowledgeSearchRequest,
        session: Session = Depends(get_session),
    ):
        return search_knowledge(session, payload)

    @app.get("/knowledge/connectors", response_model=list[KnowledgeConnectorRead])
    def knowledge_connectors(session: Session = Depends(get_session)):
        return connector_status(session)

    @app.get("/knowledge/entities", response_model=list[KnowledgeEntityRead])
    def knowledge_entities(
        limit: int = Query(default=30, ge=1, le=100),
        session: Session = Depends(get_session),
    ):
        return entity_graph(session, limit)

    @app.get("/policies", response_model=list[PolicyRead])
    def list_policies(
        session: Session = Depends(get_session),
        status: str | None = Query(default=None),
    ):
        if status and status not in {"candidate", "approved", "rejected", "edited"}:
            raise HTTPException(status_code=422, detail="Unknown policy status")
        repositories = Repositories.from_session(session)
        return [render_policy(policy, repositories) for policy in repositories.policies.list(status)]

    @app.get("/policies/{policy_id}", response_model=PolicyRead)
    def get_policy(policy_id: str, session: Session = Depends(get_session)):
        repositories = Repositories.from_session(session)
        policy = repositories.policies.get(policy_id)
        if not policy:
            raise HTTPException(status_code=404, detail="Policy not found")
        return render_policy(policy, repositories)

    @app.post("/extract", response_model=ExtractionResult)
    def extract(session: Session = Depends(get_session)):
        try:
            run = extract_candidates(session)
        except LLMError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        repositories = Repositories.from_session(session)
        return ExtractionResult(
            provider=run.provider,
            created_count=run.created_count,
            candidates=[render_policy(policy, repositories) for policy in run.policies],
        )

    @app.post("/policies/{policy_id}/approve", response_model=PolicyRead)
    def approve_policy(
        policy_id: str,
        session: Session = Depends(get_session),
        payload: ApprovalRequest = Body(default=ApprovalRequest()),
    ):
        repositories = Repositories.from_session(session)
        policy = repositories.policies.get(policy_id)
        if not policy:
            raise HTTPException(status_code=404, detail="Policy not found")
        title = payload.title or policy.title
        rule_text = payload.rule_text or policy.rule_text
        structured_rule = (
            payload.structured_rule.model_dump(mode="json")
            if payload.structured_rule
            else policy.structured_rule
        )
        evidence = payload.evidence or policy.evidence
        rationale = payload.rationale or policy.rationale
        known_evidence = {document.id for document in repositories.sources.get_many(evidence)}
        if not evidence or known_evidence != set(evidence):
            raise HTTPException(
                status_code=422, detail="Every evidence id must reference a source document"
            )
        PolicyRule.model_validate(structured_rule)
        changed = any(
            [
                title != policy.title,
                rule_text != policy.rule_text,
                structured_rule != policy.structured_rule,
                evidence != policy.evidence,
                rationale != policy.rationale,
            ]
        )
        if policy.status == "approved" and not changed:
            return render_policy(policy, repositories)
        next_version = 1 if policy.version == 0 else policy.version + 1
        policy.title = title
        policy.rule_text = rule_text
        policy.structured_rule = structured_rule
        policy.evidence = evidence
        policy.rationale = rationale
        policy.version = next_version
        policy.status = "approved"
        policy.updated_at = utc_now()
        repositories.policies.add_revision(
            PolicyRevision(
                policy_id=policy.id,
                version=next_version,
                title=title,
                rule_text=rule_text,
                structured_rule=structured_rule,
                evidence=evidence,
                rationale=rationale,
                change_note=payload.change_note
                or ("Edited and approved" if changed else "Approved"),
            )
        )
        session.commit()
        return render_policy(policy, repositories)

    @app.post("/policies/{policy_id}/reject", response_model=PolicyRead)
    def reject_policy(
        policy_id: str,
        payload: RejectRequest,
        session: Session = Depends(get_session),
    ):
        repositories = Repositories.from_session(session)
        policy = repositories.policies.get(policy_id)
        if not policy:
            raise HTTPException(status_code=404, detail="Policy not found")
        policy.status = "rejected"
        policy.updated_at = utc_now()
        if payload.reason:
            policy.rationale = f"{policy.rationale}\n\nRejection note: {payload.reason}"
        session.commit()
        return render_policy(policy, repositories)

    @app.get(
        "/policies/{policy_id}/history", response_model=list[PolicyRevisionRead]
    )
    def policy_history(policy_id: str, session: Session = Depends(get_session)):
        repositories = Repositories.from_session(session)
        if not repositories.policies.get(policy_id):
            raise HTTPException(status_code=404, detail="Policy not found")
        return repositories.policies.history(policy_id)

    @app.post("/decide", response_model=DecisionResponse)
    def decide(
        session: Session = Depends(get_session),
        situation: dict[str, Any] = Body(...),
    ):
        if not situation:
            raise HTTPException(status_code=422, detail="Situation must not be empty")
        repositories = Repositories.from_session(session)
        match = select_policy(repositories.policies.list("approved"), situation)
        if match.policy and match.rule:
            rationale = (
                f'Matched "{match.policy.title}" because all '
                f"{len(match.rule.conditions)} conditions were satisfied. "
                f"Selected from {match.matched_count} matching approved "
                "policies by specificity, then restrictiveness. "
                f"{match.policy.rationale}"
            )
            response = DecisionResponse(
                decision=match.rule.action,
                required_approvals=match.rule.required_approvals,
                matched_policy_id=match.policy.id,
                policy_version=match.policy.version,
                evidence=match.policy.evidence,
                rationale=rationale,
            )
        else:
            response = DecisionResponse(
                decision="no governing policy — escalate to human",
                required_approvals=["human_reviewer"],
                matched_policy_id=None,
                policy_version=None,
                evidence=[],
                rationale="No approved policy matched every condition in this situation.",
            )
        decision_payload = response.model_dump(mode="json")
        repositories.audits.append(
            query_input=situation,
            matched_policy_id=response.matched_policy_id,
            policy_version=response.policy_version,
            decision=decision_payload,
            evidence_ids=response.evidence,
        )
        session.commit()
        return response

    @app.post("/brain/analyze", response_model=BrainBrief)
    def brain_analyze(
        payload: BrainAnalyzeRequest,
        session: Session = Depends(get_session),
    ):
        try:
            return analyze_situation(session, payload)
        except LLMError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        except (TypeError, ValueError) as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    @app.post("/brain/feedback", response_model=BrainFeedbackRead, status_code=201)
    def brain_feedback(
        payload: BrainFeedbackRequest,
        session: Session = Depends(get_session),
    ):
        repositories = Repositories.from_session(session)
        entry = BrainFeedbackEntry(
            id=f"feedback-{uuid.uuid4().hex[:16]}",
            analysis_id=payload.analysis_id,
            message=payload.message,
            understood_facts=payload.understood_facts,
            recommendation=payload.recommendation,
            rating=payload.rating,
            note=payload.note,
        )
        repositories.brain_feedback.add(entry)
        session.commit()
        return entry

    @app.get("/brain/feedback", response_model=list[BrainFeedbackRead])
    def list_brain_feedback(
        limit: int = Query(default=50, ge=1, le=200),
        session: Session = Depends(get_session),
    ):
        return Repositories.from_session(session).brain_feedback.list(limit)

    @app.get("/audit", response_model=list[AuditLogRead])
    def audit(session: Session = Depends(get_session)):
        return Repositories.from_session(session).audits.list()

    @app.get("/audit/verify", response_model=AuditVerification)
    def verify_audit(session: Session = Depends(get_session)):
        return Repositories.from_session(session).audits.verify()

    return app


app = create_app()
