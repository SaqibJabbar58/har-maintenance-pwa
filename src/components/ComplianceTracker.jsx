import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const STATUS_STYLES = {
  valid: { dot: 'bg-emerald-500', label: 'Valid', text: 'text-emerald-700' },
  renewal_due: { dot: 'bg-amber-500', label: 'Renewal Due', text: 'text-amber-700' },
  expired: { dot: 'bg-rose-500', label: 'Expired', text: 'text-rose-700' },
}

// Compliance & Certification Tracker (Step 3)
// Green/Yellow/Red status is computed in the DB (generated column) — this
// component just renders it and lets admins add/update docs.
export default function ComplianceTracker() {
  const [docs, setDocs] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('compliance_docs')
      .select('*')
      .order('expiry_date', { ascending: true })
      .then(({ data }) => {
        setDocs(data || [])
        setLoading(false)
      })
  }, [])

  const filtered = filter === 'all' ? docs : docs.filter((d) => d.status === filter)

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Compliance & Certifications</h1>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {['all', 'valid', 'renewal_due', 'expired'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${
              filter === f ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {f === 'all' ? 'All' : STATUS_STYLES[f].label}
          </button>
        ))}
      </div>

      {loading && <div className="text-slate-500 text-sm">Loading…</div>}

      <div className="space-y-2">
        {filtered.map((d) => {
          const s = STATUS_STYLES[d.status]
          const daysLeft = Math.ceil((new Date(d.expiry_date) - new Date()) / 86400000)
          return (
            <div key={d.id} className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${s.dot} flex-shrink-0`} />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-900 truncate">{d.doc_type}</div>
                <div className="text-sm text-slate-500 truncate">{d.doc_name}</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className={`text-sm font-medium ${s.text}`}>{s.label}</div>
                <div className="text-xs text-slate-400">
                  {daysLeft >= 0 ? `${daysLeft}d left` : `${Math.abs(daysLeft)}d overdue`}
                </div>
              </div>
            </div>
          )
        })}
        {!loading && filtered.length === 0 && (
          <p className="text-sm text-slate-500">No documents in this view.</p>
        )}
      </div>
    </div>
  )
}
