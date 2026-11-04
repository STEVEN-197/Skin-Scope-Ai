# SkinScope AI — Changelog

## v2.0 (2026-11-04)
- Migrated mobile application from Capacitor to a genuine native **React Native 0.88 + Expo SDK 55 + TypeScript + Expo Router** application in `mobile/`
- Recreated all 20 screens with native React Native components (`StyleSheet`), SVG health rings/charts (`react-native-svg`), native camera/gallery capture (`expo-image-picker`), on-device JPEG RGB/HSV color analysis (`jpeg-js`), native Doctor PDF generation/sharing (`expo-print`, `expo-sharing`), and progressive Jarvis SSE streaming
- Generated native Android project via `npx expo prebuild --platform android` and built release APK (`mobile/android/app/build/outputs/apk/release/app-release.apk`)
- Removed all legacy Capacitor dependencies, configurations, and old APK directories
- Updated GitHub Actions CI/CD, Appium mobile suite, and DevSecOps security scanner

## v1.1 (2026-11-02)
- All 15 security vulnerabilities remediated (Score: 100/100)
- Node.js 24 across all CI/CD jobs
- Improved rate limiting, CORS, and auth enforcement
