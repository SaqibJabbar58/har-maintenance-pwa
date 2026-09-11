import { useState } from 'react'
import ExecutiveDashboard from './components/ExecutiveDashboard'
import TicketCreate from './components/TicketCreate'
import ApprovalModal from './components/ApprovalModal'
import ComplianceTracker from './components/ComplianceTracker'

// Minimal shell — swap in a real router (react-router) once auth is wired up.
// currentUser would normally come from a Supabase Auth session/context.
export default function App({ currentUser }) {
  const [tab, setTab] = useState('dashboard')
  const [approvalTicketId, setApprovalTicketId] = useState(null)

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {tab === 'dashboard' && (
        <ExecutiveDashboard onOpenApproval={setApprovalTicketId} />
      )}
      {tab === 'new-ticket' && (
        <TicketCreate userId={currentUser.id} onCreated={() => setTab('dashboard')} />
      )}
      {tab === 'compliance' && <ComplianceTracker />}

      {approvalTicketId && (
        <ApprovalModal
          ticketId={approvalTicketId}
          approverId={currentUser.id}
          onClose={() => setApprovalTicketId(null)}
          onDecided={() => setApprovalTicketId(null)}
        />
      )}

      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-100 flex justify-around py-2">
        {[
          { key: 'dashboard', label: 'Dashboard' },
          { key: 'new-ticket', label: 'New Ticket' },
          { key: 'compliance', label: 'Compliance' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`text-sm px-3 py-1 rounded-lg ${
              tab === t.key ? 'text-brand-600 font-medium' : 'text-slate-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
