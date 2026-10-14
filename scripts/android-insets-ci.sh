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
gradle connectedDebugAndroidTest --no-daemon
