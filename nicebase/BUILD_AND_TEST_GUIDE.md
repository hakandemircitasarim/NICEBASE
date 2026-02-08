# Build and Testing Guide

## Overview

This guide covers building production-ready apps and testing them before release.

## Prerequisites

- All dependencies installed (`npm install`)
- Environment variables configured (`.env` file)
- Android SDK installed (for Android builds)
- Xcode installed on macOS (for iOS builds)
- Apple Developer account (for iOS distribution builds)

## Web Build (PWA)

### Development Build

```bash
npm run dev
```

### Production Build

```bash
# Build for production
npm run build

# Preview production build locally
npm run preview
```

### Build Output

- Location: `dist/` folder
- Contains: Optimized HTML, CSS, JavaScript, and assets
- Deploy to: Any static hosting (Vercel, Netlify, GitHub Pages, etc.)

### Testing Production Build

1. Run `npm run preview`
2. Test all features:
   - [ ] Authentication (login/signup)
   - [ ] Memory CRUD operations
   - [ ] Image upload
   - [ ] Search and filtering
   - [ ] Export functionality
   - [ ] Dark mode
   - [ ] Language switching
   - [ ] Offline mode (disable network in DevTools)
   - [ ] PWA installation

3. Check browser console for errors
4. Test on different browsers:
   - Chrome/Edge
   - Safari
   - Firefox
   - Mobile browsers

---

## Android Build

### Development Build (APK)

```bash
# Build web assets first
npm run build

# Sync Capacitor
npm run cap:sync

# Open Android Studio
npm run cap:open:android

# In Android Studio:
# Build → Build Bundle(s) / APK(s) → Build APK(s)
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`

### Release Build (AAB for Play Store)

#### Step 1: Generate Signing Keystore

```bash
keytool -genkey -v -keystore release.keystore -alias nicebase -keyalg RSA -keysize 2048 -validity 10000
```

**Important:**
- Remember the passwords (store password and key password)
- Save keystore file securely (BACKUP IT!)
- If lost, you cannot update the app on Play Store

#### Step 2: Configure Signing

1. Edit `android/app/build.gradle`
2. Uncomment and configure the `signingConfigs` section:
   ```gradle
   signingConfigs {
       release {
           storeFile file('release.keystore')
           storePassword 'your-store-password'
           keyAlias 'nicebase'
           keyPassword 'your-key-password'
       }
   }
   ```
3. Uncomment `signingConfig signingConfigs.release` in release buildType

#### Step 3: Build Release AAB

```bash
# Build web assets
npm run build

# Sync Capacitor
npm run cap:sync

# Build release bundle
cd android
./gradlew bundleRelease
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

#### Step 4: Test Release Build

1. Install AAB on device:
   ```bash
   # Convert AAB to APK for testing (optional)
   bundletool build-apks --bundle=app-release.aab --output=app.apks
   bundletool install-apks --apks=app.apks
   ```

2. Or use Android Studio:
   - Build → Generate Signed Bundle / APK
   - Select "Android App Bundle"
   - Choose keystore
   - Build → Analyze APK to verify signing

### Testing Checklist

- [ ] App installs successfully
- [ ] App launches without crashes
- [ ] All features work correctly
- [ ] Images load properly
- [ ] Notifications work (if Firebase configured)
- [ ] Offline mode works
- [ ] Back button behavior is correct
- [ ] Screen rotations handled (if enabled)
- [ ] Test on different Android versions (minSdk: 24 = Android 7.0+)
- [ ] Test on different screen sizes

---

## iOS Build

### Development Build (Simulator)

```bash
# Build web assets
npm run build

# Sync Capacitor
npm run cap:sync

# Open Xcode
npm run cap:open:ios

# In Xcode:
# Select simulator → Click Run (▶️)
```

### Development Build (Physical Device)

1. Connect iOS device to Mac
2. In Xcode:
   - Select your device as destination
   - Select development team
   - Xcode will handle code signing automatically
   - Click Run (▶️)

### Release Build (App Store)

#### Step 1: Configure Signing

See `iOS_SIGNING_GUIDE.md` for detailed instructions.

#### Step 2: Build Archive

1. In Xcode:
   - Select "Any iOS Device" as destination
   - Product → Archive
   - Wait for archive to complete

#### Step 3: Validate and Upload

1. In Organizer window:
   - Select your archive
   - Click "Validate App"
   - Fix any issues
   - Click "Distribute App"
   - Select "App Store Connect"
   - Follow wizard to upload

#### Step 4: Test on TestFlight

1. Go to https://appstoreconnect.apple.com/
2. Select your app → TestFlight
3. Add internal testers (up to 100)
4. Or add external testers (up to 10,000)
5. Testers receive email invite
6. Install TestFlight app on device
7. Install your app from TestFlight

### Testing Checklist

- [ ] App installs successfully
- [ ] App launches without crashes
- [ ] All features work correctly
- [ ] Images load properly
- [ ] Notifications work (if Firebase configured)
- [ ] Camera permission works
- [ ] Photo library permission works
- [ ] Offline mode works
- [ ] Test on different iOS versions
- [ ] Test on iPhone and iPad (if supported)
- [ ] Test in portrait and landscape (if supported)

---

## Beta Testing

### Google Play Console - Internal Testing

1. Go to https://play.google.com/console/
2. Select your app
3. Release → Testing → Internal testing
4. Create new release
5. Upload AAB file
6. Add testers (create tester group with email addresses)
7. Share testing link with testers

### Google Play Console - Closed/Open Beta

Similar to Internal Testing but:
- **Closed Beta**: Up to 100 testers via email invites
- **Open Beta**: Anyone can join via opt-in link

### TestFlight (iOS)

1. Upload build to App Store Connect (via Xcode)
2. Go to App Store Connect → TestFlight
3. Add internal testers (immediate access)
4. Add external testers (after App Review, up to 10,000)
5. Testers install TestFlight app
6. Accept invitation and install app

### Testing Feedback

Collect feedback from testers on:
- Usability issues
- Bugs and crashes
- Performance problems
- Feature requests
- UI/UX improvements

---

## Performance Testing

### Web Build

1. Use Lighthouse in Chrome DevTools:
   ```bash
   npm run preview
   # Open Chrome DevTools → Lighthouse → Run audit
   ```
2. Target scores:
   - Performance: > 90
   - Accessibility: > 90
   - Best Practices: > 90
   - SEO: > 90

### Mobile Apps

1. Use platform-specific tools:
   - **Android**: Android Studio Profiler
   - **iOS**: Xcode Instruments
2. Monitor:
   - Memory usage
   - CPU usage
   - Network requests
   - Battery consumption
   - App startup time

---

## Common Issues

### Build Fails

- Clean build: `npm run clean` and rebuild
- Clear cache: Delete `node_modules` and reinstall
- Check for TypeScript errors: `npm run build` shows errors

### Android: "SDK location not found"

- Set `ANDROID_HOME` environment variable
- Or create `local.properties` in `android/` folder:
  ```
  sdk.dir=/path/to/android/sdk
  ```

### iOS: "Code signing failed"

- Check signing configuration in Xcode
- Ensure certificates are valid
- See `iOS_SIGNING_GUIDE.md`

### Capacitor Sync Issues

```bash
# Force sync
npm run cap:sync

# Or manually copy
npm run cap:copy
```

---

## Pre-Release Checklist

### Code

- [ ] All features implemented and tested
- [ ] No console errors in production build
- [ ] Error handling in place
- [ ] Loading states implemented
- [ ] Offline mode tested

### Configuration

- [ ] Environment variables set for production
- [ ] API keys configured
- [ ] Firebase/APNs configured (if using push notifications)
- [ ] Version numbers updated

### Assets

- [ ] App icons added (all platforms)
- [ ] Splash screens updated
- [ ] Privacy policy URL configured
- [ ] Store listing metadata prepared

### Testing

- [ ] Tested on multiple devices
- [ ] Tested on different OS versions
- [ ] Beta testing completed
- [ ] Performance acceptable
- [ ] No critical bugs

### Legal

- [ ] Privacy policy published
- [ ] Terms of service (if applicable)
- [ ] Store listing information complete

---

## Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Android Build Guide](https://developer.android.com/studio/build)
- [iOS Build Guide](https://developer.apple.com/documentation/xcode)
- [Play Console Help](https://support.google.com/googleplay/android-developer)
- [App Store Connect Help](https://help.apple.com/app-store-connect/)










