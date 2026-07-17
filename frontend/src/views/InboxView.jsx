import PolicyCard from '../components/PolicyCard'

export default function InboxView({ candidates, extracting, busyIds, onExtract, onApprove, onReject }) {
  return (
    <main className="view" id="main-content">
      <section className="view-intro">
        <div>
          <span className="section-kicker">Policy inbox</span>
          <h1>Turn operating signals into governed rules.</h1>
          <p>
            Bullyx finds recurring decisions across messy source material. Nothing becomes executable until a human verifies the evidence.
          </p>
        </div>
        <button className="button button--extract" disabled={extracting} type="button" onClick={onExtract}>
          <span className="button-spark" aria-hidden="true">✦</span>
          {extracting ? 'Mining source patterns…' : 'Extract policies'}
        </button>
      </section>

      <section className="inbox-toolbar" aria-label="Inbox summary">
        <div>
          <strong>{candidates.length}</strong>
          <span>Awaiting review</span>
        </div>
        <p>Every candidate includes executable conditions, an action, approvals, and source-level evidence.</p>
      </section>

      {candidates.length ? (
        <div className="policy-list">
          {candidates.map((policy) => (
            <PolicyCard
              busy={busyIds.has(policy.id)}
              key={policy.id}
              mode="candidate"
              onApprove={onApprove}
              onReject={onReject}
              policy={policy}
            />
          ))}
        </div>
      ) : (
        <section className="empty-state">
          <div className="empty-orbit" aria-hidden="true"><span>✦</span></div>
          <span className="section-kicker">Ready to mine</span>
          <h2>Your review queue is clear.</h2>
          <p>Run extraction to turn 40 Slack messages, tickets, and working documents into evidence-backed candidate rules.</p>
          <button className="button button--primary" disabled={extracting} type="button" onClick={onExtract}>
            {extracting ? 'Extracting…' : 'Extract from source library'}
          </button>
        </section>
      )}
    </main>
  )
}
