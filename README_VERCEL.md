Vercel deployment

Quick steps to deploy the SkinScope AI frontend to Vercel (static build using Vite)

1. Install Vercel CLI (optional, you can use the Vercel web UI)

```bash
npm i -g vercel
```

2. Build locally to verify

```bash
npm run build
# or
bun run build
```

3. Deploy with Vercel CLI

```bash
vercel login
vercel link            # link the local repo to a Vercel project
vercel --prod          # deploy to production
```

4. Required Vercel Environment Variables (set in Project Settings → Environment Variables):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

Optional / server-side secrets (DO NOT expose to client):

- `SUPABASE_SERVICE_ROLE_KEY` (only for serverless functions if used outside Supabase)
- `LOVABLE_API_KEY` (used by Supabase edge functions; keep on Supabase, not Vercel)

Notes:

- This repository uses Supabase for backend logic (edge functions and DB). Vercel will host the static frontend only.
- Do not commit real secrets. Use the `.env.example` as a template.
- If you want server-side proxies on Vercel, create serverless functions under the `api/` directory and secure them with environment variables.
