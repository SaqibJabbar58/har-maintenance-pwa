import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

// Executive Dashboard (Step 3) — summary cards + recent tickets + pending
// approvals queue. Pulls from the v_dashboard_summary view for speed.
export default function ExecutiveDashboard({ onOpenApproval }) {
  const [summary, setSummary] = useState(null)
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function load() {
      const [{ data: s }, { data: p }] = await Promise.all([
        supabase.from('v_dashboard_summary').select('*').single(),
        supabase
          .from('tickets')
          .select('id, ticket_no, location, estimated_amount, photo_url, created_at, ticket_categories(name)')
          .eq('status', 'pending_approval')
          .order('created_at', { ascending: false }),
      ])
      if (!active) return
      setSummary(s)
      setPending(p || [])
      setLoading(false)
    }
    load()

    // Live updates: refresh when tickets change
    const channel = supabase
      .channel('dashboard-tickets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, load)
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [])

  if (loading) return <div className="p-6 text-slate-500">Loading dashboard…</div>

  const cards = [
    { label: 'New Tickets', value: summary.new_tickets, color: 'bg-blue-600' },
    { label: 'Open', value: summary.open_tickets, color: 'bg-amber-500' },
    { label: 'Pending Approval', value: summary.pending_approvals, color: 'bg-rose-600' },
    { label: 'Resolved (30d)', value: summary.resolved_last_30d, color: 'bg-emerald-600' },
    { label: 'Compliance Due', value: summary.compliance_due, color: 'bg-amber-500' },
    { label: 'Compliance Expired', value: summary.compliance_expired, color: 'bg-rose-600' },
  ]

  return (
    <div className="p-4 space-y-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-semibold text-slate-900">Executive Dashboard</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl bg-white shadow-sm border border-slate-100 p-4">
            <div className={`w-2 h-2 rounded-full ${c.color} mb-2`} />
            <div className="text-2xl font-bold text-slate-900">{c.value ?? 0}</div>
            <div className="text-sm text-slate-500">{c.label}</div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-medium text-slate-900 mb-2">Pending Your Approval</h2>
        {pending.length === 0 && (
          <p className="text-sm text-slate-500">Nothing waiting on you right now.</p>
        )}
        <div className="space-y-2">
          {pending.map((t) => (
            <button
              key={t.id}
              onClick={() => onOpenApproval(t.id)}
              className="w-full flex items-center gap-3 bg-white border border-slate-100 rounded-xl p-3 shadow-sm text-left active:scale-[0.99] transition"
            >
              {t.photo_url && (
                <img src={t.photo_url} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-900 truncate">
                  {t.ticket_no} · {t.ticket_categories?.name}
                </div>
                <div className="text-sm text-slate-500 truncate">{t.location}</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="font-semibold text-slate-900">
                  PKR {Number(t.estimated_amount).toLocaleString()}
                </div>
                <div className="text-xs text-rose-600">Approve →</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
