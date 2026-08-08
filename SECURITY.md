Security & Secrets Guidance — SkinScope AI

1) Rotating exposed keys
- If you previously committed `.env` with Supabase or API keys, rotate them immediately in the provider console.
  - Supabase: rotate project anon and service-role keys and update Vercel/Supabase secrets.
  - AI providers: rotate `LOVABLE_API_KEY` or equivalent.

2) Where to store secrets
- Client-side public keys: use `VITE_SUPABASE_*` in Vercel environment variables (these are public and fine for client usage).
- Server-only keys: store `SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_API_KEY`, and other `sk_live_` keys in Supabase project settings (for edge functions) or GitHub Actions secrets for CI.

3) CI secret scanning
- CI includes a `secret-scan` job that searches the repository for common token patterns (`sk_live_`, `sk_test_`, `service_role`, `SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_API_KEY`) and uploads `secret-scan.txt` as an artifact for review.

4) Recommended immediate actions
- Rotate any keys found in history and current repo.
- Add repository secret scanning in GitHub (Advanced Security) or integrate `gitleaks` in CI.
- Ensure `.env` is in `.gitignore` (done).

5) Long-term recommendations
- Use a centralized secrets manager (Vault, GitHub Secrets, Vercel Environment Variables) and never commit secrets to the repository.
- Use short-lived tokens for CI where possible.

