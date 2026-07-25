import { useEffect, useRef, useState } from 'react'
import DemoRequestModal from './DemoRequestModal'
import { useAuth } from './AuthContext'
import './MarketingSiteV2.css'

const connectors = [
  ['Fleet systems', null, 'FL'],
  ['GitHub', '/connectors/github.png'],
  ['Maintenance', null, 'MX'],
  ['Telemetry', null, 'TM'],
  ['Slack', '/connectors/slack.png'],
  ['Drive', '/connectors/drive.png'],
]

const corePhases = [
  {
    eyebrow: '01 / ONE INTELLIGENCE LAYER',
    title: 'Your operational memory, assembled.',
    copy: 'Bullyx connects fleet events, incidents, telemetry, service records, and team decisions into one governed operational memory.',
  },
  {
    eyebrow: '02 / EVIDENCE IN MOTION',
    title: 'Every decision breaks into proof.',
    copy: 'The company brain separates an answer into the logs, observations, configurations, policies, and human decisions that actually support it.',
  },
  {
    eyebrow: '03 / CONTEXT THAT TRAVELS',
    title: 'Give every agent the right evidence.',
    copy: 'Assign bounded work with exact instructions and the incident evidence needed to investigate—without giving a model operational authority.',
  },
]

const corePieces = Array.from({ length: 24 }, (_, index) => {
  const cell = Math.floor(index / 2)
  const triangle = index % 2
  const col = cell % 4
  const row = Math.floor(cell / 4)
  const horizontal = col - 1.5
  const vertical = row - 1
  const radius = Math.hypot(horizontal / 1.5, vertical)
  return {
    col,
    row,
    triangle,
    dx: horizontal * 155 + (triangle ? 58 : -58) + Math.sin(index * 1.7) * 34,
    dy: vertical * 128 + (triangle ? 46 : -46) + Math.cos(index * 1.2) * 30,
    dz: (triangle ? 1 : -1) * (75 + (index % 5) * 27) + Math.sin(index * 0.8) * 40,
    rotateX: (vertical * 32) + (triangle ? 18 : -18),
    rotateY: (horizontal * 28) + (triangle ? -24 : 24),
    rotateZ: (triangle ? 1 : -1) * (18 + (index % 6) * 9),
    delay: Math.min(0.1, (index % 4) * 0.014 + radius * 0.018),
  }
})

const productCards = [
  {
    number: '01',
    label: 'Ask',
    title: 'Answers grounded in fleet history.',
    copy: 'Ask across operational systems in plain language. Bullyx returns a concise answer with every relevant incident source attached.',
    visual: (
      <div className="bx2-answer-card">
        <span>BULLYX ASK</span>
        <p>RBT-017 remains quarantined because the navigation fault has not been reproduced under the current configuration.</p>
        <div><b>1</b> Incident INC-204</div>
        <div><b>2</b> TestRun TR-882</div>
      </div>
    ),
  },
  {
    number: '02',
    label: 'Understand',
    title: 'One robot, every relevant signal.',
    copy: 'Configuration, incidents, telemetry, maintenance, ownership, and deployment state stay together instead of across disconnected tools.',
    visual: (
      <div className="bx2-signal-card">
        <header><span>RBT-017</span><em>Evidence incomplete</em></header>
        <strong>QUARANTINED</strong>
        <p>Navigation fault · warehouse 04</p>
        <div><i /> 7 signals connected</div>
      </div>
    ),
  },
  {
    number: '03',
    label: 'Assign',
    title: 'Agents inherit bounded context.',
    copy: 'Turn a grounded answer into an investigation with clear scope, linked evidence, an owner, and a hard operational boundary.',
    visual: (
      <div className="bx2-agent-card">
        <span>AGENT ASSIGNMENT</span>
        <strong>Compile return-to-service evidence</strong>
        <p>Incident evidence agent · 3 sources</p>
        <div><i /> Agent output remains unverified</div>
      </div>
    ),
  },
]

function Arrow() {
  return <span aria-hidden="true">↗</span>
}

function Reveal({ children, className = '' }) {
  const ref = useRef(null)

  useEffect(() => {
    const node = ref.current
    if (!node || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        node.classList.add('is-visible')
        observer.disconnect()
      }
    }, { threshold: 0.12 })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return <div ref={ref} className={`bx2-reveal ${className}`}>{children}</div>
}

function BrainBreakup() {
  const sceneRef = useRef(null)
  const pieceRefs = useRef([])
  const wholeRef = useRef(null)
  const stageRef = useRef(null)
  const coreRef = useRef(null)
  const progressRef = useRef(null)
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return undefined
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    let frame = 0
    let currentPhase = 0

    const update = () => {
      frame = 0
      const rect = scene.getBoundingClientRect()
      const distance = Math.max(scene.offsetHeight - window.innerHeight, 1)
      const progress = Math.min(1, Math.max(0, -rect.top / distance))
      const eased = progress * progress * (3 - 2 * progress)
      const breakup = Math.min(1, Math.max(0, (progress - 0.035) / 0.87))

      pieceRefs.current.forEach((piece, index) => {
        if (!piece) return
        const config = corePieces[index]
        const localProgress = Math.min(1, Math.max(0, (breakup - config.delay) / (1 - config.delay)))
        const depthEase = localProgress * localProgress * (3 - 2 * localProgress)
        const drift = Math.sin(progress * Math.PI * 2 + index * 0.63) * 9 * depthEase
        const scale = 1 - depthEase * 0.12
        piece.style.transform = `translate3d(${config.dx * depthEase}px, ${(config.dy * depthEase) + drift}px, ${config.dz * depthEase}px) rotateX(${config.rotateX * depthEase}deg) rotateY(${config.rotateY * depthEase}deg) rotateZ(${config.rotateZ * depthEase}deg) scale(${scale})`
        piece.style.opacity = String(1 - depthEase * 0.06)
      })

      if (wholeRef.current) wholeRef.current.style.opacity = String(Math.max(0, 1 - Math.max(0, (progress - 0.02) / 0.13)))
      if (stageRef.current) stageRef.current.style.transform = `perspective(1250px) rotateX(${4 - eased * 9}deg) rotateY(${-9 + eased * 19}deg) scale(${1 - eased * 0.035})`
      if (coreRef.current) {
        coreRef.current.style.transform = `translate(-50%, -50%) scale(${0.82 + eased * 0.36}) rotate(${eased * 150}deg)`
        coreRef.current.style.opacity = String(0.34 + eased * 0.66)
      }
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${progress})`

      const nextPhase = progress < 0.34 ? 0 : progress < 0.7 ? 1 : 2
      if (nextPhase !== currentPhase) {
        currentPhase = nextPhase
        setPhase(nextPhase)
      }
    }

    const requestUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', requestUpdate, { passive: true })
    window.addEventListener('resize', requestUpdate)
    return () => {
      window.removeEventListener('scroll', requestUpdate)
      window.removeEventListener('resize', requestUpdate)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <section className="bx2-brain-scroll" id="how-it-works" ref={sceneRef}>
      <div className="bx2-brain-sticky">
        <div className="bx2-brain-copy" aria-live="polite">
          <span>{corePhases[phase].eyebrow}</span>
          <h2>{corePhases[phase].title}</h2>
          <p>{corePhases[phase].copy}</p>
          <div className="bx2-phase-dots" aria-label={`Step ${phase + 1} of 3`}>
            {corePhases.map((item, index) => <i key={item.eyebrow} className={index === phase ? 'active' : ''} />)}
          </div>
        </div>

        <div ref={stageRef} className="bx2-brain-stage" aria-label="Stylized 3D company brain separating into evidence fragments">
          <div className="bx2-brain-aura" />
          <div ref={coreRef} className="bx2-core-node" />
          <img ref={wholeRef} className="bx2-brain-whole" src="/assets/bullyx-brain-3d.webp" alt="" />
          <div className="bx2-brain-pieces" aria-hidden="true">
            {corePieces.map((piece, index) => (
              <i
                key={`${piece.row}-${piece.col}-${piece.triangle}`}
                ref={(node) => { pieceRefs.current[index] = node }}
                className={`bx2-brain-piece triangle-${piece.triangle}`}
                style={{
                  left: `${piece.col * 25}%`,
                  top: `${piece.row * (100 / 3)}%`,
                  backgroundPosition: `${piece.col * (100 / 3)}% ${piece.row * 50}%`,
                }}
              />
            ))}
          </div>
          <span className="bx2-orbit-label label-one">TELEMETRY</span>
          <span className="bx2-orbit-label label-two">INCIDENTS</span>
          <span className="bx2-orbit-label label-three">CONFIG</span>
          <span className="bx2-orbit-label label-four">SERVICE</span>
        </div>

        <div className="bx2-scroll-meter"><span>SCROLL TO DISASSEMBLE</span><i><b ref={progressRef} /></i></div>
      </div>
    </section>
  )
}

function ProductPreview() {
  return (
    <div className="bx2-preview" aria-hidden="true">
      <header>
        <div><i /><span>BULLYX / COMPANY BRAIN</span></div>
        <em>LIVE</em>
      </header>
      <div className="bx2-preview-body">
        <aside>
          <span>NEW QUESTION</span>
          <b className="active">Navigation fault</b>
          <b>Battery anomaly</b>
          <b>Quarantine review</b>
          <small>6 systems connected</small>
        </aside>
        <section className="bx2-preview-content">
          <p className="bx2-preview-question">Why is RBT-017 still quarantined?</p>
          <div className="bx2-preview-answer">
            <span>BULLYX ASK <em>Grounded in 4 sources</em></span>
            <h3>The navigation fault is unresolved under the active configuration.</h3>
            <p>INC-204 records the original fault, but the latest TestRun used a superseded map version. Return-to-service evidence is still incomplete.</p>
            <div>
              <span><b>1</b> Incident INC-204</span>
              <span><b>2</b> TestRun TR-882</span>
              <span><b>3</b> Map config</span>
            </div>
          </div>
          <div className="bx2-preview-composer">
            <span>Ask about a robot, incident, or fleet…</span>
            <i>↑</i>
          </div>
        </section>
      </div>
    </div>
  )
}

export default function MarketingSiteV2() {
  const { user, profile } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [leadIntent, setLeadIntent] = useState(null)

  function openLead(intent) {
    setMenuOpen(false)
    setLeadIntent(intent)
  }

  return (
    <div className="bx2-site">
      <header className="bx2-nav">
        <a className="bx2-logo" href="#top" aria-label="Bullyx home">
          <img src="/bullyx-logo-new.png" alt="Bullyx" />
        </a>
        <nav className={menuOpen ? 'open' : ''} aria-label="Main navigation">
          <a href="#product" onClick={() => setMenuOpen(false)}>Product</a>
          <a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a>
          <a href="#security" onClick={() => setMenuOpen(false)}>Security</a>
          <a className="bx2-mobile-account" href={user ? '/dashboard' : '/login'} onClick={() => setMenuOpen(false)}>
            {user ? (profile?.full_name || 'Dashboard') : 'Sign in'}
          </a>
          <button className="bx2-mobile-account bx2-mobile-cta" type="button" onClick={() => openLead('waitlist')}>
            Join waitlist <Arrow />
          </button>
        </nav>
        <div className="bx2-nav-actions">
          <a href={user ? '/dashboard' : '/login'}>{user ? (profile?.full_name || 'Dashboard') : 'Sign in'}</a>
          <button onClick={() => openLead('waitlist')}>Join waitlist <Arrow /></button>
        </div>
        <button className="bx2-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation" aria-expanded={menuOpen}><i /><i /></button>
      </header>

      <main id="top">
        <section className="bx2-hero">
          <div className="bx2-hero-glow" />
          <Reveal className="bx2-hero-copy">
            <div className="bx2-pill"><i /> ROBOTICS OPERATIONAL INTELLIGENCE</div>
            <h1>Ask your fleet.<br /><em>Trace the evidence.</em></h1>
            <p>One governed intelligence layer across the systems behind every robot. Bullyx gives operators grounded answers and agents the bounded context to investigate safely.</p>
            <div className="bx2-actions">
              <button className="primary" onClick={() => openLead('waitlist')}>Join the waitlist <Arrow /></button>
              <button className="secondary" onClick={() => openLead('demo')}>Request a demo</button>
            </div>
            <small>No invented certainty. Every claim stays linked to operational evidence.</small>
          </Reveal>

          <Reveal className="bx2-hero-preview">
            <div className="bx2-preview-orbit orbit-one" />
            <div className="bx2-preview-orbit orbit-two" />
            <ProductPreview />
            <div className="bx2-floating-chip chip-one"><i /> Evidence ready</div>
            <div className="bx2-floating-chip chip-two">4 sources connected</div>
          </Reveal>
        </section>

        <section className="bx2-connector-strip" aria-label="Supported company systems">
          <span>ONE MEMORY ACROSS YOUR ROBOTICS STACK</span>
          <div>
            {connectors.map(([name, image, mark]) => <figure key={name}>{image ? <img src={image} alt="" /> : <i>{mark}</i>}<figcaption>{name}</figcaption></figure>)}
          </div>
          <button onClick={() => openLead('demo')}>Discuss integrations <Arrow /></button>
        </section>

        <BrainBreakup />

        <section className="bx2-product" id="product">
          <Reveal className="bx2-section-heading">
            <span>BUILT AROUND THE INCIDENT</span>
            <h2>Less searching.<br />More operational clarity.</h2>
            <p>Three focused surfaces take a question from scattered fleet records to evidence-backed investigation.</p>
          </Reveal>
          <div className="bx2-product-grid">
            {productCards.map((card) => (
              <Reveal className="bx2-product-card" key={card.number}>
                <header><span>{card.number}</span><em>{card.label}</em></header>
                <h3>{card.title}</h3>
                <p>{card.copy}</p>
                {card.visual}
              </Reveal>
            ))}
          </div>
        </section>

        <section className="bx2-trust" id="security">
          <Reveal className="bx2-trust-heading">
            <span>CONTROL IS THE PRODUCT</span>
            <h2>Context for agents.<br />Authority for operators.</h2>
          </Reveal>
          <Reveal className="bx2-trust-flow">
            <article><span>01</span><div><b>Agent investigates</b><p>A scoped identity receives bounded evidence work.</p></div></article>
            <i>→</i>
            <article><span>02</span><div><b>Bullyx checks</b><p>Permissions, evidence quality, and safety boundaries are evaluated.</p></div></article>
            <i>→</i>
            <article><span>03</span><div><b>Operator decides</b><p>Deployment and return-to-service decisions remain human.</p></div></article>
          </Reveal>
          <Reveal className="bx2-principles">
            {['Permission-aware retrieval', 'Evidence on every answer', 'Scoped agent identities', 'No autonomous robot control'].map((item, index) => <div key={item}><span>0{index + 1}</span>{item}</div>)}
          </Reveal>
        </section>

        <section className="bx2-final">
          <Reveal>
            <span>YOUR FLEET ALREADY LEFT THE EVIDENCE.</span>
            <h2>Make it available<br />when decisions begin.</h2>
            <p>Join robotics teams building a governed operational memory for every operator, engineer, and investigative agent.</p>
            <div className="bx2-actions">
              <button className="primary" onClick={() => openLead('waitlist')}>Join the waitlist <Arrow /></button>
              <button className="secondary" onClick={() => openLead('demo')}>Request a pilot</button>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="bx2-footer">
        <a className="bx2-logo" href="#top"><img src="/bullyx-logo-new.png" alt="Bullyx" /></a>
        <p>Operational intelligence for robotics teams and their agents.</p>
        <div><a href="mailto:bullyxai@gmail.com">Contact</a><span>© 2026 Bullyx, Inc.</span></div>
      </footer>

      <DemoRequestModal open={Boolean(leadIntent)} intent={leadIntent || 'demo'} onClose={() => setLeadIntent(null)} />
    </div>
  )
}
