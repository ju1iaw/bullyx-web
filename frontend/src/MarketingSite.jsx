import { useEffect, useRef, useState } from 'react'
import DemoRequestModal from './DemoRequestModal'
import { useAuth } from './AuthContext'
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
  ['01', 'Connect company systems', 'Bring email, documents, conversations, operational tools, and internal knowledge together through secure APIs.'],
  ['02', 'Ask a company question', 'Bullyx searches the information you can access and returns an answer grounded in your company data.'],
  ['03', 'Inspect the evidence', 'See the important source documents behind an answer and open an email, policy, or record directly in the side panel.'],
  ['04', 'Assign work to an agent', 'Turn an answer into a clear assignment with the relevant evidence, company practices, and case-specific context attached.'],
  ['05', 'Give agents the same context', 'Agents access the company brain through an API so their work follows how your company actually operates.'],
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

const showExtendedSections = false

const useCases = [
  {
    label: 'Dispute evidence',
    title: '$600 order-not-received dispute',
    body: <>Bullyx assembles the <strong>payment and dispute data, response deadline, customer conversations, delivery evidence, applicable policy, and missing information</strong>. An agent can propose the next step, but the <strong>designated payment-operations reviewer approves or rejects the exact proposal</strong>.</>,
  },
  {
    label: 'Customer communication',
    title: 'Review an exact customer message',
    body: <>An agent prepares a customer-visible draft using permitted case evidence. The reviewer sees the <strong>recipients, subject, message, attachments, policy authority, and case context</strong> before anything can be sent.</>,
  },
  {
    label: 'Shadow mode',
    title: 'Compare recommendations before execution',
    body: <>Teams can compare an agent’s policy-bound recommendation with the actual human outcome. <strong>Shadow recommendations grant no authority</strong> and cannot invoke the action executor.</>,
  },
]

const connectorGroups = [
  {
    type: 'Live data integrations',
    items: [
      ['Stripe', 'https://stripe.com', 'Payments · read-only'],
      ['Plaid', 'https://plaid.com', 'Banking data · read-only'],
      ['Gmail', 'https://www.google.com/gmail/about/', 'Email context'],
      ['GitHub', 'https://github.com', 'Engineering context'],
      ['Twilio Conversations', 'https://www.twilio.com/conversations', 'Business conversations · read-only'],
      ['Granola', 'https://www.granola.ai', 'Meeting context · read-only'],
    ],
  },
  {
    type: 'Governed action integrations',
    items: [
      ['GitHub', 'https://github.com', 'Approved issue creation'],
      ['Zendesk', 'https://www.zendesk.com', 'Tickets, internal notes, reply drafts'],
      ['Jira Cloud', 'https://www.atlassian.com/software/jira', 'Approved issue creation'],
      ['Gmail', 'https://www.google.com/gmail/about/', 'Approved draft creation and sending'],
    ],
  },
  {
    type: 'Planned and import-supported sources',
    items: [
      ['Slack', 'https://slack.com', 'Communication'],
      ['Google Drive', 'https://workspace.google.com/products/drive/', 'Documents'],
      ['Notion', 'https://www.notion.com', 'Knowledge'],
      ['Google Calendar', 'https://workspace.google.com/products/calendar/', 'Calendar'],
    ],
  },
]

const connectorItems = Array.from(
  new Map(connectorGroups.flatMap((group) => group.items).map((item) => [item[0], item])).values(),
)

const connectorLogos = {
  Stripe: '/connectors/stripe.png',
  Plaid: '/connectors/plaid.png',
  Gmail: '/connectors/gmail.png',
  GitHub: '/connectors/github.png',
  'Twilio Conversations': '/connectors/twilio.png',
  Granola: '/connectors/granola.png',
  Zendesk: '/connectors/zendesk.png',
  'Jira Cloud': '/connectors/jira.png',
  Slack: '/connectors/slack.png',
  'Google Drive': '/connectors/drive.png',
  Notion: '/connectors/notion.png',
  'Google Calendar': '/connectors/calendar.png',
}

function ConnectorPlaceholder({ name }) {
  const logo = connectorLogos[name]
  return (
    <span className="bx-connector-placeholder">
      {logo && <img src={logo} alt={`${name} logo`} />}
    </span>
  )
}

function ConnectorModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return undefined
    const handleKey = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="bx-connectors-modal-root" role="presentation" onClick={onClose}>
      <section className="bx-connectors-modal" role="dialog" aria-modal="true" aria-labelledby="connectors-title" onClick={(event) => event.stopPropagation()}>
        <header>
          <div><span>CONNECTION CATALOG</span><h2 id="connectors-title">Integration surfaces and current availability.</h2></div>
          <button type="button" onClick={onClose} aria-label="Close connector directory">×</button>
        </header>
        <p className="bx-connectors-lead">Bullyx uses live data connections, narrowly governed action capabilities, and import-supported sources. A provider’s presence never grants general write access.</p>
        <div className="bx-connectors-scroll">
          {connectorGroups.map((group) => (
            <section className="bx-connector-group" key={group.type}>
              <h3>{group.type}</h3>
              <div className="bx-connector-grid">
                {group.items.map(([name, url, description]) => (
                  <a key={name} href={url} target="_blank" rel="noreferrer" aria-label={`Visit ${name}`}>
                    <ConnectorPlaceholder name={name} />
                    <span>{name}</span>
                    <small>{description}</small>
                  </a>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </div>
  )
}

function UseCaseVisual({ index }) {
  if (index === 1) {
    return (
      <div className="bx-case-mini bx-case-mini-message" aria-label="Customer message awaiting approval">
        <div className="bx-mini-head"><span>MESSAGE DRAFT</span><b>Awaiting review</b></div>
        <div className="bx-mini-field"><small>TO</small><strong>Customer on case PAY-2048</strong></div>
        <div className="bx-mini-field"><small>SUBJECT</small><strong>Delivery evidence requested</strong></div>
        <div className="bx-mini-copy"><i/><i/><i/><i/></div>
        <div className="bx-mini-actions"><span>Reject</span><b>Approve exact draft</b></div>
      </div>
    )
  }

  if (index === 2) {
    return (
      <div className="bx-case-mini bx-case-mini-shadow" aria-label="Shadow recommendation comparison">
        <div className="bx-mini-head"><span>SHADOW COMPARISON</span><b>No authority granted</b></div>
        <div className="bx-shadow-row"><span>Agent recommendation</span><strong>Request evidence</strong></div>
        <div className="bx-shadow-row"><span>Human outcome</span><strong>Request evidence</strong></div>
        <div className="bx-shadow-result"><i>✓</i><div><small>NEXT ACTION</small><b>Agreement recorded</b></div></div>
      </div>
    )
  }

  return (
    <div className="bx-case-mini" aria-label="Six hundred dollar dispute case">
      <div className="bx-mini-head"><span>DISPUTE · $600.00</span><b>4 days remaining</b></div>
      <div className="bx-mini-evidence"><i>✓</i><span>Payment and dispute data</span><small>Ready</small></div>
      <div className="bx-mini-evidence"><i>✓</i><span>Customer conversation</span><small>Ready</small></div>
      <div className="bx-mini-evidence missing"><i>!</i><span>Proof of delivery</span><small>Missing</small></div>
      <div className="bx-mini-proposal"><small>AGENT PROPOSAL</small><strong>Request delivery evidence</strong><span>Human review required</span></div>
    </div>
  )
}

export default function MarketingSite() {
  const { user, profile } = useAuth()
  const [menu, setMenu] = useState(false)
  const [leadIntent, setLeadIntent] = useState(null)
  const [connectorsOpen, setConnectorsOpen] = useState(false)
  const [activeStep, setActiveStep] = useState(0)
  const [activeUseCase, setActiveUseCase] = useState(0)

  function closeMenu() { setMenu(false) }
  function openDemo() { closeMenu(); setLeadIntent('demo') }
  function openWaitlist() { closeMenu(); setLeadIntent('waitlist') }

  return (
    <div className="bx-site">
      <header className="bx-nav">
        <a className="bx-logo" href="#top" aria-label="Bullyx home" onClick={closeMenu}>
          <img src="/bullyx-logo-light.png" alt="Bullyx" width="140" height="105" />
        </a>
        <nav className={menu ? 'open' : ''} aria-label="Main navigation">
          <a href="#product" onClick={closeMenu}>Overview</a>
          <a href="#how-it-works" onClick={closeMenu}>How it works</a>
          <a href="#use-cases" onClick={closeMenu}>Use cases</a>
        </nav>
        <div className="bx-nav-actions">
          {user ? <a className="bx-profile-link" href="/dashboard" aria-label="Open your dashboard">{profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : <span>{profile?.full_name?.[0] || user.email?.[0] || ''}</span>}</a> : <a className="bx-signin" href="/login">Sign in</a>}
          <button className="bx-nav-cta" type="button" onClick={openWaitlist}>Join waitlist <Arrow /></button>
        </div>
        <button className="bx-menu" type="button" onClick={() => setMenu(!menu)} aria-expanded={menu} aria-label="Toggle menu"><span/><span/></button>
      </header>

      <main id="top">
        <section className="bx-hero">
          <div className="bx-hero-copy">
            <div className="bx-eyebrow"><span /> Your company brain for people and agents</div>
            <h1>Ask your company anything.<br/><em>Get answers with evidence.</em></h1>
            <p>Bullyx searches across your company data through connected APIs, answers questions with the most important source documents, and gives AI agents instructions grounded in how your company works.</p>
            <div className="bx-actions">
              <button className="bx-primary" type="button" onClick={openWaitlist}>Join waitlist <Arrow /></button>
              <button className="bx-secondary" type="button" onClick={openDemo}>Request a demo</button>
              <a className="bx-secondary" href="#how-it-works">See how it works <span aria-hidden="true">↓</span></a>
            </div>
            <p className="bx-roles">One shared source of company context for your team and every agent you deploy.</p>
          </div>

          <div className="bx-hero-product">
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
            <div className="bx-connector-rail" aria-label="Connector preview">
              <div className="bx-connector-window">
                <div className="bx-connector-track">
                  {[...connectorItems, ...connectorItems].map(([name, url], index) => (
                    <a key={`${name}-${index}`} href={url} target="_blank" rel="noreferrer" aria-label={`Visit ${name}`}>
                      <ConnectorPlaceholder name={name} />
                      <span className="bx-connector-name">{name}</span>
                    </a>
                  ))}
                </div>
              </div>
              <button type="button" onClick={() => setConnectorsOpen(true)}><span aria-hidden="true">→</span> View all connectors</button>
            </div>
          </div>
        </section>

        <section className="bx-overview" id="product">
          <Reveal className="bx-overview-grid">
            <article>
              <span className="bx-kicker">WHAT’S THE PROBLEM?</span>
              <h2>Your company knowledge is scattered across too many systems.</h2>
              <p>The answer to an important question may be buried in <strong>email, documents, support conversations, communication tools, operational systems, and internal dashboards</strong>. People lose time searching and AI agents miss the context that explains what happened, how work is usually done, and which source proves it.</p>
              <div className="bx-fragmented-visual" aria-label="A payment case spread across company systems">
                <div className="bx-fragmented-case"><small>PAYMENT CASE</small><strong>Order not received</strong><span>$600 dispute</span></div>
                <div className="bx-fragmented-systems">
                  {[
                    ['Payments', ['Stripe', 'Plaid']],
                    ['Support', ['Zendesk']],
                    ['Email', ['Gmail']],
                    ['Documents', ['Google Drive', 'Notion']],
                    ['Fraud tools', ['Plaid']],
                    ['Internal data', ['GitHub', 'Granola']],
                  ].map(([system, logos], index) => (
                    <span key={system}>
                      <i>{String(index + 1).padStart(2, '0')}</i>
                      <b>{system}</b>
                      <span className="bx-fragmented-logos">
                        {logos.map((name) => <img key={name} src={system === 'Support' && name === 'Zendesk' ? '/connectors/zendesk-box.png' : connectorLogos[name]} alt={`${name} logo`} />)}
                      </span>
                    </span>
                  ))}
                </div>
                <p><span>6 systems</span><span>1 decision</span><span>No shared control</span></p>
              </div>
            </article>
            <article>
              <span className="bx-kicker">OUR SOLUTION</span>
              <h2>One company brain, with every answer linked to evidence.</h2>
              <p>Ask Bullyx a question and it searches the company information you are allowed to access through connected APIs. It returns a clear answer, surfaces the <strong>most important supporting documents</strong>, and lets you open a source—such as a decisive email—directly beside the answer. Assign the work to an agent and Bullyx supplies <strong>specific instructions based on company practice and the context of that exact task</strong>.</p>
              <div className="bx-control-visual" aria-label="Bullyx control flow from agent proposal to governed execution">
                <div className="bx-control-node"><small>EXTERNAL AGENT</small><strong>Proposes an action</strong><span>Scoped API identity</span></div>
                <i className="bx-control-arrow">↓</i>
                <div className="bx-control-node primary"><small>BULLYX</small><strong>Checks access + policy</strong><span>Fails closed on ambiguity</span></div>
                <div className="bx-control-branch"><span>Policy requires review</span><i>→</i></div>
                <div className="bx-control-node review"><small>HUMAN REVIEWER</small><strong>Approves the exact proposal</strong><span>Approval ≠ execution</span></div>
                <i className="bx-control-arrow">↓</i>
                <div className="bx-control-node final"><small>SUPPORTED CAPABILITY</small><strong>Execute + record</strong><span>Provider result preserved</span></div>
              </div>
            </article>
            <article className="bx-usecase-slider" id="use-cases">
              <span className="bx-kicker">USE CASES</span>
              <div className="bx-usecase-slide" aria-live="polite">
                <small>{useCases[activeUseCase].label}</small>
                <h2>{useCases[activeUseCase].title}</h2>
                <p>{useCases[activeUseCase].body}</p>
                <UseCaseVisual index={activeUseCase} />
              </div>
              <div className="bx-usecase-controls">
                <button type="button" aria-label="Previous use case" onClick={() => setActiveUseCase((activeUseCase - 1 + useCases.length) % useCases.length)}>←</button>
                <span>{String(activeUseCase + 1).padStart(2, '0')} / {String(useCases.length).padStart(2, '0')}</span>
                <button type="button" aria-label="Next use case" onClick={() => setActiveUseCase((activeUseCase + 1) % useCases.length)}>→</button>
              </div>
            </article>
          </Reveal>
        </section>

        <section className="bx-workflow" id="how-it-works">
          <Reveal className="bx-section-intro light">
            <span className="bx-kicker">HOW BULLYX WORKS</span>
            <h2>People ask in the dashboard.<br/>Agents use the API.</h2>
            <p>Both work from the same permission-aware company knowledge. People get cited answers and open the evidence beside them; agents receive precise instructions shaped by company practices and task-specific context.</p>
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

        {showExtendedSections && <section className="bx-use-case" id="use-case">
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
        </section>}

        {showExtendedSections && <section className="bx-capabilities">
          <Reveal className="bx-section-intro">
            <span className="bx-kicker">PRODUCT CAPABILITIES</span>
            <h2>One control layer for the work around the payment.</h2>
            <p>Cases, policies, agents, approvals, connections, and audit evidence stay linked—without turning a model recommendation into authority.</p>
          </Reveal>
          <Reveal className="bx-capability-list">
            {capabilities.map(([title, body], i) => <article key={title}><span>0{i + 1}</span><h3>{title}</h3><p>{body}</p></article>)}
          </Reveal>
        </section>}

        {showExtendedSections && <section className="bx-security" id="security">
          <Reveal className="bx-security-copy">
            <span className="bx-kicker">CONTROL BY DESIGN</span>
            <h2>Permission is explicit.<br/>Ambiguity stops the action.</h2>
            <p>Bullyx separates information access, policy evaluation, human approval, and execution. A connection—or a convincing model response—cannot skip those boundaries.</p>
          </Reveal>
          <Reveal className="bx-principles">
            {principles.map((item, i) => <div key={item}><span>{String(i + 1).padStart(2, '0')}</span><p>{item}</p></div>)}
          </Reveal>
        </section>}

        {showExtendedSections && <section className="bx-scope">
          <Reveal className="bx-scope-copy">
            <span className="bx-kicker">CURRENT PRODUCT SCOPE</span>
            <h2>Built for controlled pilots, not hands-off automation.</h2>
            <p>Bullyx currently focuses on governed payment-operations workflows and low-risk actions. The product includes payment-case ingestion, policy review, approval routing, agent identities, permission controls, customer-message drafts, governed internal actions, and audit history.</p>
          </Reveal>
          <Reveal className="bx-scope-grid">
            <div><span>AVAILABLE IN TODAY’S PRODUCT</span><ul><li>Stripe read-only payment-case ingestion</li><li>Payment case and evidence workspace</li><li>Reviewed, versioned company policies</li><li>Scoped agent identities and credentials</li><li>Human approval routing and audit history</li><li>Governed internal actions and message drafts</li></ul></div>
            <div className="caution"><span>IMPORTANT BOUNDARIES</span><ul><li>Payment-provider writes remain gated</li><li>Customer-visible messages require approval</li><li>Adding a connector does not grant write access</li><li>Bullyx does not automatically resolve disputes</li><li>Current deployments are controlled pilots</li></ul></div>
          </Reveal>
        </section>}

        <section className="bx-final">
          <Reveal>
            <span className="bx-kicker">JOIN THE WAITLIST</span>
            <h2>Give every person and agent the context to do the work right.</h2>
            <p>Connect your company systems, ask questions across all of your knowledge, inspect the source documents behind each answer, and assign evidence-backed work to agents.</p>
            <div className="bx-actions">
              <button type="button" onClick={openWaitlist}>Join waitlist <Arrow /></button>
              <button className="bx-final-secondary" type="button" onClick={openDemo}>Request a pilot</button>
              <a href="mailto:bullyxai@gmail.com">Talk to the team</a>
            </div>
          </Reveal>
        </section>
      </main>

      <footer>
        <a className="bx-logo" href="#top" aria-label="Bullyx home"><img src="/bullyx-logo-light.png" alt="Bullyx" width="120" height="90" /></a>
        <p>The company brain for people and AI agents.</p>
        <span>© 2026 BULLYX, INC.</span>
      </footer>
      <DemoRequestModal open={Boolean(leadIntent)} intent={leadIntent || 'demo'} onClose={() => setLeadIntent(null)} />
      <ConnectorModal open={connectorsOpen} onClose={() => setConnectorsOpen(false)} />
    </div>
  )
}
