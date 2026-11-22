import { claimsOnLine, LEVELS } from './levels'

// Your resume, line by line, as a heatmap: every line with a claim is coloured by how well you defend it.
// A click on a coloured line opens that claim (onPick). Lines without a claim stay plain.
export default function ResumeLines({ lines, claims, picked, onPick }) {
  return (
    <div className="resume-lines">
      {lines.map((line, index) => {
        const here = claimsOnLine(claims, index)
        if (here.length === 0) {
          return (
            <p key={index} className="resume-line">
              {line}
            </p>
          )
        }
        const claim = here[0]
        const starts = claim.line === index // the tag goes on the claim's first line only
        const isPicked = here.some((c) => c.id === picked)
        return (
          <button
            key={index}
            className={`resume-line claim-line level-${claim.level}${isPicked ? ' picked' : ''}${starts ? ' starts' : ''}`}
            onClick={() => onPick(claim.id)}
            title={`${LEVELS[claim.level].name}. Click to see its questions and your answers.`}
          >
            <span className="claim-text">{line}</span>
            {starts && <ClaimTag claim={claim} />}
          </button>
        )
      })}
    </div>
  )
}

// The little tag at the end of a claim's first line: its last score, "not asked" or "changed".
function ClaimTag({ claim }) {
  let text = claim.score === null ? 'not asked' : `${claim.score}/5`
  if (claim.status === 'changed') text = 'changed'
  return <span className={`claim-tag level-${claim.level}`}>{text}</span>
}
