import { useEffect, useState } from 'react'
import { supabase, uploadToBucket, APPROVAL_THRESHOLD } from '../lib/supabaseClient'
import { useAudioRecorder } from '../hooks/useAudioRecorder'

// Ticket Creation with Photo + Voice Note (Step 3)
// Fast-input flow: category -> location -> photo -> voice note -> submit.
export default function TicketCreate({ userId, onCreated }) {
  const [categories, setCategories] = useState([])
  const [categoryId, setCategoryId] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [estimatedAmount, setEstimatedAmount] = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const { isRecording, seconds, audioBlob, start, stop, reset } = useAudioRecorder()

  useEffect(() => {
    supabase.from('ticket_categories').select('*').order('name').then(({ data }) => {
      setCategories(data || [])
    })
  }, [])

  function handlePhoto(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!categoryId || !location) {
      setError('Category and location are required.')
      return
    }
    setSubmitting(true)
    try {
      let photo_url = null
      let voice_note_url = null

      if (photoFile) photo_url = await uploadToBucket('maintenance-photos', photoFile, 'photos/')
      if (audioBlob) {
        const audioFile = new File([audioBlob], 'voice-note.webm', { type: audioBlob.type })
        voice_note_url = await uploadToBucket('maintenance-voice-notes', audioFile, 'voice/')
      }

      const amount = estimatedAmount ? Number(estimatedAmount) : null

      const { data: ticket, error: insertErr } = await supabase
        .from('tickets')
        .insert({
          category_id: categoryId,
          location,
          description,
          photo_url,
          voice_note_url,
          estimated_amount: amount,
          created_by: userId,
        })
        .select()
        .single()

      if (insertErr) throw insertErr

      // If it crosses the approval threshold, create the approval record too
      if (amount && amount > APPROVAL_THRESHOLD) {
        await supabase.from('approvals').insert({
          ticket_id: ticket.id,
          requested_amount: amount,
        })
        // Trigger push to approvers via a Supabase Edge Function call here, e.g.:
        // await supabase.functions.invoke('notify-approver', { body: { ticketId: ticket.id } })
      }

      setCategoryId(''); setLocation(''); setDescription(''); setEstimatedAmount('')
      setPhotoFile(null); setPhotoPreview(null); reset()
      onCreated?.(ticket)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 max-w-md mx-auto space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">New Maintenance Ticket</h1>

      {error && <div className="text-sm text-rose-600 bg-rose-50 rounded-lg p-2">{error}</div>}

      <div>
        <label className="text-sm font-medium text-slate-700">Category</label>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-200 p-3"
        >
          <option value="">Select category…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">Location / Department</label>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. Weaving Shed 2"
          className="mt-1 w-full rounded-lg border border-slate-200 p-3"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">Photo</label>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhoto}
          className="mt-1 w-full text-sm"
        />
        {photoPreview && (
          <img src={photoPreview} alt="preview" className="mt-2 w-full h-40 object-cover rounded-lg" />
        )}
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">Voice Note (optional)</label>
        <div className="mt-1 flex items-center gap-3">
          {!isRecording && !audioBlob && (
            <button type="button" onClick={start}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm">
              🎤 Record
            </button>
          )}
          {isRecording && (
            <button type="button" onClick={stop}
              className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm animate-pulse">
              ⏹ Stop ({seconds}s)
            </button>
          )}
          {audioBlob && !isRecording && (
            <>
              <audio controls src={URL.createObjectURL(audioBlob)} className="h-8" />
              <button type="button" onClick={reset} className="text-sm text-slate-500">Redo</button>
            </>
          )}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">Description (optional, if not using voice)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-lg border border-slate-200 p-3"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">
          Estimated Amount (PKR) — leave blank if unknown
        </label>
        <input
          type="number"
          value={estimatedAmount}
          onChange={(e) => setEstimatedAmount(e.target.value)}
          placeholder="0"
          className="mt-1 w-full rounded-lg border border-slate-200 p-3"
        />
        <p className="text-xs text-slate-400 mt-1">
          Above PKR {APPROVAL_THRESHOLD.toLocaleString()} triggers an instant approval request.
        </p>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 rounded-lg bg-brand-600 text-white font-medium disabled:opacity-50"
      >
        {submitting ? 'Submitting…' : 'Submit Ticket'}
      </button>
    </form>
  )
}
