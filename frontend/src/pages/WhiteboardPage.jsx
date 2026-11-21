import WhiteboardSession from '../components/whiteboard/WhiteboardSession'
import WhiteboardSetup from '../components/whiteboard/WhiteboardSetup'

// #/whiteboard        -> pick a system design question, see past rounds
// #/whiteboard/<id>   -> that round: the board and the interviewer, then its report
export default function WhiteboardPage({ arg }) {
  if (arg) return <WhiteboardSession key={arg} id={arg} />
  return <WhiteboardSetup />
}
