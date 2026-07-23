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
  ['01', 'Connect permitted systems', 'Continuously index fleet events, engineering activity, maintenance records, telemetry manifests, customer context, and company knowledge without flattening their access controls.'],
  ['02', 'Reconstruct the robot state', 'Resolve physical identity and rebuild the permission-visible hardware, software, firmware, model, parameter, calibration, and deployment state at the moment that matters.'],
  ['03', 'Assemble cited evidence', 'Create a revisioned incident packet that distinguishes verified evidence, observations, hypotheses, conflicts, missing records, and stale information.'],
  ['04', 'Coordinate bounded work', 'Give people a robotics work queue and give agents sealed context, typed capabilities, explicit prohibitions, budgets, stop conditions, and durable handoffs.'],
  ['05', 'Review and record', 'Bind independent human review to the exact evidence revision, target robot state, test digest, and applicable policy—then preserve the decision and reasoning.'],
]

const capabilities = [
  ['Ask with cited sources', 'Combine engineering, operational, customer, and organizational evidence in one permission-aware answer, with every claim linked to its underlying record.'],
  ['Incident workspaces', 'Follow an incident from initial brief through identity, configuration, evidence, maintenance, tests, independent review, and return-to-service decision.'],
  ['Robot state reconstruction', 'Model physical identity, serialized components, software, firmware, models, parameters, calibration, deployment, and maintenance through time.'],
  ['Telemetry references', 'Associate bounded MCAP, ROS bag, video, LiDAR, and specialist-platform manifests with incidents without replacing telemetry systems.'],
  ['Robotics work queue', 'Surface missing evidence, unattested tests, blocked readiness gates, unresolved identities, corrective actions, and reviews awaiting a person.'],
  ['Governed agent assignments', 'Provide sealed context packs, evidence classifications, typed capabilities, human sponsors, prohibitions, expirations, and stop conditions.'],
  ['Evidence-bound reviews', 'Support TestRun attestation, corrective-action validation, evidence requests, governed actions, and independent return-to-service review.'],
  ['Immutable audit history', 'Preserve evidence revisions, hypotheses, proposals, approvals, rejections, constraints, revocations, and handoffs as attributable records.'],
]

const principles = [
  'Source permissions remain enforceable; a space or answer never becomes a universal access override.',
  'Unknown or ambiguous robot identities stay unresolved instead of being guessed.',
  'Missing, conflicting, stale, inaccessible, and superseded evidence is shown explicitly.',
  'Agent contributions remain labeled and unverified until a qualified person validates them.',
  'A completed repair or passing test is not automatically a return-to-service authorization.',
  'Separation of duties can prevent someone from approving their own test, proposal, or decision.',
  'Bullyx does not command, move, unlock, teleoperate, deploy to, or waive safety gates for a robot.',
  'Every sensitive decision is attributable and bound to the exact evidence and target state reviewed.',
]

const useCases = [
  {
    label: 'Incident to return to service',
    title: 'Reconstruct INC-204 around RBT-017.',
    body: <>Bullyx connects the <strong>robot identity, deployed configuration, telemetry references, maintenance work, customer context, tests, policy, and decision history</strong>. It shows what is established, what conflicts, and what is still missing before a qualified person can review return to service.</>,
  },
  {
    label: 'Deployment readiness',
    title: 'Prove the corrected state is ready.',
    body: <>A readiness view checks the <strong>target hardware, software, calibration, test criteria, TestRun digest, independent attestation, and applicable safety policy</strong>. A repair or passing test never silently becomes authorization.</>,
  },
  {
    label: 'Customer-program intelligence',
    title: 'See what is blocking the DashDrop pilot.',
    body: <>Ask combines <strong>deployment status, engineering activity, customer commitments, meetings, email, support history, and owners</strong> in one cited answer—without exposing evidence the signed-in employee cannot access.</>,
  },
]

const connectorGroups = [
  {
    type: 'Company and engineering context',
    items: [
      ['GitHub', 'https://github.com', 'Code, issues, and releases'],
      ['Jira Cloud', 'https://www.atlassian.com/software/jira', 'Engineering and project records'],
      ['Slack', 'https://slack.com', 'Operational discussions'],
      ['Gmail', 'https://www.google.com/gmail/about/', 'Customer and company email'],
      ['Google Drive', 'https://workspace.google.com/products/drive/', 'Documents and revisions'],
      ['Granola', 'https://www.granola.ai', 'Meeting context'],
    ],
  },
  {
    type: 'Robotics evidence references',
    items: [
      ['Fleet systems', '#connectors', 'Robot, mission, and deployment events'],
      ['Maintenance', '#connectors', 'Work orders and serialized parts'],
      ['Foxglove', 'https://foxglove.dev', 'Telemetry and recording context'],
      ['Roboto', 'https://www.roboto.ai', 'Robotics data references'],
      ['MCAP / ROS bags', 'https://mcap.dev', 'Bounded recording manifests'],
      ['Object storage', '#connectors', 'Hashes, intervals, and deep links'],
    ],
  },
  {
    type: 'Customer and operational context',
    items: [
      ['Zendesk', 'https://www.zendesk.com', 'Support and customer history'],
      ['Notion', 'https://www.notion.com', 'Company knowledge'],
      ['Google Calendar', 'https://workspace.google.com/products/calendar/', 'Events and deployment schedules'],
    ],
  },
]

const connectorItems = Array.from(
  new Map(connectorGroups.flatMap((group) => group.items).map((item) => [item[0], item])).values(),
)

const connectorLogos = {
  Gmail: '/connectors/gmail.png',
  GitHub: '/connectors/github.png',
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
    <span className={`bx-connector-placeholder ${logo ? '' : 'bx-connector-fallback'}`}>
      {logo ? <img src={logo} alt={`${name} logo`} /> : <b aria-hidden="true">{name.slice(0, 2).toUpperCase()}</b>}
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
          <div><span>CONNECTION CATALOG</span><h2 id="connectors-title">The evidence around every robot.</h2></div>
          <button type="button" onClick={onClose} aria-label="Close connector directory">×</button>
        </header>
        <p className="bx-connectors-lead">Bullyx preserves source identity, timestamps, revisions, ACLs, relationships, and deep links. Large telemetry remains in specialist platforms; Bullyx keeps the manifests and operational context that make it usable.</p>
        <div className="bx-connectors-scroll">
          {connectorGroups.map((group) => (
            <section className="bx-connector-group" key={group.type}>
              <h3>{group.type}</h3>
              <div className="bx-connector-grid">
                {group.items.map(([name, url, description]) => (
                  <a key={name} href={url} target={url.startsWith('http') ? '_blank' : undefined} rel={url.startsWith('http') ? 'noreferrer' : undefined}>
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
      <div className="bx-case-mini bx-case-mini-message" aria-label="Deployment readiness awaiting independent review">
        <div className="bx-mini-head"><span>READINESS GATE · RBT-017</span><b>Blocked</b></div>
        <div className="bx-mini-field"><small>TARGET</small><strong>HW-82 · SW 3.18.4 · CAL-109</strong></div>
        <div className="bx-mini-field"><small>TEST</small><strong>TR-882 passed · attestation missing</strong></div>
        <div className="bx-mini-copy"><i/><i/><i/><i/></div>
        <div className="bx-mini-actions"><span>Keep quarantined</span><b>Review exact packet</b></div>
      </div>
    )
  }

  if (index === 2) {
    return (
      <div className="bx-case-mini bx-case-mini-shadow" aria-label="Customer program intelligence summary">
        <div className="bx-mini-head"><span>DASHDROP PILOT</span><b>3 cited blockers</b></div>
        <div className="bx-shadow-row"><span>Site readiness</span><strong>Awaiting validation</strong></div>
        <div className="bx-shadow-row"><span>Customer commitment</span><strong>Review due Friday</strong></div>
        <div className="bx-shadow-result"><i>3</i><div><small>SOURCES</small><b>Email · Jira · meeting notes</b></div></div>
      </div>
    )
  }

  return (
    <div className="bx-case-mini" aria-label="Incident 204 evidence packet">
      <div className="bx-mini-head"><span>INC-204 · RBT-017</span><b>Quarantined</b></div>
      <div className="bx-mini-evidence"><i>✓</i><span>Configuration at incident</span><small>Exact</small></div>
      <div className="bx-mini-evidence"><i>✓</i><span>MCAP interval manifest</span><small>Linked</small></div>
      <div className="bx-mini-evidence missing"><i>!</i><span>Time-sync verification</span><small>Missing</small></div>
      <div className="bx-mini-proposal"><small>AGENT EVIDENCE REQUEST</small><strong>Collect time-sync record</strong><span>Human review required</span></div>
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
            <div className="bx-eyebrow"><span /> Operational intelligence for robotics</div>
            <h1>Operate every robot with the <em>full history behind it.</em></h1>
            <p>Bullyx connects fleet, engineering, telemetry, maintenance, customer, and company knowledge so humans and agents can investigate failures, coordinate recovery, and make evidence-backed deployment decisions.</p>
            <div className="bx-actions">
              <button className="bx-primary" type="button" onClick={openWaitlist}>Join waitlist <Arrow /></button>
              <button className="bx-secondary" type="button" onClick={openDemo}>Request a demo</button>
              <a className="bx-secondary" href="#how-it-works">See how it works <span aria-hidden="true">↓</span></a>
            </div>
            <p className="bx-roles">For robotics operations, field service, safety, compliance, and engineering teams.</p>
          </div>

          <div className="bx-hero-product">
            <div className="bx-product-shot" aria-label="Robot incident awaiting return-to-service review">
              <div className="bx-shot-bar"><span>INCIDENT WORKSPACE</span><div><i /> Evidence incomplete</div></div>
              <div className="bx-case-head">
                <div><small>INC-204 · DASHDROP SITE 04</small><h2>Watchdog stop during mission</h2><p>Occurred Jul 22 · 14:08:31 UTC</p></div>
                <strong>RBT-017 <small>QUARANTINED</small></strong>
              </div>
              <div className="bx-case-grid">
                <div className="bx-case-main">
                  <div className="bx-panel-title">Evidence packet · revision 7</div>
                  <div className="bx-evidence ok"><b>✓</b><span>Configuration reconstruction<small>HW-82 · SW 3.18.4 · CAL-109</small></span><em>Exact</em></div>
                  <div className="bx-evidence ok"><b>✓</b><span>Telemetry manifest<small>MCAP · 14:07:45–14:09:20</small></span><em>Linked</em></div>
                  <div className="bx-evidence missing"><b>!</b><span>Time-sync verification<small>Required to align watchdog events</small></span><em>Missing</em></div>
                  <div className="bx-policy-note"><span>Applicable policy</span><strong>Return to service · v4</strong><small>Independent review required</small></div>
                </div>
                <div className="bx-proposal">
                  <div className="bx-panel-title">Agent contribution · unverified</div>
                  <span className="bx-agent">Agent · incident-evidence-01</span>
                  <h3>Request time-sync evidence</h3>
                  <p>Collect the NTP status and clock-offset record for the incident interval before hypothesis review.</p>
                  <dl><div><dt>Capability</dt><dd>Evidence request</dd></div><div><dt>Stops at</dt><dd>Human review</dd></div></dl>
                  <button type="button" onClick={openDemo}>Inspect evidence request <span>→</span></button>
                </div>
              </div>
              <div className="bx-shot-foot"><span>Agent <b>Assembles context</b></span><span>Human <b>Authorizes the decision</b></span></div>
            </div>
            <div className="bx-connector-rail" aria-label="Connector preview">
              <div className="bx-connector-window">
                <div className="bx-connector-track">
                  {[...connectorItems, ...connectorItems].map(([name, url], index) => (
                    <a key={`${name}-${index}`} href={url} target={url.startsWith('http') ? '_blank' : undefined} rel={url.startsWith('http') ? 'noreferrer' : undefined} aria-label={`Visit ${name}`}>
                      <ConnectorPlaceholder name={name} />
                      <span className="bx-connector-name">{name}</span>
                    </a>
                  ))}
                </div>
              </div>
              <button type="button" onClick={() => setConnectorsOpen(true)}><span aria-hidden="true">→</span> View evidence sources</button>
            </div>
          </div>
        </section>

        <section className="bx-overview" id="product">
          <Reveal className="bx-overview-grid">
            <article>
              <span className="bx-kicker">WHAT’S THE PROBLEM?</span>
              <h2>One robot failure. Evidence everywhere.</h2>
              <p>When a deployed robot fails, the answer is scattered across <strong>fleet software, telemetry platforms, maintenance systems, GitHub, Slack, email, customer tools, meetings, and documents</strong>. Teams lose time reconstructing which physical robot was involved, what state it was in, what changed, and which evidence is actually authoritative.</p>
              <div className="bx-fragmented-visual" aria-label="A robot incident spread across company systems">
                <div className="bx-fragmented-case"><small>INCIDENT · INC-204</small><strong>Watchdog stop</strong><span>RBT-017 · Site 04</span></div>
                <div className="bx-fragmented-systems">
                  {[
                    ['Fleet & telemetry', []],
                    ['Engineering', ['GitHub', 'Jira Cloud']],
                    ['Maintenance', []],
                    ['Customer', ['Gmail', 'Zendesk']],
                    ['Discussions', ['Slack', 'Granola']],
                    ['Documents', ['Google Drive', 'Notion']],
                  ].map(([system, logos], index) => (
                    <span key={system}>
                      <i>{String(index + 1).padStart(2, '0')}</i>
                      <b>{system}</b>
                      <span className="bx-fragmented-logos">
                        {logos.length ? logos.map((name) => <img key={name} src={connectorLogos[name]} alt={`${name} logo`} />) : <em>MANIFESTS + EVENTS</em>}
                      </span>
                    </span>
                  ))}
                </div>
                <p><span>6 evidence surfaces</span><span>1 robot state</span><span>No safe guesswork</span></p>
              </div>
            </article>
            <article>
              <span className="bx-kicker">OUR SOLUTION</span>
              <h2>Operational truth, reconstructed and governed.</h2>
              <p>Bullyx turns connected company data into a <strong>permission-aware, time-aware operational memory</strong>. It resolves robot identity, reconstructs configuration, assembles revisioned evidence, exposes uncertainty, and links every answer and decision back to source. Humans get cited Ask, workspaces, queues, and reviews; agents get <strong>sealed context, bounded assignments, typed capabilities, and explicit stop conditions</strong>.</p>
              <div className="bx-control-visual" aria-label="Bullyx incident evidence and decision flow">
                <div className="bx-control-node"><small>SOURCE EVIDENCE</small><strong>Events, records, discussions</strong><span>Permissions and revisions preserved</span></div>
                <i className="bx-control-arrow">↓</i>
                <div className="bx-control-node primary"><small>BULLYX</small><strong>Reconstructs robot + context</strong><span>Identity and state through time</span></div>
                <div className="bx-control-branch"><span>Conflicts and missing evidence stay visible</span><i>→</i></div>
                <div className="bx-control-node review"><small>HUMANS + BOUNDED AGENTS</small><strong>Investigate and coordinate</strong><span>Recommendation ≠ authority</span></div>
                <i className="bx-control-arrow">↓</i>
                <div className="bx-control-node final"><small>HUMAN DECISION</small><strong>Review exact evidence + record</strong><span>No direct robot-control authority</span></div>
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
            <span className="bx-kicker">INCIDENT TO RETURN TO SERVICE</span>
            <h2>One evidence graph.<br/>Two governed interfaces.</h2>
            <p>People explore cited answers, incident workspaces, evidence timelines, work queues, and review packets. Agents operate on the same evidence through a purpose-limited contract that defines what they may inspect, propose, and hand back.</p>
          </Reveal>
          <Reveal className="bx-workflow-layout">
            <div className="bx-step-list">
              {steps.map((step, i) => <button key={step[1]} type="button" className={activeStep === i ? 'active' : ''} onMouseEnter={() => setActiveStep(i)} onFocus={() => setActiveStep(i)} onClick={() => setActiveStep(i)}><span>{step[0]}</span><strong>{step[1]}</strong><i>→</i></button>)}
            </div>
            <div className="bx-step-stage">
              <span className="bx-stage-number">{steps[activeStep][0]}</span>
              <div><small>GOVERNED OPERATING LOOP</small><h3>{steps[activeStep][1]}</h3><p>{steps[activeStep][2]}</p></div>
              <div className="bx-stage-track"><span style={{ width: `${((activeStep + 1) / steps.length) * 100}%` }} /></div>
            </div>
          </Reveal>
        </section>

        <section className="bx-use-case" id="incident-workflow">
          <Reveal className="bx-use-copy">
            <span className="bx-kicker">A ROBOTICS-NATIVE WORKFLOW</span>
            <h2>RBT-017 stops during a customer mission.</h2>
            <p>Before anyone clears the robot, Bullyx reconstructs the incident and makes the decision chain—and every gap in it—visible.</p>
            <div className="bx-case-facts">
              {['Physical robot and typed aliases', 'Hardware and software state', 'Telemetry and recording manifests', 'Maintenance and component history', 'Competing hypotheses and conflicts', 'Corrective action and exact TestRun', 'Applicable safety policy', 'Independent return-to-service review'].map(item => <span key={item}>{item}</span>)}
            </div>
          </Reveal>
          <Reveal className="bx-review-flow">
            <div className="bx-review-head"><span>RETURN-TO-SERVICE REVIEW</span><b>Exact state · exact evidence</b></div>
            <div className="bx-review-row"><span>01</span><div><small>TARGET ROBOT STATE</small><strong>RBT-017 · HW-82 · SW 3.18.4</strong></div><em>Digest bound</em></div>
            <div className="bx-review-row"><span>02</span><div><small>INCIDENT PACKET</small><strong>INC-204 · revision 7</strong></div><em>Immutable</em></div>
            <div className="bx-review-row"><span>03</span><div><small>TEST EVIDENCE</small><strong>TR-882 · independent attestation</strong></div><em>Verified</em></div>
            <div className="bx-review-row"><span>04</span><div><small>REQUIRED REVIEWER</small><strong>Safety & compliance</strong></div><em>Cannot self-approve</em></div>
            <div className="bx-review-actions"><button type="button">Reject</button><button type="button" className="approve">Record approval</button></div>
            <p>The decision records the reviewer, evidence revision, target state, policy, constraints, and reasoning. It does not directly unlock or command the robot.</p>
          </Reveal>
        </section>

        <section className="bx-capabilities">
          <Reveal className="bx-section-intro">
            <span className="bx-kicker">PRODUCT CAPABILITIES</span>
            <h2>A company brain built around physical robots.</h2>
            <p>Generic search finds a discussion. Bullyx connects that discussion to the robot, its state at the time, the evidence revision, the applicable policy, and the person authorized to decide what happens next.</p>
          </Reveal>
          <Reveal className="bx-capability-list">
            {capabilities.map(([title, body], i) => <article key={title}><span>0{i + 1}</span><h3>{title}</h3><p>{body}</p></article>)}
          </Reveal>
        </section>

        <section className="bx-security" id="security">
          <Reveal className="bx-security-copy">
            <span className="bx-kicker">CONTROL BY DESIGN</span>
            <h2>Useful because the boundaries are real.</h2>
            <p>Bullyx gives humans and software agents enough structured context to do valuable operational work without pretending that recommendation, evidence, approval, and execution are the same thing.</p>
          </Reveal>
          <Reveal className="bx-principles">
            {principles.map((item, i) => <div key={item}><span>{String(i + 1).padStart(2, '0')}</span><p>{item}</p></div>)}
          </Reveal>
        </section>

        <section className="bx-scope">
          <Reveal className="bx-scope-copy">
            <span className="bx-kicker">CURRENT PRODUCT SCOPE</span>
            <h2>A sophisticated product demonstration, grounded in one coherent operating story.</h2>
            <p>The current implementation uses a large synthetic Aegis Robotics corpus to demonstrate permission personas, indexed context, robotics workflows, cited source inspection, agent assignments, governed actions, and audit controls.</p>
          </Reveal>
          <Reveal className="bx-scope-grid">
            <div><span>AVAILABLE IN TODAY’S PRODUCT</span><ul><li>Cited Ask with source inspection</li><li>Robotics incidents and evidence timelines</li><li>Robot, deployment, configuration, and test context</li><li>Permission-aware operational personas</li><li>Bounded agent assignments and handoffs</li><li>Governed reviews, actions, and audit history</li></ul></div>
            <div className="caution"><span>IMPORTANT BOUNDARIES</span><ul><li>Demo integrations use synthetic company evidence</li><li>Raw high-rate telemetry stays in specialist platforms</li><li>Similar incidents do not establish causality</li><li>Agent contributions remain unverified by default</li><li>No direct robot-control or safety-gate authority</li><li>Return to service remains a human decision</li></ul></div>
          </Reveal>
        </section>

        <section className="bx-final">
          <Reveal>
            <span className="bx-kicker">JOIN THE WAITLIST</span>
            <h2>Bring the full operational history to every robot decision.</h2>
            <p>We’re working with robotics teams that want faster incident investigation, stronger engineering-to-operations continuity, and a safer operating environment for the agents helping them.</p>
            <div className="bx-actions">
              <button type="button" onClick={openWaitlist}>Join waitlist <Arrow /></button>
              <button className="bx-final-secondary" type="button" onClick={openDemo}>Request a demo</button>
              <a href="mailto:bullyxai@gmail.com">Talk to the team</a>
            </div>
          </Reveal>
        </section>
      </main>

      <footer>
        <a className="bx-logo" href="#top" aria-label="Bullyx home"><img src="/bullyx-logo-light.png" alt="Bullyx" width="120" height="90" /></a>
        <p>Operational intelligence for robotics companies.</p>
        <span>© 2026 BULLYX, INC.</span>
      </footer>
      <DemoRequestModal open={Boolean(leadIntent)} intent={leadIntent || 'demo'} onClose={() => setLeadIntent(null)} />
      <ConnectorModal open={connectorsOpen} onClose={() => setConnectorsOpen(false)} />
    </div>
  )
}
