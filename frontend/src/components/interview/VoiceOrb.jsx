// The interviewer, drawn as a glowing orb. It grows with the sound while someone is talking.
//   speaking  = teal, moves with the interviewer's voice
//   listening = coral, moves with your voice
//   thinking  = amber, slow pulse while your answer is graded
//   idle      = soft breathing
const LABELS = {
  idle: 'Interviewer',
  speaking: 'Interviewer is speaking',
  listening: 'Listening to you',
  transcribing: 'Turning your speech into text',
  thinking: 'Reading your answer',
}

export default function VoiceOrb({ mode = 'idle', level = 0, size = 64 }) {
  const loudness = Math.min(level, 1)
  return (
    <div className={`orb orb-${mode}`} style={{ width: size, height: size }} role="img" aria-label={LABELS[mode]}>
      <div className="orb-ring" style={{ transform: `scale(${1 + loudness * 0.55})` }} />
      <div className="orb-core" style={{ transform: `scale(${0.82 + loudness * 0.3})` }} />
    </div>
  )
}
