export const operatorLabels = {
  eq: 'equals',
  neq: 'does not equal',
  lt: 'is less than',
  lte: 'is at most',
  gt: 'is greater than',
  gte: 'is at least',
  in: 'is one of',
  not_in: 'is not one of',
  contains: 'contains',
  exists: 'exists',
}

export function humanize(value) {
  return String(value).replaceAll('_', ' ')
}

export function formatValue(value) {
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (value === null || value === undefined) return '—'
  return String(value)
}

export function formatDate(value, includeTime = true) {
  const date = new Date(value)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    ...(includeTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  }).format(date)
}

export function shortHash(value) {
  if (!value) return 'GENESIS'
  return `${value.slice(0, 10)}…${value.slice(-6)}`
}
