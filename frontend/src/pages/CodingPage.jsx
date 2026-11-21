import CodingSession from '../components/coding/CodingSession'
import CodingSetup from '../components/coding/CodingSetup'

// #/coding        -> pick a problem and a mode, see past rounds
// #/coding/<id>   -> that round: problem, editor, tests and Bella, then its report
export default function CodingPage({ arg }) {
  if (arg) return <CodingSession key={arg} id={arg} />
  return <CodingSetup />
}
