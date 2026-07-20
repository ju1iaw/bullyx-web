import { useEffect, useId, useState } from 'react'

const FORMSPREE_ID = import.meta.env.VITE_FORMSPREE_ID

const copy = {
  demo: {
    kicker: 'REQUEST A DEMO',
    title: 'Explore a controlled payment-operations pilot.',
    lead: 'Tell us about your payment workflows, the agents you are introducing, and where human review matters most.',
    submit: 'Request demo',
    successKicker: 'REQUEST RECEIVED',
    successTitle: 'Thanks — we’ll be in touch.',
    successBody: 'We got your demo request and will follow up at the email you provided.',
    subject: (form) => `Bullyx demo request — ${form.company || form.name}`,
    messageLabel: 'Why are you interested in Bullyx?',
    messagePlaceholder: 'Payment cases, agents, approval requirements…',
    requireMessage: false,
  },
  waitlist: {
    kicker: 'JOIN THE WAITLIST',
    title: 'Get early access for your payment team.',
    lead: 'Join the waitlist for fintech and payment-operations teams. We’ll reach out as design-partner and pilot spots open.',
    submit: 'Join waitlist',
    successKicker: 'YOU’RE ON THE LIST',
    successTitle: 'You’re on the waitlist.',
    successBody: 'Thanks for joining. We’ll email you when a spot opens for your team.',
    subject: (form) => `Bullyx waitlist — ${form.company || form.name}`,
    messageLabel: 'Anything we should know? (optional)',
    messagePlaceholder: 'Team size, payment stack, agents you’re evaluating…',
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
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    if (!open) return undefined
    setStatus('idle')
    setError('')
    setForm(emptyForm)
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose, intent])

  if (!open) return null

  function update(field) {
    return (event) => setForm((current) => ({ ...current, [field]: event.target.value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!FORMSPREE_ID || FORMSPREE_ID === 'your_form_id_here') {
      setStatus('error')
      setError('This form is not connected yet. Add your Formspree form ID to enable it.')
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
