import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext'
import * as api from './lib/supabase'
import './AccountApp.css'

function navigate(path, replace = false) {
  window.history[replace ? 'replaceState' : 'pushState']({}, '', path)
  window.dispatchEvent(new Event('bullyx:navigate'))
  window.scrollTo(0, 0)
}

function Logo() { return <a className="acct-logo" href="/" onClick={(event) => { event.preventDefault(); navigate('/') }}><img src="/bullyx-logo-light.png" alt="Bullyx" /></a> }
function Arrow() { return <span aria-hidden="true">→</span> }

function Field({ label, hint, ...props }) {
  return <label className="acct-field"><span>{label}</span><input {...props} />{hint && <small>{hint}</small>}</label>
}

function AuthLayout({ children, eyebrow, title, copy }) {
  return <div className="auth-page"><section className="auth-brand"><Logo /><div><p className="acct-eyebrow">CONTROLLED OPERATIONS</p><h1>Trust starts with knowing <em>who is in control.</em></h1><p>Bullyx gives teams a secure home for agent identities, policy approvals, and payment operations.</p></div><small>Every consequential action stays attributable.</small></section><main className="auth-panel"><div className="auth-card"><p className="acct-eyebrow">{eyebrow}</p><h2>{title}</h2><p className="auth-copy">{copy}</p>{children}</div></main></div>
}

function ConfigurationNotice() {
  return <AuthLayout eyebrow="SETUP REQUIRED" title="Accounts are almost ready." copy="The secure account service still needs to be connected before sign in can go live."><div className="acct-notice"><strong>Site owner action needed</strong><p>Add the Supabase project URL and public anonymous key, run the included database setup, then rebuild the site.</p></div><a className="acct-button" href="/">Back to Bullyx</a></AuthLayout>
}

function Login({ mode = 'login' }) {
  const { signIn, signUp } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const signingUp = mode === 'signup'

  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      if (signingUp) {
        const result = await signUp(email, password)
        if (result.access_token) { await signIn(email, password); navigate('/onboarding') }
        else setMessage('Check your inbox to verify your email, then come back to sign in.')
      } else { await signIn(email, password); navigate('/dashboard') }
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  return <AuthLayout eyebrow={signingUp ? 'CREATE YOUR ACCOUNT' : 'WELCOME BACK'} title={signingUp ? 'Join your operations workspace.' : 'Sign in to Bullyx.'} copy={signingUp ? 'Start with your work email. We’ll help you connect to your organization next.' : 'Access your dashboard, organization requests, and account settings.'}>
    {message ? <div className="acct-success"><b>Email sent</b><p>{message}</p><button className="acct-button" onClick={() => navigate('/login')}>Go to sign in <Arrow /></button></div> : <form className="acct-form" onSubmit={submit}>
      <Field label="Email address" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <Field label="Password" type="password" minLength="8" autoComplete={signingUp ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} hint={signingUp ? 'Use at least 8 characters.' : null} required />
      {error && <p className="acct-error" role="alert">{error}</p>}
      <button className="acct-button" disabled={busy}>{busy ? 'Please wait…' : signingUp ? 'Create account' : 'Sign in'} <Arrow /></button>
    </form>}
    <p className="auth-switch">{signingUp ? 'Already have an account?' : 'New to Bullyx?'} <button onClick={() => navigate(signingUp ? '/login' : '/signup')}>{signingUp ? 'Sign in' : 'Create one'}</button></p>
    {!signingUp && <button className="auth-forgot" onClick={() => navigate('/forgot-password')}>Forgot your password?</button>}
  </AuthLayout>
}

function ForgotPassword() {
  const [email, setEmail] = useState(''); const [sent, setSent] = useState(false); const [error, setError] = useState('')
  async function submit(event) { event.preventDefault(); try { await api.sendPasswordReset(email); setSent(true) } catch (err) { setError(err.message) } }
  return <AuthLayout eyebrow="ACCOUNT RECOVERY" title="Reset your password." copy="We’ll email you a secure link to choose a new password.">{sent ? <div className="acct-success"><b>Check your inbox</b><p>If an account exists for {email}, a reset link is on its way.</p></div> : <form className="acct-form" onSubmit={submit}><Field label="Email address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />{error && <p className="acct-error">{error}</p>}<button className="acct-button">Send reset link <Arrow /></button></form>}<p className="auth-switch"><button onClick={() => navigate('/login')}>Back to sign in</button></p></AuthLayout>
}

function Onboarding() {
  const { user, profile, saveProfile } = useAuth()
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [phone, setPhone] = useState(profile?.phone || '')
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  async function submit(event) { event.preventDefault(); setBusy(true); setError(''); try { await saveProfile({ full_name: fullName.trim(), phone: phone.trim(), onboarding_complete: true }); navigate('/dashboard') } catch (err) { setError(err.message) } finally { setBusy(false) } }
  return <AuthLayout eyebrow="ONE LAST STEP" title="Tell us who you are." copy="This information helps teammates recognize you when reviewing access and approvals."><form className="acct-form" onSubmit={submit}><Field label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" required /><Field label="Phone number" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="+1 415 555 0123" required /><Field label="Account email" value={user.email} disabled />{error && <p className="acct-error">{error}</p>}<button className="acct-button" disabled={busy}>{busy ? 'Saving…' : 'Continue to dashboard'} <Arrow /></button></form><p className="acct-privacy">Your phone number is visible only to you and authorized organization administrators.</p></AuthLayout>
}

function Avatar({ profile, user, large = false }) { const initial = profile?.full_name?.[0] || user?.email?.[0] || '?'; return <span className={`acct-avatar ${large ? 'large' : ''}`}>{profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : initial.toUpperCase()}</span> }

function AppShell({ title, eyebrow, children }) {
  const { user, profile, signOut } = useAuth()
  const [menu, setMenu] = useState(false)
  async function logout() { await signOut(); navigate('/', true) }
  return <div className="app-shell"><aside className={menu ? 'open' : ''}><Logo /><nav><button className={title === 'Dashboard' ? 'active' : ''} onClick={() => { navigate('/dashboard'); setMenu(false) }}>Overview</button><button className={title === 'Settings' ? 'active' : ''} onClick={() => { navigate('/settings'); setMenu(false) }}>Settings</button></nav><div className="side-account"><Avatar profile={profile} user={user} /><div><b>{profile?.full_name || 'Your profile'}</b><small>{user.email}</small></div></div><button className="side-signout" onClick={logout}>Sign out</button></aside><main className="app-main"><header><div><p className="acct-eyebrow">{eyebrow}</p><h1>{title}</h1></div><button className="mobile-profile" onClick={() => setMenu(!menu)} aria-label="Toggle account menu"><Avatar profile={profile} user={user} /></button></header>{children}</main></div>
}

function Dashboard() {
  const { user, profile, session } = useAuth()
  const [memberships, setMemberships] = useState([]); const [myRequests, setMyRequests] = useState([]); const [incoming, setIncoming] = useState([]); const [organizations, setOrganizations] = useState([])
  const [joinId, setJoinId] = useState(''); const [newName, setNewName] = useState(''); const [message, setMessage] = useState(''); const [error, setError] = useState('')
  const token = session.access_token
  const load = useCallback(async function loadDashboard() {
    try {
      const [memberRows, requestRows, orgRows] = await Promise.all([api.getMemberships(token, user.id), api.getMyJoinRequests(token, user.id), api.listOrganizations(token)])
      setMemberships(memberRows); setMyRequests(requestRows); setOrganizations(orgRows)
      const ownedIds = memberRows.filter((item) => item.role === 'owner').map((item) => item.organization.id)
      setIncoming(await api.getIncomingJoinRequests(token, ownedIds))
    } catch (err) { setError(err.message) }
  }, [token, user.id])
  useEffect(() => { load() }, [load])
  const available = useMemo(() => organizations.filter((org) => !memberships.some((item) => item.organization.id === org.id) && !myRequests.some((item) => item.organization.id === org.id && item.status === 'pending')), [organizations, memberships, myRequests])
  async function join(event) { event.preventDefault(); setError(''); try { await api.requestToJoin(token, user.id, joinId); setJoinId(''); setMessage('Request sent to the organization owner.'); await load() } catch (err) { setError(err.message) } }
  async function create(event) { event.preventDefault(); setError(''); try { await api.createOrganization(token, user.id, newName.trim()); setNewName(''); setMessage('Organization created. You are its owner.'); await load() } catch (err) { setError(err.message) } }
  async function decide(item, status) { try { await api.decideJoinRequest(token, item, status); setMessage(status === 'approved' ? 'Member approved.' : 'Request declined.'); await load() } catch (err) { setError(err.message) } }
  return <AppShell title="Dashboard" eyebrow={`GOOD ${new Date().getHours() < 12 ? 'MORNING' : new Date().getHours() < 18 ? 'AFTERNOON' : 'EVENING'}, ${(profile?.full_name || '').split(' ')[0].toUpperCase()}`}><section className="dashboard-intro"><div><h2>Your control center.</h2><p>Manage the teams you belong to and review access requests for organizations you own.</p></div><span className="status-pill"><i /> Account active</span></section>{message && <div className="inline-message">{message}<button onClick={() => setMessage('')} aria-label="Dismiss">×</button></div>}{error && <p className="acct-error">{error}</p>}
    <div className="dashboard-grid"><section className="dash-card organizations-card"><div className="dash-heading"><div><p className="acct-eyebrow">YOUR WORKSPACES</p><h3>Organizations</h3></div><span>{memberships.length}</span></div>{memberships.length ? <div className="org-list">{memberships.map((item) => <article key={item.id}><div className="org-mark">{item.organization.name[0]}</div><div><b>{item.organization.name}</b><small>{item.role === 'owner' ? 'Owner' : 'Member'} · joined {new Date(item.created_at).toLocaleDateString()}</small></div><em>{item.role}</em></article>)}</div> : <div className="empty-state"><span>01</span><h4>No organization yet</h4><p>Join an existing team or create a new Bullyx workspace below.</p></div>}</section>
      <section className="dash-card notifications-card"><div className="dash-heading"><div><p className="acct-eyebrow">ORGANIZATION NOTIFICATIONS</p><h3>Requests to review</h3></div><span>{incoming.length}</span></div>{incoming.length ? <div className="request-list">{incoming.map((item) => <article key={item.id}><Avatar profile={item.profile} user={{ email: item.profile?.email }} /><div><b>{item.profile?.full_name || item.profile?.email}</b><small>wants to join {item.organization.name}</small></div><div><button onClick={() => decide(item, 'rejected')}>Decline</button><button className="approve" onClick={() => decide(item, 'approved')}>Approve</button></div></article>)}</div> : <div className="empty-state compact"><span>✓</span><h4>You’re all caught up</h4><p>New membership requests will appear here.</p></div>}</section>
    </div>
    <div className="dashboard-grid actions-grid"><section className="dash-card"><p className="acct-eyebrow">JOIN A TEAM</p><h3>Request organization access</h3><p className="card-copy">An owner will review your request before access is granted.</p><form className="inline-form" onSubmit={join}><select value={joinId} onChange={(e) => setJoinId(e.target.value)} required><option value="">Select an organization</option>{available.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}</select><button disabled={!available.length}>Request access</button></form>{myRequests.filter((item) => item.status === 'pending').map((item) => <p className="pending-request" key={item.id}>Pending · {item.organization.name}</p>)}</section>
      <section className="dash-card"><p className="acct-eyebrow">START A WORKSPACE</p><h3>Create an organization</h3><p className="card-copy">You’ll become the owner and can approve future members.</p><form className="inline-form" onSubmit={create}><input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Organization name" required minLength="2" maxLength="80" /><button>Create organization</button></form></section></div>
  </AppShell>
}

function Settings() {
  const { user, profile, session, saveProfile } = useAuth()
  const [fullName, setFullName] = useState(profile?.full_name || ''); const [phone, setPhone] = useState(profile?.phone || ''); const [email, setEmail] = useState(user.email || ''); const [avatar, setAvatar] = useState(profile?.avatar_url || '')
  const [newPassword, setNewPassword] = useState('')
  const [message, setMessage] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  async function choosePhoto(event) { const file = event.target.files?.[0]; if (!file) return; if (file.size > 5 * 1024 * 1024) { setError('Choose an image smaller than 5 MB.'); return } setBusy(true); setError(''); try { const next = await api.uploadAvatar(session.access_token, user.id, file); setAvatar(next); await saveProfile({ avatar_url: next }); setMessage('Profile photo updated.') } catch (err) { setError(err.message) } finally { setBusy(false) } }
  async function submit(event) { event.preventDefault(); setBusy(true); setError(''); try { const authChanges = {}; if (email !== user.email) authChanges.email = email; if (newPassword) authChanges.password = newPassword; if (Object.keys(authChanges).length) await api.updateAuthUser(session.access_token, authChanges); setMessage(email !== user.email ? 'Settings saved. Check your new email address to confirm the change.' : 'Settings saved.'); setNewPassword(''); await saveProfile({ full_name: fullName.trim(), phone: phone.trim(), avatar_url: avatar }) } catch (err) { setError(err.message) } finally { setBusy(false) } }
  return <AppShell title="Settings" eyebrow="ACCOUNT & PROFILE"><div className="settings-grid"><section className="dash-card settings-photo"><p className="acct-eyebrow">PROFILE PHOTO</p><Avatar profile={{ ...profile, avatar_url: avatar, full_name: fullName }} user={user} large /><h3>{fullName || 'Your profile'}</h3><p>JPG, PNG, or WebP. Maximum 5 MB.</p><label className="upload-button">{busy ? 'Uploading…' : avatar ? 'Change photo' : 'Upload photo'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} disabled={busy} /></label>{avatar && <button className="remove-photo" onClick={() => setAvatar('')}>Remove photo</button>}</section><section className="dash-card settings-form"><div><p className="acct-eyebrow">PERSONAL INFORMATION</p><h3>Profile details</h3><p className="card-copy">Keep your information current for accurate approvals and team records.</p></div><form className="acct-form" onSubmit={submit}><Field label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required /><Field label="Email address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /><Field label="Phone number" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required /><Field label="New password (optional)" type="password" minLength="8" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} hint="Leave blank to keep your current password." />{message && <p className="settings-success">{message}</p>}{error && <p className="acct-error">{error}</p>}<button className="acct-button" disabled={busy}>{busy ? 'Saving…' : 'Save changes'} <Arrow /></button></form></section></div></AppShell>
}

function Protected({ children }) { const { user, loading } = useAuth(); if (loading) return <div className="acct-loading">Loading your workspace…</div>; if (!user) { setTimeout(() => navigate('/login', true), 0); return null } return children }

export default function AccountApp({ path }) {
  if (!api.isSupabaseConfigured) return <ConfigurationNotice />
  if (path === '/signup') return <Login mode="signup" />
  if (path === '/forgot-password') return <ForgotPassword />
  if (path === '/login') return <Login />
  if (path === '/onboarding') return <Protected><Onboarding /></Protected>
  if (path === '/settings') return <Protected><Settings /></Protected>
  return <Protected><Dashboard /></Protected>
}
