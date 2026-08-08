APK READINESS REPORT — SkinScope AI (Android)

Date: 2026-06-11

Summary
- `capacitor.config.ts` present and configured with `webDir: 'dist'` and Camera plugin settings.
- `android-config/AndroidManifest.permissions.xml` includes recommended permissions for camera, storage, notifications, and network state.
- `android` build workflow `.github/workflows/android.yml` added to attempt readiness checks and `./gradlew assembleDebug`.

Prerequisites not handled in repo
- Android keystore for signing (release builds) must be created and stored securely (GitHub Secrets) and referenced in `gradle.properties` or `signingConfigs`.
- CI hosted runner may lack all Android SDK components; workflow attempts to install them but may need additional tuning or a self-hosted runner.

Blocking items (exact file references)
1) Keystore / signing config not present
   - Files to update: `android/gradle.properties` (or CI environment variables), `android/app/build.gradle` (signing config)
   - Required action: generate keystore, add as GitHub Secret, update CI to provide `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD` and decode into file during CI.

2) Capacitor sync and Android platform
   - File: `capacitor.config.ts` already configured; `npx cap sync android` will create Android project. CI runs `npx cap sync android || true` in `android.yml`.
   - Required action: run `npx cap add android` locally or in CI (with Node and Capacitor available) to ensure `android/` directory exists and Gradle can run.

3) APK / AAB build
   - Action: Once keystore is provided and `android/` exists, run `./gradlew assembleRelease` or `bundleRelease` on runner with Android SDK and JDK 17.

Recommendations
- Use GitHub Actions secrets for keystore and signing properties; add a step decoding the base64-keystore into file and update `gradle.properties` during CI.
- Consider using App Center / Play Console pipelines for release signing and upload.
- For debug CI run, assembleDebug is sufficient to verify Gradle configuration (already attempted in `android.yml`).

End of APK_READINESS_REPORT
