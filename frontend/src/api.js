const API_PREFIX = '/api'

async function request(path, options = {}) {
  const response = await fetch(`${API_PREFIX}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const payload = await response.json()
      if (Array.isArray(payload.detail)) {
        message = payload.detail.map((item) => item.msg || String(item)).join('; ')
      } else {
        message = payload.detail || message
      }
    } catch {
      // Keep the status-based message for non-JSON errors.
    }
    throw new Error(message)
  }

  return response.status === 204 ? null : response.json()
}

export const api = {
  health: () => request('/health'),
  sources: () => request('/sources'),
  knowledgeItems: (sourceType = '') =>
    request(`/knowledge/items${sourceType ? `?source_type=${encodeURIComponent(sourceType)}` : ''}`),
  knowledgeSearch: (payload) =>
    request('/knowledge/search', { method: 'POST', body: JSON.stringify(payload) }),
  knowledgeConnectors: () => request('/knowledge/connectors'),
  knowledgeEntities: (limit = 30) => request(`/knowledge/entities?limit=${limit}`),
  brainQuery: (payload) =>
    request('/brain/query', { method: 'POST', body: JSON.stringify(payload) }),
  brainAnalyze: (payload) =>
    request('/brain/analyze', { method: 'POST', body: JSON.stringify(payload) }),
  brainFeedback: (payload) =>
    request('/brain/feedback', { method: 'POST', body: JSON.stringify(payload) }),
  policies: (status) => request(`/policies${status ? `?status=${status}` : ''}`),
  extract: () => request('/extract', { method: 'POST' }),
  approve: (id, payload = {}) =>
    request(`/policies/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  reject: (id, reason = null) =>
    request(`/policies/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  history: (id) => request(`/policies/${id}/history`),
  decide: (situation) =>
    request('/decide', { method: 'POST', body: JSON.stringify(situation) }),
  audit: () => request('/audit'),
  verifyAudit: () => request('/audit/verify'),
}
