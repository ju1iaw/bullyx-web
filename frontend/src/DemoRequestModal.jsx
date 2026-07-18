import { useEffect, useId, useState } from 'react'

const FORMSPREE_ID = import.meta.env.VITE_FORMSPREE_ID

export default function DemoRequestModal({ open, onClose }) {
  const titleId = useId()
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    email: '',
    company: '',
    role: '',
    message: '',
  })

  useEffect(() => {
    if (!open) return undefined
    setStatus('idle')
    setError('')
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  function update(field) {
    return (event) => setForm((current) => ({ ...current, [field]: event.target.value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!FORMSPREE_ID || FORMSPREE_ID === 'your_form_id_here') {
      setStatus('error')
      setError('Demo requests are not connected yet. Add your Formspree form ID to enable this form.')
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
          name: form.name,
          email: form.email,
          company: form.company,
          role: form.role,
          message: form.message,
          _subject: `Bullyx demo request — ${form.company || form.name}`,
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || 'Something went wrong. Please try again.')
      }

      setStatus('success')
      setForm({ name: '', email: '', company: '', role: '', message: '' })
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
            <span className="bx-number">REQUEST RECEIVED</span>
            <h2 id={titleId}>Thanks — we’ll be in touch.</h2>
            <p>We got your demo request and will follow up at the email you provided.</p>
            <button className="bx-primary" type="button" onClick={onClose}>
              Back to site <span aria-hidden="true">↗</span>
            </button>
          </div>
        ) : (
          <>
            <span className="bx-number">REQUEST A DEMO</span>
            <h2 id={titleId}>Request a demo for your financial team.</h2>
            <p className="bx-modal-lead">
              BullyX is only for financial companies. Tell us about your institution and we’ll schedule a walkthrough.
            </p>
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
                Why are you interested in Bullyx?
                <textarea
                  name="message"
                  rows={4}
                  value={form.message}
                  onChange={update('message')}
                  placeholder="Agents, workflows, compliance constraints…"
                />
              </label>
              {status === 'error' && <p className="bx-form-error" role="alert">{error}</p>}
              <button className="bx-primary" type="submit" disabled={status === 'submitting'}>
                {status === 'submitting' ? 'Sending…' : 'Request demo'}
                <span aria-hidden="true">↗</span>
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
