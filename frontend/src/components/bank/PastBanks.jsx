import { useEffect, useState } from 'react'
import { QUESTION_TYPES } from '../../lib/agents'
import { deleteBank, listBanks } from '../../lib/api'
import { formatDate } from '../../lib/format'
import ConfirmDialog from '../ConfirmDialog'
import Icon from '../Icon'
import SpiderLoader from '../SpiderLoader'
import BankTabs from './BankTabs'

// Tab 2 of the question bank: every bank the panel made.
export default function PastBanks() {
  const [banks, setBanks] = useState(null) // null = loading
  const [deleting, setDeleting] = useState(null) // the bank waiting for "Delete?" to be confirmed
  const [error, setError] = useState('')

  useEffect(() => {
    listBanks()
      .then((data) => setBanks(data.banks))
      .catch((err) => {
        setBanks([])
        setError(err.message)
      })
  }, [])

  async function confirmDelete() {
    const bank = deleting
    setDeleting(null)
    try {
      await deleteBank(bank.id)
      setBanks(banks.filter((b) => b.id !== bank.id))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="page interview-page bank-page">
      <BankTabs current="past" count={banks?.length} />
      {banks === null && <SpiderLoader label="Loading your banks…" />}
      {error && <p className="inline-error">{error}</p>}
      {banks?.length === 0 && !error && (
        <section className="card">
          <p className="muted">No question banks yet.</p>
          <a className="button-link primary" href="#/bank">
            <Icon name="plus" size={15} />
            Make your first bank
          </a>
        </section>
      )}

      {banks?.length > 0 && (
        <section className="card past-banks">
          {banks.map((bank) => (
            <div key={bank.id} className="past-bank">
              <a className="past-bank-main" href={`#/bank/${bank.id}`}>
                <span className="past-bank-title">{bank.title}</span>
                <span className="muted small">
                  {formatDate(bank.created_at)} · {bank.level} · {bank.agents} agents
                </span>
              </a>
              <span className="past-bank-counts">
                {Object.entries(QUESTION_TYPES).map(([kind, type]) =>
                  bank.counts[kind] ? (
                    <span key={kind} className="q-type">
                      <Icon name={type.icon} size={12} />
                      {bank.counts[kind]} {type.label}
                    </span>
                  ) : null,
                )}
                {bank.status !== 'done' && <span className="badge badge-progress">{bank.status}</span>}
              </span>
              <button
                className="icon-btn"
                onClick={() => setDeleting(bank)}
                disabled={bank.status === 'running'}
                aria-label={`Delete ${bank.title}`}
                title="Delete"
              >
                <Icon name="trash" size={15} />
              </button>
            </div>
          ))}
        </section>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        icon="trash"
        title="Delete this question bank?"
        text={deleting ? `“${deleting.title}” and its questions will be gone. Rounds you practised stay.` : ''}
        confirmLabel="Delete"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
