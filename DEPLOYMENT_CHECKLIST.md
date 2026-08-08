Vercel Deployment Checklist for SkinScope AI

1) Local build verification
- Install dependencies:

```bash
npm install
# or
bun install
```

- Build:

```bash
npm run build
# or
bun run build
```

- Expected output: `dist/` folder with `index.html` and static assets.

2) Vercel project settings
- Build command: `npm run build`
- Output directory: `dist`
- Framework preset: None (static build) or leave default
- Add `vercel.json` (already present) — uses `@vercel/static-build` and SPA fallback.

3) Required Vercel Environment Variables (set in Project → Settings → Environment Variables)
- `VITE_SUPABASE_URL` (public)
- `VITE_SUPABASE_PUBLISHABLE_KEY` (public)
- `VITE_SUPABASE_PROJECT_ID` (public)

4) Server-only secrets (DO NOT set as VITE_* or expose to client)
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)
- `LOVABLE_API_KEY` (should remain on Supabase edge functions; do not place in frontend env)
- Any `sk_live_` or other private API keys

5) Sanity checks before deploy
- Ensure `.env` is in `.gitignore` and not committed.
- Verify no hard-coded secrets in repository (search for `sk_live_`, `service_role`, `LOVABLE_API_KEY`).
- Confirm `src/integrations/supabase/client.server.ts` is only used server-side.

6) Routing & SPA behavior
- `vercel.json` contains SPA fallback: filesystem handler then all routes to `index.html`.
- TanStack client-side router will handle internal routes after fallback.

7) Post-deploy verification
- Visit the deployed URL; open browser console for missing env errors (client app will throw if `VITE_SUPABASE_*` missing).
- Test key pages: `/dashboard`, `/dashboard/analyze`, `/dashboard/jarvis`, `/dashboard/medical-reports`, `/dashboard/prescriptions`.
- Confirm PWA manifest is served at `/manifest.webmanifest` and icons load.

8) Notes & recommendations
- Supabase edge functions are the backend — keep them deployed on Supabase (they require `LOVABLE_API_KEY` in Supabase project secrets).
- If you need serverless APIs on Vercel, implement them under `api/` and secure them with non-VITE env vars.
- Use Vercel Environment Variable scopes (`Production`, `Preview`, `Development`) accordingly.


If you want, run the `npm install` and `npm run build` commands locally and paste the logs here — I'll analyze failures and provide exact fixes for build errors.
