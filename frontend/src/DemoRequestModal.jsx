import { useEffect, useId, useRef, useState } from 'react'

// Keep the public lead forms usable in a fresh deployment. A hosted environment
// can still override this value with VITE_FORMSPREE_ID.
const FORMSPREE_ID = import.meta.env.VITE_FORMSPREE_ID || 'mnjepvpl'
const LEADS_EMAIL = import.meta.env.VITE_LEADS_EMAIL || 'bullyxai@gmail.com'

const copy = {
  demo: {
    kicker: 'REQUEST A DEMO',
    title: 'Walk through a robot incident end to end.',
    lead: 'Tell us about your deployed fleet, operational evidence, and the decisions your team needs to make with greater confidence.',
    submit: 'Request demo',
    successKicker: 'REQUEST RECEIVED',
    successTitle: 'Thanks — we’ll be in touch.',
    successBody: 'We got your demo request and will follow up at the email you provided.',
    subject: (form) => `Bullyx demo request — ${form.company || form.name}`,
    messageLabel: 'Why are you interested in Bullyx?',
    messagePlaceholder: 'Incident workflow, fleet size, telemetry stack, review gates…',
    requireMessage: false,
  },
  waitlist: {
    kicker: 'JOIN THE WAITLIST',
    title: 'Build the operational memory behind your fleet.',
    lead: 'Join the waitlist for robotics operations, engineering, field-service, safety, and customer-program teams.',
    submit: 'Join waitlist',
    successKicker: 'YOU’RE ON THE LIST',
    successTitle: 'You’re on the waitlist.',
    successBody: 'Thanks for joining. We’ll email you when a spot opens for your team.',
    subject: (form) => `Bullyx waitlist — ${form.company || form.name}`,
    messageLabel: 'Anything we should know? (optional)',
    messagePlaceholder: 'Fleet size, robotics stack, operational workflows, agents you’re evaluating…',
    requireMessage: false,
  },
}

const emptyForm = {
  name: '',
  email: '',
  company: '',
  role: '',
  message: '',
}

export default function DemoRequestModal({ open, onClose, intent = 'demo' }) {
  const titleId = useId()
  const content = copy[intent] || copy.demo
  const dialogRef = useRef(null)
  const openerRef = useRef(null)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    if (!open) return undefined
    setStatus('idle')
    setError('')
    setForm(emptyForm)
    openerRef.current = document.activeElement
    const previousOverflow = document.body.style.overflow
    const focusFrame = window.requestAnimationFrame(() => {
      const firstField = dialogRef.current?.querySelector('input, textarea, select')
      const firstControl = dialogRef.current?.querySelector('button, [href], [tabindex]:not([tabindex="-1"])')
      ;(firstField || firstControl)?.focus()
    })
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
      if (event.key !== 'Tab') return
      const controls = [...(dialogRef.current?.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])') || [])]
        .filter((element) => element.getClientRects().length)
      if (!controls.length) return
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.cancelAnimationFrame(focusFrame)
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      if (openerRef.current?.isConnected) openerRef.current.focus({ preventScroll: true })
    }
  }, [open, onClose, intent])

  useEffect(() => {
    if (open && status === 'success') dialogRef.current?.querySelector('.bx-modal-success button')?.focus()
  }, [open, status])

  if (!open) return null

  function update(field) {
    return (event) => setForm((current) => ({ ...current, [field]: event.target.value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!FORMSPREE_ID || FORMSPREE_ID === 'your_form_id_here') {
      const details = [
        `Name: ${form.name}`,
        `Email: ${form.email}`,
        `Company: ${form.company}`,
        form.role && `Role: ${form.role}`,
        '',
        form.message,
      ].filter(Boolean).join('\n')
      window.location.href = `mailto:${LEADS_EMAIL}?subject=${encodeURIComponent(content.subject(form))}&body=${encodeURIComponent(details)}`
      setStatus('success')
      return
    }

    setStatus('submitting')
    setError('')

    try {
      const response = await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          form_type: intent,
          name: form.name,
          email: form.email,
          company: form.company,
          role: form.role,
          message: form.message,
          _subject: content.subject(form),
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || 'Something went wrong. Please try again.')
      }

      setStatus('success')
      setForm(emptyForm)
    } catch (err) {
      setStatus('error')
      setError(err.message || 'Something went wrong. Please try again.')
    }
  }

  return (
    <div className="bx-modal-root" role="presentation" onClick={onClose}>
      <div
        ref={dialogRef}
        className="bx-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <button className="bx-modal-close" type="button" onClick={onClose} aria-label="Close">
          ×
        </button>

        {status === 'success' ? (
          <div className="bx-modal-success">
            <span className="bx-number">{content.successKicker}</span>
            <h2 id={titleId}>{content.successTitle}</h2>
            <p>{content.successBody}</p>
            <button className="bx-primary" type="button" onClick={onClose}>
              Back to site <span aria-hidden="true">↗</span>
            </button>
          </div>
        ) : (
          <>
            <span className="bx-number">{content.kicker}</span>
            <h2 id={titleId}>{content.title}</h2>
            <p className="bx-modal-lead">{content.lead}</p>
            <form className="bx-demo-form" onSubmit={handleSubmit}>
              <label>
                Name
                <input name="name" autoComplete="name" required value={form.name} onChange={update('name')} />
              </label>
              <label>
                Work email
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={form.email}
                  onChange={update('email')}
                />
              </label>
              <label>
                Company
                <input
                  name="company"
                  autoComplete="organization"
                  required
                  value={form.company}
                  onChange={update('company')}
                />
              </label>
              <label>
                Role
                <input name="role" autoComplete="organization-title" value={form.role} onChange={update('role')} />
              </label>
              <label className="bx-demo-form__full">
                {content.messageLabel}
                <textarea
                  name="message"
                  rows={intent === 'waitlist' ? 3 : 4}
                  value={form.message}
                  onChange={update('message')}
                  placeholder={content.messagePlaceholder}
                  required={content.requireMessage}
                />
              </label>
              {status === 'error' && <p className="bx-form-error" role="alert">{error}</p>}
              <button className="bx-primary" type="submit" disabled={status === 'submitting'}>
                {status === 'submitting' ? 'Sending…' : content.submit}
                <span aria-hidden="true">↗</span>
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
