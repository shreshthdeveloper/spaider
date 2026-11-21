import EvalRun from '../components/evals/EvalRun'
import EvalsOverview from '../components/evals/EvalsOverview'

// #/evals       -> every suite: latest scores, history, and "Run now"
// #/evals/<id>  -> one run, case by case
export default function EvalsPage({ arg }) {
  if (arg) return <EvalRun key={arg} id={arg} />
  return <EvalsOverview />
}
