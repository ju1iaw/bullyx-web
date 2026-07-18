import { useEffect, useRef, useState } from 'react'
import DemoRequestModal from './DemoRequestModal'
import './MarketingSite.css'

const Arrow = () => <span aria-hidden="true">↗</span>

function Reveal({ children, className = '' }) {
  const ref = useRef(null)
  useEffect(() => {
    const node = ref.current
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { node.classList.add('is-visible'); observer.disconnect() }
    }, { threshold: .12 })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return <div ref={ref} className={`bx-reveal ${className}`}>{children}</div>
}

export default function MarketingSite() {
  const [menu, setMenu] = useState(false)
  const [activeStep, setActiveStep] = useState(0)
  const [demoOpen, setDemoOpen] = useState(false)

  const steps = [
    ['01', 'Extract', 'Turn scattered guidance into structured candidate policies, each tied to its original evidence.'],
    ['02', 'Govern', 'Put every rule through a human approval gate with edits, ownership, and version history.'],
    ['03', 'Decide', 'Evaluate only approved rules at runtime. No model calls, no hidden judgment, no surprises.'],
    ['04', 'Prove', 'Record every outcome in a tamper-evident audit chain your team can independently verify.'],
  ]

  function openDemo() {
    setMenu(false)
    setDemoOpen(true)
  }

  return (
    <div className="bx-site">
      <header className="bx-nav">
        <a className="bx-logo" href="#top" aria-label="BullyX home">
          <img src="/bullyx-logo-light.png" alt="BullyX" width="140" height="105" />
        </a>
        <nav className={menu ? 'open' : ''} aria-label="Main navigation">
          <a href="#platform" onClick={() => setMenu(false)}>Platform</a>
          <a href="#workflow" onClick={() => setMenu(false)}>How it works</a>
          <a href="#security" onClick={() => setMenu(false)}>Security</a>
        </nav>
        <button className="bx-nav-cta" type="button" onClick={openDemo}>Request a demo <Arrow /></button>
        <button className="bx-menu" onClick={() => setMenu(!menu)} aria-label="Toggle menu"><span/><span/></button>
      </header>

      <main id="top">
        <section className="bx-hero">
          <div className="bx-grid" />
          <div className="bx-orbit bx-orbit-a"/><div className="bx-orbit bx-orbit-b"/>
          <div className="bx-hero-copy">
            <div className="bx-eyebrow"><span /> Built exclusively for financial companies</div>
            <h1>Give every AI agent<br/><em>rules it can’t ignore.</em></h1>
            <p>BullyX is AI policy infrastructure for banks, fintechs, and other financial institutions — turning operational knowledge into governed, executable rules every automated decision must follow.</p>
            <div className="bx-actions">
              <button className="bx-primary" type="button" onClick={openDemo}>Request a demo <Arrow /></button>
              <a className="bx-text-link" href="#workflow">See how it works <span>↓</span></a>
            </div>
          </div>
          <div className="bx-hero-viz" aria-label="Animated governed decision visualization">
            <div className="bx-viz-top"><span><i/> POLICY ENGINE</span><b>LIVE</b></div>
            <div className="bx-policy-card bx-p1"><small>INPUT SIGNAL</small><strong>Dispute · $320 · US</strong><span>Source verified</span></div>
            <div className="bx-flow-line"><i/><i/><i/></div>
            <div className="bx-policy-card bx-p2"><small>RULE MATCH · v2.1</small><strong>Provisional credit</strong><span className="green">Human approved</span></div>
            <div className="bx-decision"><div><small>DECISION</small><strong>APPROVED</strong></div><b>✓</b></div>
            <div className="bx-hash">0x7f3a...91c2 <span>CHAIN INTACT</span></div>
          </div>
          <div className="bx-trust"><span>ONLY FOR FINANCIAL COMPANIES</span><div/><b>BANKS</b><b>FINTECH</b><b>PAYMENTS</b><b>CAPITAL MARKETS</b></div>
        </section>

        <section className="bx-problem" id="platform">
          <Reveal className="bx-section-intro"><span className="bx-number">01 / THE PROBLEM</span><h2>AI moves fast.<br/>Financial governance usually doesn’t.</h2><p>In financial companies, policies live in documents, tickets, and people’s heads — while agents operate in milliseconds. BullyX closes that gap for regulated finance teams only.</p></Reveal>
          <Reveal className="bx-stat-grid">
            <article><strong>100%</strong><span>of runtime decisions use approved, structured rules</span></article>
            <article><strong>0</strong><span>model calls in the deterministic decision path</span></article>
            <article><strong>∞</strong><span>verifiable history with append-only audit evidence</span></article>
          </Reveal>
        </section>

        <section className="bx-workflow" id="workflow">
          <Reveal className="bx-section-intro light"><span className="bx-number">02 / THE SYSTEM</span><h2>From messy knowledge<br/>to governed action.</h2></Reveal>
          <Reveal className="bx-workflow-layout">
            <div className="bx-step-list">
              {steps.map((step, i) => <button key={step[1]} className={activeStep === i ? 'active' : ''} onMouseEnter={() => setActiveStep(i)} onFocus={() => setActiveStep(i)} onClick={() => setActiveStep(i)}><span>{step[0]}</span><strong>{step[1]}</strong><i>→</i></button>)}
            </div>
            <div className="bx-step-stage">
              <div className="bx-stage-label">BULLYX / GOVERNANCE PIPELINE</div>
              <span className="bx-stage-num">{steps[activeStep][0]}</span>
              <h3>{steps[activeStep][1]}</h3><p>{steps[activeStep][2]}</p>
              <div className="bx-stage-meter"><span style={{width: `${(activeStep + 1) * 25}%`}}/></div>
            </div>
          </Reveal>
        </section>

        <section className="bx-control" id="security">
          <Reveal className="bx-control-copy"><span className="bx-number">03 / CONTROL BY DESIGN</span><h2>Your rules.<br/>Your evidence.<br/><em>Your control.</em></h2><p>Built for financial operations — disputes, credit, payments, and compliance workflows. AI can propose. Humans approve. Software enforces.</p><button className="bx-dark-link" type="button" onClick={openDemo}>Request a demo <Arrow /></button></Reveal>
          <Reveal className="bx-ledger">
            <div className="bx-ledger-head"><span>AUDIT LEDGER</span><b><i/> VERIFIED</b></div>
            {[['#0042','PROVISIONAL CREDIT','POLICY v2.1'],['#0041','MANUAL REVIEW','POLICY v1.4'],['#0040','DECLINE','POLICY v3.0']].map((r,i)=><div className="bx-ledger-row" key={r[0]} style={{'--delay': `${i*.12}s`}}><span>{r[0]}</span><strong>{r[1]}</strong><small>{r[2]}</small><b>✓</b></div>)}
            <div className="bx-ledger-chain"><span>PREVIOUS HASH</span><code>8e91b72c...44fa</code><i>LINKED</i></div>
          </Reveal>
        </section>

        <section className="bx-final">
          <div className="bx-final-grid"/><Reveal><span>FOR FINANCIAL COMPANIES ONLY</span><h2>Make your policy<br/>executable.</h2><button type="button" onClick={openDemo}>Request a demo <Arrow /></button></Reveal>
        </section>
      </main>
      <footer>
        <a className="bx-logo" href="#top" aria-label="BullyX home">
          <img src="/bullyx-logo-light.png" alt="BullyX" width="120" height="90" />
        </a>
        <p>Governed AI policy infrastructure — exclusively for financial companies.</p>
        <span>© 2026 BULLYX, INC.</span>
      </footer>
      <DemoRequestModal open={demoOpen} onClose={() => setDemoOpen(false)} />
    </div>
  )
}
