#!/usr/bin/env bash
set -euo pipefail

case "${NAVIGATION_MODE:-}" in
  buttons)
    adb shell cmd overlay enable com.android.internal.systemui.navbar.threebutton || true
    adb shell cmd overlay disable com.android.internal.systemui.navbar.gestural || true
    adb shell settings put secure navigation_mode 0
    ;;
  gestures)
    adb shell cmd overlay enable com.android.internal.systemui.navbar.gestural || true
    adb shell cmd overlay disable com.android.internal.systemui.navbar.threebutton || true
    adb shell settings put secure navigation_mode 2
    ;;
  *)
    echo "Unsupported NAVIGATION_MODE: ${NAVIGATION_MODE:-unset}" >&2
    exit 2
    ;;
esac

printf 'Emulator navigation mode: '
adb shell settings get secure navigation_mode
adb shell cmd overlay list | grep -E 'navbar\.(threebutton|gestural)' || true
adb shell dumpsys webviewupdate | grep -E 'Current WebView package|WebView provider' || true

case "${TEST_SCOPE:-}" in
  insets)
    # The API 29 Google APIs image bundles a WebView without top-level-await support.
    # Keep this leg focused on native insets geometry; the full client/WebView flow
    # is exercised on API 36, whose bundled engine supports the app modules.
    gradle connectedDebugAndroidTest \
      -Pandroid.testInstrumentationRunnerArguments.class=com.studiolexair.carimarshow.OfflineFlowTest#systemBarInsetsKeepNativeContentInsideSafeArea \
      --no-daemon
    ;;
  full)
    gradle connectedDebugAndroidTest --no-daemon
    ;;
  *)
    echo "Unsupported TEST_SCOPE: ${TEST_SCOPE:-unset}" >&2
    exit 2
    ;;
esac
