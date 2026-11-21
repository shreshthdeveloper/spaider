import InterviewSession from '../components/interview/InterviewSession'
import InterviewSetup from '../components/interview/InterviewSetup'
import PastInterviews from '../components/interview/PastInterviews'

// #/interview        -> tab 1: start a new interview
// #/interview/past   -> tab 2: past interviews and your scores
// #/interview/<id>   -> that interview: the questions while it runs, then its report
export default function InterviewPage({ arg }) {
  if (arg === 'past') return <PastInterviews />
  if (arg) return <InterviewSession key={arg} id={arg} />
  return <InterviewSetup />
}
