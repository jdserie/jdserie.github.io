#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
root="$PWD"
tools="${ANDROID_SDK_ROOT:?Set ANDROID_SDK_ROOT}/build-tools/35.0.0"
platform="$ANDROID_SDK_ROOT/platforms/android-35/android.jar"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/classes" "$work/dex" "$work/assets/www" "$root/web/downloads"
for spec in web/*.html web/*.js web/*.css web/*.webmanifest web/assets; do cp -r "$spec" "$work/assets/www/"; done
if [[ -n "${FIGHT2_ECJ:-}" ]]; then
  java -jar "$FIGHT2_ECJ" -1.8 -proc:none -bootclasspath "$platform" -d "$work/classes" android/src/MainActivity.java
else
  javac -source 8 -target 8 -bootclasspath "$platform" -d "$work/classes" android/src/MainActivity.java
fi
mapfile -t classes < <(find "$work/classes" -name '*.class' -print)
"$tools/d8" --lib "$platform" --min-api 26 --output "$work/dex" "${classes[@]}"
"$tools/aapt2" compile --dir android/res -o "$work/resources.zip"
"$tools/aapt2" link -I "$platform" --manifest android/AndroidManifest.xml -A "$work/assets" -o "$work/unsigned.apk" "$work/resources.zip"
(cd "$work/dex" && zip -q -X "$work/unsigned.apk" classes.dex)
"$tools/zipalign" -f -p 4 "$work/unsigned.apk" "$work/aligned.apk"
"$tools/apksigner" sign --ks "${FIGHT2_KEYSTORE:?Set FIGHT2_KEYSTORE}" --ks-key-alias fight2 \
  --ks-pass env:FIGHT2_KEYSTORE_PASSWORD --out "$root/web/downloads/Who-Would-Win-2.0-Android.apk" "$work/aligned.apk"
"$tools/apksigner" verify --verbose "$root/web/downloads/Who-Would-Win-2.0-Android.apk"
"$tools/aapt2" dump badging "$root/web/downloads/Who-Would-Win-2.0-Android.apk" | sed -n '1,8p'
