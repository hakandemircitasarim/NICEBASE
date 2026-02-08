# Firebase Setup Guide for Push Notifications

## Overview

This guide explains how to set up Firebase Cloud Messaging (FCM) for push notifications on both Android and iOS platforms.

## Prerequisites

- Firebase account (https://firebase.google.com/)
- Google account
- Android app package name: `com.nicebase.app`
- iOS Bundle ID: `com.nicebase.app`

## Android Setup

### Step 1: Create Firebase Project

1. Go to https://console.firebase.google.com/
2. Click "Add project" or select existing project
3. Enter project name: `NICEBASE` (or your preferred name)
4. Enable Google Analytics (optional but recommended)
5. Click "Create project"

### Step 2: Add Android App to Firebase

1. In Firebase Console, click "Add app" → Android icon
2. Enter Android package name: `com.nicebase.app`
3. Enter App nickname: `NICEBASE Android` (optional)
4. Enter Debug signing certificate SHA-1 (optional, for development)
   - Get it using: `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android`
5. Click "Register app"

### Step 3: Download google-services.json

1. Download `google-services.json` file
2. Place it in: `android/app/google-services.json`
3. **Important:** Do NOT commit this file to git if it contains sensitive data
4. The build.gradle already has the plugin configured to use this file

### Step 4: Verify Setup

The `android/app/build.gradle` file already includes:

```gradle
try {
    def servicesJSON = file('google-services.json')
    if (servicesJSON.text) {
        apply plugin: 'com.google.gms.google-services'
    }
} catch(Exception e) {
    logger.info("google-services.json not found, google-services plugin not applied. Push Notifications won't work")
}
```

This will automatically apply the plugin when the file is present.

### Step 5: Test Push Notifications

1. Build and run the app
2. Grant notification permissions when prompted
3. Test notifications using Firebase Console → Cloud Messaging → Send test message

---

## iOS Setup

### Step 1: Add iOS App to Firebase

1. In Firebase Console (same project), click "Add app" → iOS icon
2. Enter iOS Bundle ID: `com.nicebase.app`
3. Enter App nickname: `NICEBASE iOS` (optional)
4. Enter App Store ID (optional, can add later)
5. Click "Register app"

### Step 2: Download GoogleService-Info.plist

1. Download `GoogleService-Info.plist` file
2. **Do NOT manually edit this file**
3. In Xcode, drag and drop the file into `ios/App/App/` folder
4. Make sure "Copy items if needed" is checked
5. Select your app target when prompted

### Step 3: Configure APNs (Apple Push Notification Service)

#### Option A: Automatic (Recommended for development)

1. In Xcode, go to project settings → Signing & Capabilities
2. Add "Push Notifications" capability
3. Xcode will automatically create APNs key if you're signed in with Apple Developer account

#### Option B: Manual APNs Certificate

1. Go to Apple Developer Portal (https://developer.apple.com/account/)
2. Navigate to Certificates, Identifiers & Profiles
3. Create APNs certificate:
   - Certificates → + → Apple Push Notification service SSL (Sandbox & Production)
   - Select App ID: `com.nicebase.app`
   - Follow instructions to create certificate
   - Download certificate
4. Upload to Firebase:
   - Firebase Console → Project Settings → Cloud Messaging → iOS app configuration
   - Upload APNs certificate or APNs Auth Key

#### Option C: APNs Auth Key (Recommended for production)

1. Go to Apple Developer Portal
2. Keys → + → Create new key
3. Enable "Apple Push Notifications service (APNs)"
4. Download the .p8 key file (save it securely!)
5. Note the Key ID
6. Upload to Firebase:
   - Firebase Console → Project Settings → Cloud Messaging → iOS app configuration
   - Upload APNs Auth Key (.p8 file)
   - Enter Key ID and Team ID

### Step 4: Enable Push Notifications Capability

1. Open `ios/App/App.xcodeproj` in Xcode
2. Select project in Navigator
3. Select app target
4. Go to "Signing & Capabilities" tab
5. Click "+ Capability"
6. Add "Push Notifications"
7. Add "Background Modes" and enable "Remote notifications"

### Step 5: Update Info.plist

The `Info.plist` file already includes:

```xml
<key>NSUserNotificationsUsageDescription</key>
<string>NICEBASE sends notifications to remind you about your memories and daily reflections.</string>
```

### Step 6: Configure AppDelegate (if needed)

Capacitor Push Notifications plugin should handle most of this automatically, but verify that:

1. AppDelegate imports Capacitor
2. Push notification registration is handled (Capacitor does this automatically)

### Step 7: Test Push Notifications

1. Build and run on a physical iOS device (simulator doesn't support push notifications)
2. Grant notification permissions when prompted
3. Test notifications using Firebase Console → Cloud Messaging → Send test message

---

## Verification

### Android

1. Check build logs for:
   ```
   google-services.json not found, google-services plugin not applied
   ```
   This should NOT appear if setup is correct.

2. In app, check if push notification token is received (check console logs)

### iOS

1. Check Xcode build logs for any Firebase/APNs errors
2. Verify `GoogleService-Info.plist` is included in app bundle
3. In app, check if push notification token is received

---

## Troubleshooting

### Android: "google-services.json not found"

- Verify file is in `android/app/google-services.json`
- Check file name spelling (case-sensitive)
- Clean and rebuild: `./gradlew clean`

### iOS: Push notifications not working

- Verify APNs certificate/key is uploaded to Firebase
- Check device is connected to internet
- Verify app has notification permissions
- Check Xcode console for APNs registration errors
- Ensure testing on physical device (simulator doesn't support push)

### Firebase: "Invalid API key"

- Regenerate API key in Firebase Console
- Update `google-services.json` or `GoogleService-Info.plist`
- Clean and rebuild project

---

## Security Notes

1. **Do NOT commit sensitive files:**
   - `google-services.json` (contains API keys)
   - `GoogleService-Info.plist` (contains API keys)
   - APNs certificates/keys

2. **Use environment-specific configs:**
   - Development: Use development APNs certificate
   - Production: Use production APNs certificate/key

3. **Rotate keys regularly:**
   - Update Firebase API keys periodically
   - Regenerate APNs keys if compromised

---

## Resources

- [Firebase Cloud Messaging Documentation](https://firebase.google.com/docs/cloud-messaging)
- [Capacitor Push Notifications Plugin](https://capacitorjs.com/docs/apis/push-notifications)
- [Apple Push Notification Service](https://developer.apple.com/documentation/usernotifications)










