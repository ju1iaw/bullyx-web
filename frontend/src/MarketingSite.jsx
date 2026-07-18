import { useEffect, useRef, useState } from 'react'
import DemoRequestModal from './DemoRequestModal'
import './MarketingSite.css'

const Arrow = () => <span aria-hidden="true">↗</span>

function Reveal({ children, className = '' }) {
  const ref = useRef(null)
  useEffect(() => {
    const node = ref.current
    if (!node || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { node.classList.add('is-visible'); observer.disconnect() }
    }, { threshold: 0.08 })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return <div ref={ref} className={`bx-reveal ${className}`}>{children}</div>
}

const steps = [
  ['01', 'Connect company systems', 'Bring payment data, support conversations, documents, and internal knowledge into a permission-aware workspace.'],
  ['02', 'Register each agent', 'Give each agent a stable identity, owner, status, credential, and narrowly scoped API permissions.'],
  ['03', 'Apply approved policies', 'Evaluate proposals against structured, human-approved rules. Model output is never treated as permission.'],
  ['04', 'Review sensitive actions', 'Show a reviewer the exact proposal, evidence, policy, requester, impact, and required approval.'],
  ['05', 'Execute and record', 'Run only an explicitly implemented capability, then preserve the decision and provider result in a tamper-evident history.'],
]

const capabilities = [
  ['Payment case workspace', 'See the customer, payment, dispute, evidence, deadline, communications, owner, and timeline together.'],
  ['Policy management', 'Turn procedures into reviewed, versioned policies. An authorized person—not a model—activates every rule.'],
  ['Agent management', 'Register agents, issue scoped credentials, assign owners, restrict access, revoke credentials, or disable an agent.'],
  ['Action approvals', 'Approve or reject the exact action proposed, with separation of duties when the requester cannot self-approve.'],
  ['Connections', 'Import from payment, support, communication, document, and engineering systems without automatically enabling writes.'],
  ['Search and Ask', 'Humans can search permitted information or create cited summaries. Neither tool grants execution authority.'],
  ['Audit history', 'Trace evidence, policy decisions, approvals, execution attempts, and provider results through append-only records.'],
  ['Shadow mode', 'Compare agent recommendations with actual human decisions before enabling consequential workflows.'],
]

const principles = [
  'Every agent has its own identity and specifically granted access.',
  'Unknown or ambiguous requests fail closed.',
  'AI-generated text cannot authorize an action.',
  'Approval and execution are separate events.',
  'Requesters cannot approve their own actions when separation of duties is enabled.',
  'Connections stay read-only unless a specific write capability is implemented.',
  'Credentials remain server-side and can be revoked immediately.',
  'Administrators can disable one agent, one capability, or all execution.',
]

export default function MarketingSite() {
  const [menu, setMenu] = useState(false)
  const [demoOpen, setDemoOpen] = useState(false)
  const [activeStep, setActiveStep] = useState(0)

  function closeMenu() { setMenu(false) }
  function openDemo() { closeMenu(); setDemoOpen(true) }

  return (
    <div className="bx-site">
      <header className="bx-nav">
        <a className="bx-logo" href="#top" aria-label="Bullyx home" onClick={closeMenu}>
          <img src="/bullyx-logo-light.png" alt="Bullyx" width="140" height="105" />
        </a>
        <nav className={menu ? 'open' : ''} aria-label="Main navigation">
          <a href="#product" onClick={closeMenu}>Product</a>
          <a href="#how-it-works" onClick={closeMenu}>How it works</a>
          <a href="#security" onClick={closeMenu}>Security</a>
          <a href="#use-case" onClick={closeMenu}>Use cases</a>
        </nav>
        <div className="bx-nav-actions">
          <a className="bx-signin" href="/login">Sign in</a>
          <button className="bx-nav-cta" type="button" onClick={openDemo}>Request a demo <Arrow /></button>
        </div>
        <button className="bx-menu" type="button" onClick={() => setMenu(!menu)} aria-expanded={menu} aria-label="Toggle menu"><span/><span/></button>
      </header>

      <main id="top">
        <section className="bx-hero">
          <div className="bx-hero-copy">
            <div className="bx-eyebrow"><span /> Built for fintech payment operations</div>
            <h1>Let AI agents help with payment operations—<em>without giving up control.</em></h1>
            <p>Bullyx gives every agent a controlled identity, applies your approved policies, routes sensitive actions to people, and records what happened.</p>
            <div className="bx-actions">
              <button className="bx-primary" type="button" onClick={openDemo}>Request a demo <Arrow /></button>
              <a className="bx-secondary" href="#how-it-works">See how it works <span aria-hidden="true">↓</span></a>
            </div>
            <p className="bx-roles">For payment operations, risk, compliance, and engineering teams introducing agents.</p>
          </div>

          <div className="bx-product-shot" aria-label="Payment dispute awaiting human approval">
            <div className="bx-shot-bar"><span>PAYMENT CASE</span><div><i /> Awaiting approval</div></div>
            <div className="bx-case-head">
              <div><small>DISPUTE · PAY-DEMO-0001</small><h2>Order not received</h2><p>Response due Jul 22 · 4 days</p></div>
              <strong>$600.00 <small>USD</small></strong>
            </div>
            <div className="bx-case-grid">
              <div className="bx-case-main">
                <div className="bx-panel-title">Evidence</div>
                <div className="bx-evidence ok"><b>✓</b><span>Customer conversation<small>Imported from support</small></span><em>Ready</em></div>
                <div className="bx-evidence ok"><b>✓</b><span>Payment and dispute<small>Stripe · read-only</small></span><em>Ready</em></div>
                <div className="bx-evidence missing"><b>!</b><span>Proof of delivery<small>Required by policy</small></span><em>Missing</em></div>
                <div className="bx-policy-note"><span>Applicable policy</span><strong>Dispute evidence review · v3</strong><small>Approved by Risk Operations</small></div>
              </div>
              <div className="bx-proposal">
                <div className="bx-panel-title">Agent proposal</div>
                <span className="bx-agent">Agent · disputes-triage-01</span>
                <h3>Request delivery evidence</h3>
                <p>Draft a message asking the customer for proof of delivery before the response deadline.</p>
                <dl><div><dt>Impact</dt><dd>Customer-visible</dd></div><div><dt>Reviewer</dt><dd>Payment Ops</dd></div></dl>
                <button type="button" onClick={openDemo}>Review exact message <span>→</span></button>
              </div>
            </div>
            <div className="bx-shot-foot"><span>API <b>Agent proposes</b></span><span>Dashboard <b>Human decides</b></span></div>
          </div>
        </section>

        <section className="bx-problem" id="product">
          <Reveal className="bx-section-intro">
            <span className="bx-kicker">THE OPERATING PROBLEM</span>
            <h2>One payment case.<br/>Six places to look.</h2>
            <p>Disputes and refunds rarely live in one system. An analyst may check Stripe, Zendesk, Slack, email, documents, fraud tools, and an internal dashboard before deciding what to do.</p>
          </Reveal>
          <Reveal className="bx-system-strip" aria-label="Example company systems">
            {['Payment processor', 'Support', 'Slack + email', 'Documents', 'Fraud + identity', 'Internal tools'].map((item, i) => <div key={item}><span>0{i + 1}</span>{item}</div>)}
          </Reveal>
          <Reveal className="bx-problem-bottom">
            <p>An AI agent can gather and interpret that information. The company still needs a reliable answer to four questions:</p>
            <ol><li>What can it see?</li><li>Which policy applies?</li><li>Who must approve?</li><li>What may actually run?</li></ol>
          </Reveal>
        </section>

        <section className="bx-workflow" id="how-it-works">
          <Reveal className="bx-section-intro light">
            <span className="bx-kicker">HOW BULLYX WORKS</span>
            <h2>Agents use the API.<br/>People use the dashboard.</h2>
            <p>Bullyx sits between an agent’s proposal and a customer-impacting operation. It brings the context together, checks authority, and keeps people in the decision path.</p>
          </Reveal>
          <Reveal className="bx-workflow-layout">
            <div className="bx-step-list">
              {steps.map((step, i) => <button key={step[1]} type="button" className={activeStep === i ? 'active' : ''} onMouseEnter={() => setActiveStep(i)} onFocus={() => setActiveStep(i)} onClick={() => setActiveStep(i)}><span>{step[0]}</span><strong>{step[1]}</strong><i>→</i></button>)}
            </div>
            <div className="bx-step-stage">
              <span className="bx-stage-number">{steps[activeStep][0]}</span>
              <div><small>BULLYX CONTROL FLOW</small><h3>{steps[activeStep][1]}</h3><p>{steps[activeStep][2]}</p></div>
              <div className="bx-stage-track"><span style={{ width: `${(activeStep + 1) * 20}%` }} /></div>
            </div>
          </Reveal>
        </section>

        <section className="bx-use-case" id="use-case">
          <Reveal className="bx-use-copy">
            <span className="bx-kicker">A REALISTIC PAYMENT WORKFLOW</span>
            <h2>A customer disputes a $600 payment.</h2>
            <p>They say the order never arrived. Before anyone responds, Bullyx assembles the case and makes the gaps visible.</p>
            <div className="bx-case-facts">
              {['Payment and dispute data', 'Response deadline', 'Customer conversations', 'Order and delivery evidence', 'Applicable policy version', 'Missing evidence', 'Agent’s proposed next action', 'Required human reviewer'].map(item => <span key={item}>{item}</span>)}
            </div>
          </Reveal>
          <Reveal className="bx-review-flow">
            <div className="bx-review-head"><span>PROPOSAL REVIEW</span><b>Exact action · exact evidence</b></div>
            <div className="bx-review-row"><span>01</span><div><small>REQUESTED BY</small><strong>disputes-triage-01</strong></div><em>Scoped agent</em></div>
            <div className="bx-review-row"><span>02</span><div><small>PROPOSED ACTION</small><strong>Request delivery evidence</strong></div><em>Customer-visible</em></div>
            <div className="bx-review-row"><span>03</span><div><small>AUTHORITY</small><strong>Dispute evidence policy · v3</strong></div><em>Human approved</em></div>
            <div className="bx-review-row"><span>04</span><div><small>REQUIRED REVIEWER</small><strong>Payment Operations</strong></div><em>Cannot self-approve</em></div>
            <div className="bx-review-actions"><button type="button">Reject</button><button type="button" className="approve">Approve exact proposal</button></div>
            <p>The history preserves the evidence, policy version, agent, reviewer, execution attempt, and provider result.</p>
          </Reveal>
        </section>

        <section className="bx-capabilities">
          <Reveal className="bx-section-intro">
            <span className="bx-kicker">PRODUCT CAPABILITIES</span>
            <h2>One control layer for the work around the payment.</h2>
            <p>Cases, policies, agents, approvals, connections, and audit evidence stay linked—without turning a model recommendation into authority.</p>
          </Reveal>
          <Reveal className="bx-capability-list">
            {capabilities.map(([title, body], i) => <article key={title}><span>0{i + 1}</span><h3>{title}</h3><p>{body}</p></article>)}
          </Reveal>
        </section>

        <section className="bx-security" id="security">
          <Reveal className="bx-security-copy">
            <span className="bx-kicker">CONTROL BY DESIGN</span>
            <h2>Permission is explicit.<br/>Ambiguity stops the action.</h2>
            <p>Bullyx separates information access, policy evaluation, human approval, and execution. A connection—or a convincing model response—cannot skip those boundaries.</p>
          </Reveal>
          <Reveal className="bx-principles">
            {principles.map((item, i) => <div key={item}><span>{String(i + 1).padStart(2, '0')}</span><p>{item}</p></div>)}
          </Reveal>
        </section>

        <section className="bx-scope">
          <Reveal className="bx-scope-copy">
            <span className="bx-kicker">CURRENT PRODUCT SCOPE</span>
            <h2>Built for controlled pilots, not hands-off automation.</h2>
            <p>Bullyx currently focuses on governed payment-operations workflows and low-risk actions. The product includes payment-case ingestion, policy review, approval routing, agent identities, permission controls, customer-message drafts, governed internal actions, and audit history.</p>
          </Reveal>
          <Reveal className="bx-scope-grid">
            <div><span>AVAILABLE IN TODAY’S PRODUCT</span><ul><li>Stripe read-only payment-case ingestion</li><li>Payment case and evidence workspace</li><li>Reviewed, versioned company policies</li><li>Scoped agent identities and credentials</li><li>Human approval routing and audit history</li><li>Governed internal actions and message drafts</li></ul></div>
            <div className="caution"><span>IMPORTANT BOUNDARIES</span><ul><li>Payment-provider writes remain gated</li><li>Customer-visible messages require approval</li><li>Adding a connector does not grant write access</li><li>Bullyx does not automatically resolve disputes</li><li>Current deployments are controlled pilots</li></ul></div>
          </Reveal>
        </section>

        <section className="bx-final">
          <Reveal>
            <span className="bx-kicker">DESIGN PARTNERS + CONTROLLED PILOTS</span>
            <h2>Introduce AI agents without losing operational control.</h2>
            <p>We’re working with fintech and payment-operations teams that want to test governed agent workflows on real cases.</p>
            <div className="bx-actions"><button type="button" onClick={openDemo}>Request a pilot <Arrow /></button><a href="mailto:hello@bullyx.tech">Talk to the team</a></div>
          </Reveal>
        </section>
      </main>

      <footer>
        <a className="bx-logo" href="#top" aria-label="Bullyx home"><img src="/bullyx-logo-light.png" alt="Bullyx" width="120" height="90" /></a>
        <p>Governed agent workflows for fintech payment operations.</p>
        <span>© 2026 BULLYX, INC.</span>
      </footer>
      <DemoRequestModal open={demoOpen} onClose={() => setDemoOpen(false)} />
    </div>
  )
}
