import { formatValue, humanize, operatorLabels } from '../utils'

export default function RuleSummary({ rule }) {
  return (
    <div className="rule-summary">
      <div className="logic-line">
        <span className="logic-keyword">WHEN</span>
        <div className="condition-list">
          {rule.conditions.map((condition, index) => (
            <span className="condition-chip" key={`${condition.field}-${index}`}>
              <strong>{humanize(condition.field)}</strong>{' '}
              {operatorLabels[condition.operator] || condition.operator}{' '}
              <em>{formatValue(condition.value)}</em>
            </span>
          ))}
        </div>
      </div>
      <div className="logic-line logic-line--result">
        <span className="logic-keyword">THEN</span>
        <strong className="action-value">{rule.action}</strong>
      </div>
      <div className="approval-row">
        <span>Approvals</span>
        {rule.required_approvals.length ? (
          rule.required_approvals.map((approval) => (
            <span className="approval-chip" key={approval}>
              {humanize(approval)}
            </span>
          ))
        ) : (
          <span className="no-approval">None — automatic</span>
        )}
      </div>
    </div>
  )
}
