const url = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const isSupabaseConfigured = Boolean(url && anonKey)
const sessionKey = 'bullyx.auth.session'

function headers(token, extra = {}) {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${token || anonKey}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

async function request(path, options = {}, token) {
  if (!isSupabaseConfigured) throw new Error('Bullyx accounts are not connected yet.')
  const response = await fetch(`${url}${path}`, { ...options, headers: headers(token, options.headers) })
  const data = response.status === 204 ? null : await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.msg || data?.message || data?.error_description || data?.error || 'Something went wrong.')
  return data
}

function saveSession(session) {
  if (session) localStorage.setItem(sessionKey, JSON.stringify(session))
  else localStorage.removeItem(sessionKey)
}

export function getStoredSession() {
  try { return JSON.parse(localStorage.getItem(sessionKey)) }
  catch { return null }
}

export function consumeCallbackSession() {
  if (!window.location.hash) return null
  const params = new URLSearchParams(window.location.hash.slice(1))
  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')
  if (!accessToken || !refreshToken) return null
  const session = {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: Math.floor(Date.now() / 1000) + Number(params.get('expires_in') || 3600),
    token_type: params.get('token_type') || 'bearer',
  }
  saveSession(session)
  window.history.replaceState({}, '', window.location.pathname)
  return session
}

export async function hydrateSessionUser(session) {
  const user = await request('/auth/v1/user', {}, session.access_token)
  const next = { ...session, user }
  saveSession(next)
  return next
}

export async function refreshSession(session) {
  if (!session?.refresh_token) return null
  try {
    const next = await request('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', body: JSON.stringify({ refresh_token: session.refresh_token }),
    })
    saveSession(next)
    return next
  } catch {
    saveSession(null)
    return null
  }
}

export async function signUp(email, password) {
  return request(`/auth/v1/signup?redirect_to=${encodeURIComponent(`${window.location.origin}/login`)}`, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export async function signIn(email, password) {
  const session = await request('/auth/v1/token?grant_type=password', {
    method: 'POST', body: JSON.stringify({ email, password }),
  })
  saveSession(session)
  return session
}

export async function signOut(token) {
  try { await request('/auth/v1/logout', { method: 'POST' }, token) } finally { saveSession(null) }
}

export async function updateAuthUser(token, values) {
  return request('/auth/v1/user', { method: 'PUT', body: JSON.stringify(values) }, token)
}

export async function sendPasswordReset(email) {
  return request(`/auth/v1/recover?redirect_to=${encodeURIComponent(`${window.location.origin}/settings`)}`, {
    method: 'POST', body: JSON.stringify({ email }),
  })
}

export async function getProfile(token, userId) {
  const rows = await request(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=*`, {}, token)
  return rows[0] || null
}

export async function saveProfile(token, profile) {
  const rows = await request('/rest/v1/profiles?on_conflict=id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(profile),
  }, token)
  return rows[0]
}

export async function listOrganizations(token) {
  return request('/rest/v1/organizations?select=id,name,created_at&order=name.asc', {}, token)
}

export async function getMemberships(token, userId) {
  return request(`/rest/v1/organization_members?user_id=eq.${userId}&select=id,role,created_at,organization:organizations(id,name,created_by)`, {}, token)
}

export async function getMyJoinRequests(token, userId) {
  return request(`/rest/v1/organization_join_requests?user_id=eq.${userId}&select=id,status,created_at,organization:organizations(id,name)&order=created_at.desc`, {}, token)
}

export async function getIncomingJoinRequests(token, organizationIds) {
  if (!organizationIds.length) return []
  return request(`/rest/v1/organization_join_requests?organization_id=in.(${organizationIds.join(',')})&status=eq.pending&select=id,user_id,status,created_at,organization:organizations(id,name),profile:profiles!organization_join_requests_user_id_fkey(full_name,email,avatar_url)&order=created_at.desc`, {}, token)
}

export async function requestToJoin(token, userId, organizationId) {
  try {
    return await request('/rest/v1/organization_join_requests', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ user_id: userId, organization_id: organizationId }),
    }, token)
  } catch (error) {
    const rows = await request(`/rest/v1/organization_join_requests?user_id=eq.${userId}&organization_id=eq.${organizationId}&status=eq.rejected`, {
      method: 'PATCH', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ status: 'pending', reviewed_at: null, created_at: new Date().toISOString() }),
    }, token)
    if (!rows?.length) throw error
    return rows
  }
}

export async function createOrganization(token, userId, name) {
  const organizations = await request('/rest/v1/organizations', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ name, created_by: userId }),
  }, token)
  const organization = organizations[0]
  await request('/rest/v1/organization_members', {
    method: 'POST', body: JSON.stringify({ organization_id: organization.id, user_id: userId, role: 'owner' }),
  }, token)
  return organization
}

export async function decideJoinRequest(token, requestItem, status) {
  if (status === 'approved') {
    await request('/rest/v1/organization_members', {
      method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates' },
      body: JSON.stringify({ organization_id: requestItem.organization.id, user_id: requestItem.user_id, role: 'member' }),
    }, token)
  }
  await request(`/rest/v1/organization_join_requests?id=eq.${requestItem.id}`, {
    method: 'PATCH', body: JSON.stringify({ status, reviewed_at: new Date().toISOString() }),
  }, token)
}

export async function uploadAvatar(token, userId, file) {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${userId}/avatar-${Date.now()}.${extension}`
  const response = await fetch(`${url}/storage/v1/object/avatars/${path}`, {
    method: 'POST',
    headers: { apikey: anonKey, Authorization: `Bearer ${token}`, 'Content-Type': file.type, 'x-upsert': 'true' },
    body: file,
  })
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.message || 'Could not upload that photo.')
  return `${url}/storage/v1/object/public/avatars/${path}`
}
