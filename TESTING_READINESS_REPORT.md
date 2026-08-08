TESTING READINESS REPORT — SkinScope AI

Date: 2026-06-11

Selenium
- Tests present under `tests/selenium` and `tests/selenium/scripts`.
- CI runs pytest under xvfb; artifacts uploaded as `selenium-results.xml`.
- Blockers:
  - Selenium tests expect a running app at `http://localhost:8080` (see `tests/README.md`). CI currently does not start a static server to serve `dist/` before tests; tests may fail unless pointed to a deployed preview or a server is started.
  - Tests need `VITE_SUPABASE_*` env vars set and likely a Supabase test project with seeded data.
- Recommendations:
  - Add a CI step to serve `dist/` with a simple static server (e.g., `npx http-server dist -p 8080 &`) before running Selenium.
  - Provide test Supabase project credentials as secrets in CI or mock Supabase responses.

Appium
- Tests present under `tests/appium`.
- Blockers:
  - Appium requires Android emulator or cloud device farm (not available in current CI).
- Recommendations:
  - Configure cloud provider (BrowserStack/DeviceFarm) and update tests to use remote device endpoints.
  - Alternatively run Appium tests locally with an Android emulator and provide results.

Unit / Integration Tests
- No Node/Jest test suites detected in `package.json`.
- Recommend adding unit/integration test suites for critical components (auth, supabase client, jarvis chat handler).

Test Artefacting
- CI uploads `selenium-results.xml` and build artifacts for inspection.

Next steps
1) Update CI to start a static server after build and before running Selenium.
2) Provide test Supabase credentials or mock endpoints.
3) For Appium, configure cloud device farm and CI integration.

End of TESTING_READINESS_REPORT
