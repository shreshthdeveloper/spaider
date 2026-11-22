// SpAIder's spider, drawn in SVG. Two ways to use her:
//   <SpiderArt />        just the drawing (the logo uses this; she stays still, and only blinks).
//                        mood="okay" | "itchy" | "angry" | "bored" changes her face (your pet spider uses it)
//                        elder: an old, wise spider (the question bank's judge): white hair, glasses, moustache
//                        talk: how loud she is talking, 0 to 1 (the panel call): her mouth opens with her voice
//   <SpiderLoader />     the drawing, bobbing on her thread with wiggling legs, and a label
// The movement is in CSS (see "SpiderLoader" in base.css), so no images or libraries.

// Four legs a side: where each leg leaves the body (y), where its knee bends (knee), where its foot is (foot).
const LEGS = [
  { y: 54, knee: 40, foot: 50 },
  { y: 60, knee: 50, foot: 62 },
  { y: 66, knee: 60, foot: 76 },
  { y: 71, knee: 70, foot: 88 },
]

// Her mouth in each mood (no mood = her usual smile).
const MOUTHS = {
  okay: 'M46 70 Q50 71.5 54 70',
  itchy: 'M45 70 Q47.5 67.5 50 70 Q52.5 72.5 55 70',
  angry: 'M46 72 Q50 67.5 54 72',
  bored: 'M46.5 70.5 L53.5 70.5',
}
const SMILE = 'M46 69 Q50 73 54 69'
const TALK_FROM = 0.04 // quieter than this, she smiles; louder, her mouth opens (bigger the louder)

export function SpiderArt({ mood, elder = false, talk = 0 }) {
  return (
    <svg className="spider-art" viewBox="0 0 100 120" aria-hidden="true">
      <g className="spider-sway">
        <g className="spider-bob">
          {/* the silk thread comes from far above, so it always reaches the top edge */}
          <line className="spider-thread" x1="50" y1="-300" x2="50" y2="44" />

          <g className="spider-legs left">
            {LEGS.map((leg, i) => (
              <path key={i} d={`M36 ${leg.y} Q20 ${leg.knee} 10 ${leg.foot}`} style={{ '--i': i }} />
            ))}
          </g>
          <g className="spider-legs right">
            {LEGS.map((leg, i) => (
              <path key={i} d={`M64 ${leg.y} Q80 ${leg.knee} 90 ${leg.foot}`} style={{ '--i': i }} />
            ))}
          </g>

          <circle className="spider-body" cx="50" cy="62" r="19" />
          <ellipse className="spider-shine" cx="43" cy="51" rx="6" ry="3.5" />

          <g className="spider-eyes">
            <circle cx="43" cy="60" r="5.5" fill="#fff" />
            <circle cx="57" cy="60" r="5.5" fill="#fff" />
            <circle className="spider-pupil" cx="44" cy="61" r="2.7" />
            <circle className="spider-pupil" cx="58" cy="61" r="2.7" />
            <circle cx="45" cy="59.8" r="0.9" fill="#fff" />
            <circle cx="59" cy="59.8" r="0.9" fill="#fff" />
          </g>

          {/* bored: heavy eyelids over the top half of each eye */}
          {mood === 'bored' && (
            <g className="spider-lids">
              <path d="M37.2 60 A5.8 5.8 0 0 1 48.8 60 Z" />
              <path d="M51.2 60 A5.8 5.8 0 0 1 62.8 60 Z" />
            </g>
          )}
          {/* angry: brows pressed down towards the middle */}
          {mood === 'angry' && (
            <g className="spider-brows">
              <path d="M37.5 52 L47 55.5" />
              <path d="M62.5 52 L53 55.5" />
            </g>
          )}

          {/* elder: a few white hairs, round glasses, bushy white brows and a moustache */}
          {elder && (
            <g className="spider-elder">
              <path className="spider-hair" d="M44 45 Q44 39 47.5 41.5 M50 44 Q50.5 37.5 53.5 40.5 M55.5 45 Q58.5 40.5 59 44.5" />
              <circle className="spider-glasses" cx="43" cy="60" r="6.6" />
              <circle className="spider-glasses" cx="57" cy="60" r="6.6" />
              <path className="spider-glasses" d="M49.6 59.5 L50.4 59.5" />
              <path className="spider-old-brows" d="M37 52 Q42 49.5 47 52 M53 52 Q58 49.5 63 52" />
              <path className="spider-moustache" d="M45 67.5 Q47.5 65.3 50 66.8 Q52.5 65.3 55 67.5" />
            </g>
          )}

          <ellipse className="spider-cheek" cx="37" cy="68" rx="3.2" ry="2" />
          <ellipse className="spider-cheek" cx="63" cy="68" rx="3.2" ry="2" />
          {talk > TALK_FROM ? (
            <ellipse className="spider-mouth" cx="50" cy="70.5" rx={3 + talk * 1.5} ry={0.8 + Math.min(1, talk * 1.8) * 3.2} />
          ) : (
            <path className="spider-smile" d={MOUTHS[mood] || SMILE} />
          )}
        </g>
      </g>
    </svg>
  )
}

//   label  what is loading, shown next to her (optional)
//   size   'small' (beside a line of text) | 'medium' | 'large' (over a whole screen)
export default function SpiderLoader({ label, size = 'medium' }) {
  return (
    <div className={`spider-loader ${size}`} role="status">
      <SpiderArt />
      {label && <span className="spider-label">{label}</span>}
    </div>
  )
}
