#!/usr/bin/env bash
# Temporary smoke test: launch the debug APK, screenshot the login screen,
# open the keyboard, submit wrong credentials twice, and dump crashes.
set -u
API="$1"
OUT=smoke
mkdir -p "$OUT"
APK=nicebase/android/app/build/outputs/apk/debug/app-debug.apk

shot() {
  adb exec-out screencap -p > "$OUT/$1.png"
  convert "$OUT/$1.png" -resize 300x -quality 55 "$OUT/$1.jpg"
  echo "=====SHOT api$API $1 BEGIN====="
  base64 -w 3000 "$OUT/$1.jpg"
  echo "=====SHOT api$API $1 END====="
}

# Center of the first node whose attributes match $1 (python regex).
find_center() {
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
  adb exec-out cat /sdcard/ui.xml > "$OUT/ui.xml"
  python3 - "$1" "$OUT/ui.xml" <<'PY'
import re, sys
pat, path = sys.argv[1], sys.argv[2]
xml = open(path, encoding='utf-8', errors='ignore').read()
for node in re.findall(r'<node [^>]*>', xml):
    if re.search(pat, node):
        m = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', node)
        if m:
            x1, y1, x2, y2 = map(int, m.groups())
            print((x1 + x2) // 2, (y1 + y2) // 2)
            break
PY
}

adb install -r "$APK"
adb shell pm grant com.nicebase.app android.permission.POST_NOTIFICATIONS || true
adb logcat -c
adb shell am start -W -n com.nicebase.app/.MainActivity
sleep 25
shot 1-launch
echo "--- insets"
adb shell dumpsys window windows | grep -iE "mCurrentFocus|navigationBars|statusBars" | head -10

EMAIL=$(find_center 'class="android.widget.EditText"')
echo "email field at: $EMAIL"
if [ -n "$EMAIL" ]; then
  adb shell input tap $EMAIL
  sleep 2
  adb shell input text 'smoke-test@example.com'
  sleep 3
  shot 2-keyboard
  PASS=$(find_center 'password="true"')
  echo "password field at: $PASS"
  [ -n "$PASS" ] && adb shell input tap $PASS && sleep 1 && adb shell input text 'wrongpass123'
  adb shell input keyevent 111   # ESC closes the keyboard
  sleep 2
  BTN=$(find_center 'text="(Giriş Yap|Log In|Sign In|Login)"')
  echo "login button at: $BTN"
  if [ -n "$BTN" ]; then
    adb shell input tap $BTN
    sleep 1
    adb shell input tap $BTN
    sleep 6
    shot 3-after-double-submit
  fi
fi

echo "--- crashes"
adb logcat -d | grep -E "FATAL EXCEPTION|AndroidRuntime: |ANR in" | head -40 || true
echo "--- webview console errors"
adb logcat -d | grep -E "Capacitor/Console.*(Error|error)|chromium.*Uncaught" | head -40 || true
adb logcat -d > "$OUT/logcat.txt"
exit 0
