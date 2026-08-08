Selenium Readiness Report — SkinScope AI

Date: 2026-06-11

Current state
- Tests live under `tests/selenium` and are runnable with `pytest`.
- CI (`ci.yml`) runs `pytest` with `xvfb-run` and now starts a static server serving `dist/` on port 8080 before tests.

Blockers and requirements
1) Test environment data
   - Tests likely require seeded Supabase data (accounts, reports). Provide a Supabase test project and credentials, or mock responses.
   - Set `VITE_SUPABASE_*` secrets in GitHub Actions to point tests to test Supabase project.
2) Running server
   - CI now downloads `dist/` and runs `http-server` on port 8080.
   - If `dist/` missing due to build failure, tests will fail; ensure build passes first.
3) Browser driver
   - CI installs `chromium-browser` and `chromedriver`. If tests require a different browser, install corresponding driver.

Recommendations
- Add a CI step to seed test data into Supabase before running Selenium (use Supabase CLI or REST API with a service key stored in CI secrets).
- Consider running Selenium tests against a deployed preview URL instead of CI-served `dist/` for more realistic environment.
- Capture screenshots on failure and upload as artifacts for debugging.

Next steps
- Provide Supabase test secrets or mock endpoints.
- Run CI, inspect `selenium-results.xml` and any failure screenshots.

End of SELENIUM_READINESS_REPORT
