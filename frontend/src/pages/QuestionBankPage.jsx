import BankSetup from '../components/bank/BankSetup'
import BankView from '../components/bank/BankView'
import PastBanks from '../components/bank/PastBanks'

// #/bank        -> tab 1: the role, what the panel reads, and who is on the panel
// #/bank/past   -> tab 2: every bank made so far
// #/bank/<id>   -> that bank: the panel at work, then its questions
export default function QuestionBankPage({ arg }) {
  if (arg === 'past') return <PastBanks />
  if (arg) return <BankView key={arg} id={arg} />
  return <BankSetup />
}
