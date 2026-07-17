import { formatDate, humanize, shortHash } from '../utils'

export default function AuditView({ entries, verification, verifying, onVerify }) {
  return (
    <main className="view" id="main-content">
      <section className="view-intro view-intro--compact">
        <div>
          <span className="section-kicker">Decision ledger</span>
          <h1>Every outcome leaves a cryptographic trace.</h1>
          <p>Entries are append-only. Each hash commits to the decision payload and the previous record, making silent tampering detectable.</p>
        </div>
        <button className="button button--secondary" disabled={verifying} type="button" onClick={onVerify}>
          {verifying ? 'Recomputing chain…' : 'Verify full chain'}
        </button>
      </section>

      <section className={`integrity-card ${verification?.valid ? 'integrity-card--valid' : 'integrity-card--invalid'}`}>
        <div className="integrity-symbol" aria-hidden="true">{verification?.valid ? '✓' : '!'}</div>
        <div>
          <span className="section-kicker">Chain integrity</span>
          <h2>{verification?.valid ? 'Verified — chain is intact' : 'Verification failed'}</h2>
          <p>
            {verification?.valid
              ? `${verification.entries_checked} ${verification.entries_checked === 1 ? 'entry' : 'entries'} independently recomputed from genesis to head.`
              : `The chain diverges at ${verification?.broken_at || 'an unknown entry'}.`}
          </p>
        </div>
        <div className="head-hash">
          <span>Current head</span>
          <code title={verification?.head_hash || ''}>{shortHash(verification?.head_hash)}</code>
        </div>
      </section>

      <section className="audit-heading">
        <div>
          <span className="section-kicker">Immutable event stream</span>
          <h2>{entries.length} decision{entries.length === 1 ? '' : 's'} recorded</h2>
        </div>
        <div className="chain-legend"><span /> SHA-256 linked</div>
      </section>

      {entries.length ? (
        <ol className="audit-chain">
          {[...entries].reverse().map((entry) => (
            <li className="audit-entry" key={entry.id}>
              <div className="chain-node"><span>{entry.sequence}</span></div>
              <article>
                <header>
                  <div>
                    <span className="audit-time">{formatDate(entry.timestamp)}</span>
                    <h3>{humanize(entry.decision.decision)}</h3>
                  </div>
                  <span className={entry.matched_policy_id ? 'audit-status audit-status--matched' : 'audit-status'}>
                    {entry.matched_policy_id ? 'Policy matched' : 'Human escalation'}
                  </span>
                </header>
                <div className="audit-body">
                  <div className="audit-payload">
                    <span>Query input</span>
                    <pre>{JSON.stringify(entry.query_input, null, 2)}</pre>
                  </div>
                  <div className="audit-details">
                    <dl>
                      <div><dt>Policy</dt><dd>{entry.matched_policy_id || 'No governing policy'}</dd></div>
                      <div><dt>Version</dt><dd>{entry.policy_version ? `v${entry.policy_version}` : '—'}</dd></div>
                      <div><dt>Evidence</dt><dd>{entry.evidence_ids.length ? entry.evidence_ids.join(', ') : 'None'}</dd></div>
                      <div><dt>Approvals</dt><dd>{entry.decision.required_approvals?.map(humanize).join(', ') || 'None'}</dd></div>
                    </dl>
                  </div>
                </div>
                <footer className="hash-row">
                  <div><span>Previous</span><code title={entry.prev_hash}>{shortHash(entry.prev_hash)}</code></div>
                  <span className="hash-arrow">→</span>
                  <div><span>Entry hash</span><code title={entry.hash}>{shortHash(entry.hash)}</code></div>
                </footer>
              </article>
            </li>
          ))}
        </ol>
      ) : (
        <section className="empty-state empty-state--small">
          <h2>No decisions recorded yet.</h2>
          <p>Run a situation through the Active Rulebook. Its governed outcome will appear here immediately.</p>
        </section>
      )}
    </main>
  )
}
