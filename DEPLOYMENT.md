# Deployment — GitHub → Vercel (zero-cost)

## 1. Supabase project
1. Create a project at supabase.com (Free tier).
2. Open **SQL Editor** → paste `supabase/schema.sql` → Run.
3. **Storage** → create two public buckets: `maintenance-photos`,
   `maintenance-voice-notes` (add `vendor-quotations` too if you want
   quotation images in a separate bucket instead of reusing photos).
4. **Project Settings → API** → copy the `Project URL` and `anon public` key.
5. **Authentication** → enable Email (or phone OTP) sign-in, then manually
   insert your first Super Admin row into `public.users` after they sign up
   once, e.g.:
   ```sql
   update public.users set role_id = 1 where id = '<their auth.users id>';
   ```

## 2. OneSignal
1. Create a free app at onesignal.com → platform: **Web Push**.
2. Set the site URL to `https://admin.hartextiles.com`.
3. Copy the **OneSignal App ID** into `.env` as `VITE_ONESIGNAL_APP_ID`.
4. Copy the **REST API Key** — you'll only use this server-side, inside a
   Supabase Edge Function (see `src/lib/onesignal.js` for the reference
   snippet), never in the frontend `.env`.

## 3. Push code to GitHub
```bash
cd har-maintenance-pwa
git init
git add .
git commit -m "Initial commit — v1.0 MVP"
git branch -M main
git remote add origin https://github.com/<your-org>/har-maintenance-pwa.git
git push -u origin main
```
Add a `.gitignore` with `node_modules`, `dist`, `.env` before the first commit
so secrets never land in the repo.

## 4. Connect Vercel
1. vercel.com → **New Project** → import the GitHub repo.
2. Framework preset: **Vite** (auto-detected).
3. Add environment variables in Vercel project settings:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_ONESIGNAL_APP_ID`
4. Deploy. Every push to `main` now auto-deploys (zero-downtime, CI/CD built in).

## 5. Custom domain
1. Vercel project → **Domains** → add `admin.hartextiles.com`.
2. In your DNS provider, add the CNAME Vercel gives you.
3. Vercel issues the SSL cert automatically.

## 6. Add to Home Screen
On the phone, open `admin.hartextiles.com` in Chrome (Android) or Safari
(iOS 16.4+) → **Add to Home Screen**. This is required for push notifications
to reach the lock screen on iOS.

## 7. Scheduled compliance alerts (60/30/15 days)
Free-tier-friendly option: a Supabase Edge Function on a **Cron Trigger**
(Supabase supports pg_cron on the free tier) that runs daily, queries
`compliance_docs` for docs crossing the 60/30/15-day marks, checks
`compliance_alerts_sent` to avoid duplicates, and calls the OneSignal REST
API. This keeps the send logic server-side and off the free Vercel function
quota.
