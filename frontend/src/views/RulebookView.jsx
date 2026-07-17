import { useMemo, useState } from 'react'
import PolicyCard from '../components/PolicyCard'
import EvidenceList from '../components/EvidenceList'
import { api } from '../api'
import { humanize } from '../utils'

const initialSituation = {
  dispute_type: 'unauthorized',
  amount: '320',
  account_age_days: '200',
  region: 'US',
  days_since_transaction: '15',
  prior_similar_disputes: '0',
  merchant_contacted: false,
}

export default function RulebookView({ policies, sources, busyIds, onApprove, onDecisionLogged }) {
  const [situation, setSituation] = useState(initialSituation)
  const [decision, setDecision] = useState(null)
  const [deciding, setDeciding] = useState(false)
  const [error, setError] = useState('')

  const sourceById = useMemo(
    () => Object.fromEntries(sources.map((source) => [source.id, source])),
    [sources],
  )
  const decisionEvidence = decision?.evidence.map((id) => sourceById[id]).filter(Boolean) || []

  function updateField(name, value) {
    setSituation((current) => ({ ...current, [name]: value }))
  }

  async function submitDecision(event) {
    event.preventDefault()
    setDeciding(true)
    setError('')
    try {
      const numericFields = ['amount', 'account_age_days', 'days_since_transaction', 'prior_similar_disputes']
      const payload = { ...situation }
      numericFields.forEach((field) => {
        payload[field] = Number(payload[field])
      })
      payload.outside_filing_window =
        (payload.region === 'EU' && payload.days_since_transaction > 60) ||
        (payload.region === 'US' && payload.days_since_transaction > 30)
      const nextDecision = await api.decide(payload)
      setDecision(nextDecision)
      onDecisionLogged()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setDeciding(false)
    }
  }

  return (
    <main className="view" id="main-content">
      <section className="view-intro view-intro--compact">
        <div>
          <span className="section-kicker">Active rulebook</span>
          <h1>Approved policy, ready at runtime.</h1>
          <p>Only these human-approved versions can govern an agent decision. Every change creates a new version.</p>
        </div>
        <div className="live-badge"><span /> {policies.length} executable {policies.length === 1 ? 'rule' : 'rules'}</div>
      </section>

      <section className="decision-lab">
        <div className="decision-lab__header">
          <div>
            <span className="section-kicker">Runtime decision console</span>
            <h2>Try a governed decision</h2>
            <p>No model call here. Bullyx evaluates approved JSON rules deterministically.</p>
          </div>
          <code>POST /decide</code>
        </div>
        <div className="decision-grid">
          <form className="decision-form" onSubmit={submitDecision}>
            <label>
              Dispute type
              <select value={situation.dispute_type} onChange={(event) => updateField('dispute_type', event.target.value)}>
                <option value="unauthorized">Unauthorized</option>
                <option value="friendly_fraud">Friendly fraud</option>
                <option value="duplicate_charge">Duplicate charge</option>
                <option value="atm_cash_not_received">ATM cash not received</option>
              </select>
            </label>
            <label>
              Amount (USD)
              <input min="0" step="0.01" type="number" value={situation.amount} onChange={(event) => updateField('amount', event.target.value)} required />
            </label>
            <label>
              Account age (days)
              <input min="0" type="number" value={situation.account_age_days} onChange={(event) => updateField('account_age_days', event.target.value)} required />
            </label>
            <label>
              Region
              <select value={situation.region} onChange={(event) => updateField('region', event.target.value)}>
                <option value="US">US</option>
                <option value="EU">EU</option>
                <option value="UK">UK</option>
                <option value="CA">Canada</option>
              </select>
            </label>
            <label>
              Days since transaction
              <input min="0" type="number" value={situation.days_since_transaction} onChange={(event) => updateField('days_since_transaction', event.target.value)} required />
            </label>
            <label>
              Prior similar disputes
              <input min="0" type="number" value={situation.prior_similar_disputes} onChange={(event) => updateField('prior_similar_disputes', event.target.value)} required />
            </label>
            <label className="checkbox-field">
              <input type="checkbox" checked={situation.merchant_contacted} onChange={(event) => updateField('merchant_contacted', event.target.checked)} />
              <span>Customer contacted merchant</span>
            </label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="button button--primary decision-submit" disabled={deciding} type="submit">
              {deciding ? 'Evaluating rules…' : 'Run governed decision'}
            </button>
          </form>

          <div className={`decision-output ${decision ? 'decision-output--ready' : ''}`}>
            {!decision ? (
              <div className="decision-placeholder">
                <span className="decision-glyph" aria-hidden="true">⌁</span>
                <h3>Decision output</h3>
                <p>Submit the sample dispute to see the winning policy, required approvals, rationale, and exact evidence.</p>
              </div>
            ) : (
              <div className="decision-result">
                <span className="section-kicker">Governed outcome</span>
                <h3>{humanize(decision.decision)}</h3>
                <div className="decision-facts">
                  <div><span>Policy</span><strong>{decision.matched_policy_id || 'No match'}</strong></div>
                  <div><span>Version</span><strong>{decision.policy_version ? `v${decision.policy_version}` : '—'}</strong></div>
                  <div><span>Approvals</span><strong>{decision.required_approvals.length ? decision.required_approvals.map(humanize).join(', ') : 'None'}</strong></div>
                </div>
                <p className="decision-rationale">{decision.rationale}</p>
                <div className="audit-written"><span>✓</span> Decision appended to the audit chain</div>
                {decisionEvidence.length > 0 && (
                  <details className="decision-evidence">
                    <summary>View cited evidence ({decisionEvidence.length})</summary>
                    <EvidenceList compact documents={decisionEvidence} />
                  </details>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rulebook-heading">
        <div>
          <span className="section-kicker">Executable inventory</span>
          <h2>Policy versions in force</h2>
        </div>
        <p>{policies.length ? 'Ordered by most recently approved.' : 'Approve candidates to activate this rulebook.'}</p>
      </section>

      {policies.length ? (
        <div className="policy-list">
          {policies.map((policy) => (
            <PolicyCard busy={busyIds.has(policy.id)} key={policy.id} mode="active" onApprove={onApprove} policy={policy} />
          ))}
        </div>
      ) : (
        <section className="empty-state empty-state--small">
          <h2>No active policy yet.</h2>
          <p>Review and approve candidates in the Policy Inbox before calling the runtime decision API.</p>
        </section>
      )}
    </main>
  )
}
