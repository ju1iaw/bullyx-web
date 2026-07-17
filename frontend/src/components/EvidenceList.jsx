import { formatDate } from '../utils'

const typeLabels = {
  slack_message: 'Slack',
  ticket: 'Ticket',
  doc: 'Document',
}

export default function EvidenceList({ documents = [], compact = false }) {
  if (!documents.length) {
    return <p className="empty-inline">No evidence documents linked.</p>
  }

  return (
    <div className={`evidence-list ${compact ? 'evidence-list--compact' : ''}`}>
      {documents.map((document) => (
        <article className="evidence-item" key={document.id}>
          <div className="evidence-meta">
            <span className={`source-type source-type--${document.type}`}>
              {typeLabels[document.type] || document.type}
            </span>
            <code>{document.id}</code>
            <span>{formatDate(document.timestamp, false)}</span>
          </div>
          <blockquote>{document.text}</blockquote>
          <footer>
            <span>{document.author}</span>
            {document.thread_id && <span>Thread {document.thread_id}</span>}
          </footer>
        </article>
      ))}
    </div>
  )
}
