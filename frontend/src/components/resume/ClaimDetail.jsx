import Icon from '../Icon'
import { dueText, KINDS, LEVELS } from './levels'

// One claim, opened from the resume: what it says, what they'll ask, and every answer you gave, newest first.
// With two answers or more, the newest is compared with the one before (your "ghost").
export default function ClaimDetail({ claim }) {
  const attempts = [...claim.attempts].reverse()
  const latest = attempts[0]
  const previous = attempts[1]

  return (
    <section className={`card claim-detail level-${claim.level}`}>
      <div className="claim-chips">
        <span className={`chip level-chip level-${claim.level}`}>{LEVELS[claim.level].name}</span>
        <span className="chip">{KINDS[claim.kind] || claim.kind}</span>
        {claim.status === 'changed' && <span className="chip chip-follow">Changed in this version</span>}
        <span className="chip">
          <Icon name="clock" size={12} />
          {dueText(claim.due)}
        </span>
      </div>

      <blockquote className="claim-quote">{claim.quote}</blockquote>
      {claim.before && (
        <p className="claim-before small">
          It used to say: <s>{claim.before}</s>
        </p>
      )}

      {latest && previous && <Ghost latest={latest} previous={previous} />}

      <h3 className="claim-heading">They'll probably ask</h3>
      <ul className="claim-likely">
        {claim.likely_questions.map((question) => (
          <li key={question}>{question}</li>
        ))}
      </ul>

      <h3 className="claim-heading">Your answers</h3>
      {attempts.length === 0 && <p className="muted small">Not asked yet. Start a grind and it comes up first.</p>}
      {attempts.map((attempt, i) => (
        <details key={attempt.at} className="claim-attempt" open={i === 0}>
          <summary>
            <span className={`attempt-score score-${attempt.score >= 4 ? 'good' : attempt.score >= 3 ? 'mid' : 'bad'}`}>{attempt.score}/5</span>
            <span className="attempt-question">{attempt.question}</span>
            <span className="muted small">{new Date(attempt.at).toLocaleDateString()}</span>
          </summary>
          <p className="attempt-answer">{attempt.answer}</p>
          <p className="attempt-feedback small">
            <Icon name="sparkle" size={13} /> {attempt.feedback}
          </p>
          {attempt.missed.length > 0 && (
            <p className="muted small">
              <b>Missing:</b> {attempt.missed.join(' · ')}
            </p>
          )}
          {attempt.follow_ups.map((followUp) => (
            <div key={followUp.question} className="attempt-follow small">
              <b>Follow-up ({followUp.score}/5):</b> {followUp.question}
              <p>{followUp.answer}</p>
            </div>
          ))}
        </details>
      ))}
    </section>
  )
}

// Your newest answer against the one before: "Last time 2/5 -> now 4/5 (+2)".
function Ghost({ latest, previous }) {
  const change = latest.score - previous.score
  let word = 'the same as last time'
  if (change > 0) word = `+${change}, better than last time`
  if (change < 0) word = `${change}, worse than last time`
  return (
    <div className={`claim-ghost${change > 0 ? ' up' : change < 0 ? ' down' : ''}`}>
      <span className="muted small">Last time</span>
      <b>{previous.score}/5</b>
      <Icon name="arrow" size={14} />
      <span className="muted small">now</span>
      <b>{latest.score}/5</b>
      <span className="small">({word})</span>
    </div>
  )
}
