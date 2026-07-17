import { useEffect, useState } from 'react'
import { api } from '../api'
import { formatDate } from '../utils'
import EvidenceList from './EvidenceList'
import RuleSummary from './RuleSummary'

export default function PolicyCard({
  policy,
  mode = 'candidate',
  busy = false,
  onApprove,
  onReject,
}) {
  const [showEvidence, setShowEvidence] = useState(false)
  const [editing, setEditing] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [editError, setEditError] = useState('')
  const [draft, setDraft] = useState({
    title: policy.title,
    rule_text: policy.rule_text,
    structured_rule: JSON.stringify(policy.structured_rule, null, 2),
    rationale: policy.rationale,
    change_note: '',
  })

  useEffect(() => {
    setDraft({
      title: policy.title,
      rule_text: policy.rule_text,
      structured_rule: JSON.stringify(policy.structured_rule, null, 2),
      rationale: policy.rationale,
      change_note: '',
    })
  }, [policy])

  async function submitEdit(event) {
    event.preventDefault()
    setEditError('')
    try {
      const structuredRule = JSON.parse(draft.structured_rule)
      await onApprove(policy.id, {
        title: draft.title,
        rule_text: draft.rule_text,
        structured_rule: structuredRule,
        rationale: draft.rationale,
        change_note:
          draft.change_note ||
          (mode === 'active' ? 'Rule edited and re-approved' : 'Edited during review'),
      })
      setEditing(false)
    } catch (error) {
      setEditError(error instanceof SyntaxError ? 'Structured rule must be valid JSON.' : error.message)
    }
  }

  async function toggleHistory() {
    const next = !showHistory
    setShowHistory(next)
    if (next && !history.length) {
      setHistoryLoading(true)
      try {
        setHistory(await api.history(policy.id))
      } finally {
        setHistoryLoading(false)
      }
    }
  }

  return (
    <article className={`policy-card policy-card--${mode}`}>
      <header className="policy-card__header">
        <div className="policy-index" aria-hidden="true">
          {mode === 'active' ? `v${policy.version}` : 'AI'}
        </div>
        <div className="policy-title-block">
          <div className="eyebrow-row">
            <span className={`status-pill status-pill--${policy.status}`}>{policy.status}</span>
            <span>{policy.evidence.length} linked sources</span>
            {mode === 'active' && <span>Approved {formatDate(policy.updated_at)}</span>}
          </div>
          <h3>{policy.title}</h3>
          <p className="rule-text">{policy.rule_text}</p>
        </div>
      </header>

      <RuleSummary rule={policy.structured_rule} />

      <div className="rationale">
        <span>Why Bullyx inferred this</span>
        <p>{policy.rationale}</p>
      </div>

      <div className="policy-card__actions">
        <button className="text-button" type="button" onClick={() => setShowEvidence(!showEvidence)}>
          {showEvidence ? 'Hide evidence' : `Inspect evidence (${policy.evidence.length})`}
        </button>
        {mode === 'active' && (
          <button className="text-button" type="button" onClick={toggleHistory}>
            {showHistory ? 'Hide history' : 'Version history'}
          </button>
        )}
        <div className="action-spacer" />
        {mode === 'candidate' && (
          <button className="button button--danger-quiet" disabled={busy} type="button" onClick={() => onReject(policy.id)}>
            Reject
          </button>
        )}
        <button className="button button--secondary" disabled={busy} type="button" onClick={() => setEditing(!editing)}>
          {editing ? 'Cancel edit' : mode === 'active' ? 'Edit rule' : 'Edit'}
        </button>
        {mode === 'candidate' && (
          <button className="button button--primary" disabled={busy} type="button" onClick={() => onApprove(policy.id)}>
            {busy ? 'Saving…' : 'Approve policy'}
          </button>
        )}
      </div>

      {editing && (
        <form className="edit-panel" onSubmit={submitEdit}>
          <div className="edit-heading">
            <div>
              <span className="section-kicker">Human-in-the-loop edit</span>
              <h4>{mode === 'active' ? `Create version ${policy.version + 1}` : 'Edit before approval'}</h4>
            </div>
            <span className="edit-lock">Evidence remains linked</span>
          </div>
          <label>
            Policy title
            <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} required />
          </label>
          <label>
            Plain-English rule
            <textarea rows="3" value={draft.rule_text} onChange={(event) => setDraft({ ...draft, rule_text: event.target.value })} required />
          </label>
          <label>
            Structured rule (JSON)
            <textarea className="code-editor" rows="12" spellCheck="false" value={draft.structured_rule} onChange={(event) => setDraft({ ...draft, structured_rule: event.target.value })} required />
          </label>
          <label>
            Rationale
            <textarea rows="3" value={draft.rationale} onChange={(event) => setDraft({ ...draft, rationale: event.target.value })} required />
          </label>
          <label>
            Change note <span className="optional">optional</span>
            <input value={draft.change_note} onChange={(event) => setDraft({ ...draft, change_note: event.target.value })} placeholder="Why this wording or threshold changed" />
          </label>
          {editError && <p className="form-error" role="alert">{editError}</p>}
          <div className="edit-footer">
            <span>This approval creates an immutable version snapshot.</span>
            <button className="button button--primary" disabled={busy} type="submit">
              {busy ? 'Saving…' : mode === 'active' ? `Approve version ${policy.version + 1}` : 'Save & approve'}
            </button>
          </div>
        </form>
      )}

      {showEvidence && (
        <section className="evidence-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">Verifiable provenance</span>
              <h4>Source evidence</h4>
            </div>
            <span>{policy.evidence_documents.length} documents</span>
          </div>
          <EvidenceList documents={policy.evidence_documents} />
        </section>
      )}

      {showHistory && (
        <section className="history-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">Approved snapshots</span>
              <h4>Version history</h4>
            </div>
          </div>
          {historyLoading ? (
            <p className="empty-inline">Loading history…</p>
          ) : (
            <ol className="history-list">
              {history.map((revision) => (
                <li key={revision.id}>
                  <span className="version-marker">v{revision.version}</span>
                  <div>
                    <strong>{revision.change_note}</strong>
                    <p>{revision.rule_text}</p>
                    <time>{formatDate(revision.created_at)}</time>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </article>
  )
}
