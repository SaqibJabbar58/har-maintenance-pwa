// OneSignal Web Push initialization (Step 4)
// Loaded once from main.jsx. Free tier — browser + phone lock-screen alerts.

export function initOneSignal() {
  window.OneSignalDeferred = window.OneSignalDeferred || []
  window.OneSignalDeferred.push(async function (OneSignal) {
    await OneSignal.init({
      appId: import.meta.env.VITE_ONESIGNAL_APP_ID,
      allowLocalhostAsSecureOrigin: true,
      notifyButton: { enable: false },
    })
    // Prompt at a sensible moment (e.g. right after login), not on cold load
  })
}

// Call after a user logs in, to link their browser subscription to their
// Supabase user id so the backend can target pushes at specific approvers.
export async function registerPushForUser(supabaseUserId, supabase) {
  window.OneSignalDeferred.push(async function (OneSignal) {
    const granted = await OneSignal.Notifications.requestPermission()
    if (!granted) return
    const playerId = OneSignal.User.PushSubscription.id
    if (playerId) {
      await supabase.from('users')
        .update({ onesignal_player_id: playerId })
        .eq('id', supabaseUserId)
    }
  })
}

// Send a push — call this from a Supabase Edge Function / server context,
// NEVER from the browser (it requires your OneSignal REST API key).
// Kept here as reference for the edge function implementation.
export const ONESIGNAL_SEND_REFERENCE = `
// supabase/functions/notify-approver/index.ts
const res = await fetch('https://onesignal.com/api/v1/notifications', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Basic ' + Deno.env.get('ONESIGNAL_REST_API_KEY'),
  },
  body: JSON.stringify({
    app_id: Deno.env.get('ONESIGNAL_APP_ID'),
    include_player_ids: [approverPlayerId],
    headings: { en: 'Approval needed' },
    contents: { en: \`\${ticketNo}: PKR \${amount} — \${category}\` },
    url: \`https://admin.hartextiles.com/approvals/\${ticketId}\`,
  }),
})
`
