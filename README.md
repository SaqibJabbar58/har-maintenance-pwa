# H.A.R. Textiles — Admin & Maintenance PWA (v1.0)

## On your architecture question

Your stack choice is solid for this use case — I'd keep it as-is, with two adjustments:

1. **Audio transcription**: MediaRecorder gives you the audio file easily, but
   free-tier browser speech-to-text is unreliable (Web Speech API needs Chrome +
   online, and results are mediocre for Urdu/mixed-language voice notes). For
   v1.0, store the raw audio and let admins play it back — don't block on
   transcription. If you want transcript search later, the cheapest reliable
   path is calling Whisper via a serverless function (still free-tier-friendly
   on Vercel's function allowance).
2. **Push reliability**: OneSignal's free tier is fine, but lock-screen delivery
   on iOS PWAs is still limited by Apple's Web Push rules (iOS 16.4+, and the
   PWA must be added to the home screen — it won't work from Safari tabs). Tell
   your executive approvers this up front so expectations match reality on
   iPhone.

Everything else (React + Tailwind, Supabase, Vercel + GitHub CI/CD) is a good
free-tier fit and scales fine to hundreds of tickets/month.

## File structure

```
har-maintenance-pwa/
├── supabase/
│   └── schema.sql              # full DB schema (Step 1)
├── public/
│   ├── manifest.json           # PWA manifest
│   └── OneSignalSDKWorker.js
├── src/
│   ├── lib/
│   │   ├── supabaseClient.js
│   │   └── onesignal.js
│   ├── hooks/
│   │   └── useAudioRecorder.js
│   ├── components/
│   │   ├── ExecutiveDashboard.jsx
│   │   ├── TicketCreate.jsx
│   │   ├── ApprovalModal.jsx
│   │   └── ComplianceTracker.jsx
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── index.html
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── package.json
└── DEPLOYMENT.md               # Step 5
```

## Setup

```bash
npm install
cp .env.example .env      # fill in Supabase + OneSignal keys
npm run dev
```
