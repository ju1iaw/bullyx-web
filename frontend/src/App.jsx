import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import AuditView from './views/AuditView'
import InboxView from './views/InboxView'
import RulebookView from './views/RulebookView'
import './App.css'
import MarketingSite from './MarketingSite'

const views = [
  { id: 'inbox', label: 'Policy Inbox' },
  { id: 'rulebook', label: 'Active Rulebook' },
  { id: 'audit', label: 'Audit' },
]

function ConsoleApp() {
  const [view, setView] = useState('inbox')
  const [health, setHealth] = useState(null)
  const [sources, setSources] = useState([])
  const [candidates, setCandidates] = useState([])
  const [approved, setApproved] = useState([])
  const [audit, setAudit] = useState([])
  const [verification, setVerification] = useState(null)
  const [initializing, setInitializing] = useState(true)
  const [extracting, setExtracting] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [busyIds, setBusyIds] = useState(new Set())
  const [toast, setToast] = useState(null)
  const [fatalError, setFatalError] = useState('')

  const loadAll = useCallback(async () => {
    try {
      const [nextHealth, nextSources, nextCandidates, nextApproved, nextAudit, nextVerification] = await Promise.all([
        api.health(),
        api.sources(),
        api.policies('candidate'),
        api.policies('approved'),
        api.audit(),
        api.verifyAudit(),
      ])
      setHealth(nextHealth)
      setSources(nextSources)
      setCandidates(nextCandidates)
      setApproved(nextApproved)
      setAudit(nextAudit)
      setVerification(nextVerification)
      setFatalError('')
    } catch (error) {
      setFatalError(error.message)
    } finally {
      setInitializing(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  useEffect(() => {
    if (!toast) return undefined
    const timeout = window.setTimeout(() => setToast(null), 4000)
    return () => window.clearTimeout(timeout)
  }, [toast])

  function notify(message, tone = 'success') {
    setToast({ message, tone })
  }

  function markBusy(id, busy) {
    setBusyIds((current) => {
      const next = new Set(current)
      if (busy) next.add(id)
      else next.delete(id)
      return next
    })
  }

  async function extractPolicies() {
    setExtracting(true)
    try {
      const result = await api.extract()
      await loadAll()
      notify(
        result.created_count
          ? `${result.created_count} evidence-backed policies added to the review queue.`
          : 'Extraction is up to date. No duplicate candidates were created.',
      )
    } catch (error) {
      notify(error.message, 'error')
    } finally {
      setExtracting(false)
    }
  }

  async function approvePolicy(id, payload = {}) {
    markBusy(id, true)
    try {
      const policy = await api.approve(id, payload)
      await loadAll()
      notify(`${policy.title} is active as version ${policy.version}.`)
      return policy
    } catch (error) {
      notify(error.message, 'error')
      throw error
    } finally {
      markBusy(id, false)
    }
  }

  async function rejectPolicy(id) {
    markBusy(id, true)
    try {
      const policy = await api.reject(id)
      await loadAll()
      notify(`${policy.title} was rejected and removed from the queue.`)
    } catch (error) {
      notify(error.message, 'error')
    } finally {
      markBusy(id, false)
    }
  }

  async function verifyChain() {
    setVerifying(true)
    try {
      const result = await api.verifyAudit()
      setVerification(result)
      setAudit(await api.audit())
      notify(result.valid ? 'Every audit hash recomputed successfully.' : 'Audit chain verification failed.', result.valid ? 'success' : 'error')
    } catch (error) {
      notify(error.message, 'error')
    } finally {
      setVerifying(false)
    }
  }

  async function refreshAudit() {
    const [nextAudit, nextVerification] = await Promise.all([api.audit(), api.verifyAudit()])
    setAudit(nextAudit)
    setVerification(nextVerification)
  }

  if (initializing) {
    return (
      <div className="loading-screen">
        <div className="brand-mark brand-mark--large">B</div>
        <span className="section-kicker">Bullyx is starting</span>
        <h1>Loading the governed rulebook…</h1>
        <div className="loading-line"><span /></div>
      </div>
    )
  }

  if (fatalError) {
    return (
      <div className="loading-screen loading-screen--error">
        <div className="brand-mark brand-mark--large">B</div>
        <span className="section-kicker">Backend unavailable</span>
        <h1>Bullyx could not reach the policy service.</h1>
        <p>{fatalError}</p>
        <button className="button button--primary" type="button" onClick={loadAll}>Try again</button>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="topbar">
        <button className="brand" type="button" onClick={() => setView('inbox')} aria-label="Bullyx home">
          <span className="brand-mark">B</span>
          <span>
            <strong>BULLYX</strong>
            <small>Policy control plane</small>
          </span>
        </button>
        <nav aria-label="Primary navigation">
          {views.map((item) => (
            <button className={view === item.id ? 'nav-item nav-item--active' : 'nav-item'} key={item.id} type="button" onClick={() => setView(item.id)}>
              {item.label}
              {item.id === 'inbox' && candidates.length > 0 && <span>{candidates.length}</span>}
            </button>
          ))}
        </nav>
        <div className="environment-status">
          <span className="status-dot" />
          <div><strong>Local demo</strong><small>{health?.llm_provider === 'deterministic-mock' ? 'Offline extractor' : health?.llm_provider}</small></div>
        </div>
      </header>

      <aside className="context-rail" aria-label="System summary">
        <div className="context-rail__label">Governance pulse</div>
        <div className="metric"><strong>{health?.source_documents ?? sources.length}</strong><span>Source signals</span></div>
        <div className="metric"><strong>{approved.length}</strong><span>Active policies</span></div>
        <div className="metric"><strong>{audit.length}</strong><span>Logged decisions</span></div>
        <div className={`rail-integrity ${verification?.valid ? 'rail-integrity--valid' : ''}`}>
          <span>{verification?.valid ? '✓' : '!'}</span>
          <div><strong>{verification?.valid ? 'Chain intact' : 'Check chain'}</strong><small>{verification?.entries_checked || 0} entries verified</small></div>
        </div>
        <div className="rail-flow" aria-label="Bullyx workflow">
          <span className={view === 'inbox' ? 'active' : ''}>01 <em>Extract</em></span>
          <i />
          <span className={view === 'rulebook' ? 'active' : ''}>02 <em>Govern</em></span>
          <i />
          <span className={view === 'audit' ? 'active' : ''}>03 <em>Prove</em></span>
        </div>
      </aside>

      <div className="content-shell">
        {view === 'inbox' && (
          <InboxView candidates={candidates} extracting={extracting} busyIds={busyIds} onExtract={extractPolicies} onApprove={approvePolicy} onReject={rejectPolicy} />
        )}
        {view === 'rulebook' && (
          <RulebookView policies={approved} sources={sources} busyIds={busyIds} onApprove={approvePolicy} onDecisionLogged={refreshAudit} />
        )}
        {view === 'audit' && (
          <AuditView entries={audit} verification={verification} verifying={verifying} onVerify={verifyChain} />
        )}
      </div>

      {toast && <div className={`toast toast--${toast.tone}`} role="status"><span>{toast.tone === 'success' ? '✓' : '!'}</span>{toast.message}</div>}
    </div>
  )
}

export default function App() {
  const params = new URLSearchParams(window.location.search)
  return params.has('console') ? <ConsoleApp /> : <MarketingSite />
}
