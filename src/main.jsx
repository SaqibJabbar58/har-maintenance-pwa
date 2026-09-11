import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { supabase } from './lib/supabaseClient'
import { initOneSignal, registerPushForUser } from './lib/onesignal'

initOneSignal()

async function bootstrap() {
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    // TODO: render a login screen (Supabase Auth UI or a custom form).
    // For now this assumes auth is handled and a session exists.
    document.getElementById('root').innerHTML =
      '<div style="padding:2rem;text-align:center;color:#64748b">Please sign in.</div>'
    return
  }

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', session.user.id)
    .single()

  registerPushForUser(session.user.id, supabase)

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App currentUser={profile} />
    </React.StrictMode>
  )
}

bootstrap()
