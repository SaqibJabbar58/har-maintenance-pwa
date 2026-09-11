import { useEffect, useState } from 'react'
import { supabase, uploadToBucket } from '../lib/supabaseClient'
import { useAudioRecorder } from '../hooks/useAudioRecorder'

// 3-Click Executive Approval Engine (Step 3)
// Approve / Reject / Voice Reply — designed for a one-hand mobile tap.
export default function ApprovalModal({ ticketId, approverId, onClose, onDecided }) {
  const [ticket, setTicket] = useState(null)
  const [approval, setApproval] = useState(null)
  const [busy, setBusy] = useState(false)
  const { isRecording, seconds, audioBlob, start, stop, reset } = useAudioRecorder()

  useEffect(() => {
    async function load() {
      const { data: t } = await supabase
        .from('tickets')
        .select('*, ticket_categories(name)')
        .eq('id', ticketId)
        .single()
      const { data: a } = await supabase
        .from('approvals')
        .select('*')
        .eq('ticket_id', ticketId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      setTicket(t)
      setApproval(a)
    }
    load()
  }, [ticketId])

  async function decide(status, note = null) {
    if (!approval) return
    setBusy(true)
    try {
      let voice_reply_url = null
      if (audioBlob) {
        const file = new File([audioBlob], 'voice-reply.webm', { type: audioBlob.type })
        voice_reply_url = await uploadToBucket('maintenance-voice-notes', file, 'replies/')
      }

      await supabase.from('approvals').update({
        status,
        approver_id: approverId,
        decision_note: note,
        voice_reply_url,
        decided_at: new Date().toISOString(),
      }).eq('id', approval.id)

      await supabase.from('tickets').update({
        status: status === 'approved' ? 'in_progress'
              : status === 'rejected' ? 'rejected'
              : 'pending_approval', // voice_query keeps it pending
      }).eq('id', ticketId)

      await supabase.from('activity_log').insert({
        ticket_id: ticketId,
        actor_id: approverId,
        action: status,
      })

      onDecided?.(status)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  if (!ticket) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-xs text-slate-400">{ticket.ticket_no}</div>
            <h2 className="text-lg font-semibold text-slate-900">{ticket.ticket_categories?.name}</h2>
            <div className="text-sm text-slate-500">{ticket.location}</div>
          </div>
          <button onClick={onClose} className="text-slate-400 text-xl leading-none">×</button>
        </div>

        {ticket.photo_url && (
          <img src={ticket.photo_url} alt="Item" className="w-full h-40 object-cover rounded-lg" />
        )}
        {approval?.vendor_quotation_url && (
          <div>
            <div className="text-xs text-slate-500 mb-1">Vendor Quotation</div>
            <img src={approval.vendor_quotation_url} alt="Quotation" className="w-full h-32 object-cover rounded-lg" />
          </div>
        )}
        {ticket.voice_note_url && (
          <audio controls src={ticket.voice_note_url} className="w-full h-9" />
        )}

        <div className="text-center py-2">
          <div className="text-sm text-slate-500">Estimated Amount</div>
          <div className="text-3xl font-bold text-slate-900">
            PKR {Number(ticket.estimated_amount).toLocaleString()}
          </div>
        </div>

        {/* Optional voice reply, recorded before deciding */}
        <div className="flex items-center gap-2 justify-center">
          {!isRecording && !audioBlob && (
            <button onClick={start} className="text-sm text-slate-500 underline">
              🎤 Add voice reply
            </button>
          )}
          {isRecording && (
            <button onClick={stop} className="text-sm text-rose-600 animate-pulse">
              ⏹ Stop ({seconds}s)
            </button>
          )}
          {audioBlob && !isRecording && (
            <>
              <audio controls src={URL.createObjectURL(audioBlob)} className="h-8" />
              <button onClick={reset} className="text-xs text-slate-400">Redo</button>
            </>
          )}
        </div>

        {/* 3-click actions */}
        <div className="grid grid-cols-3 gap-2 pt-2">
          <button
            disabled={busy}
            onClick={() => decide('rejected')}
            className="py-3 rounded-xl bg-rose-50 text-rose-700 font-medium"
          >
            Reject
          </button>
          <button
            disabled={busy}
            onClick={() => decide('voice_query')}
            className="py-3 rounded-xl bg-amber-50 text-amber-700 font-medium"
          >
            Ask
          </button>
          <button
            disabled={busy}
            onClick={() => decide('approved')}
            className="py-3 rounded-xl bg-emerald-600 text-white font-medium"
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  )
}
