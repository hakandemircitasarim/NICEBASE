# iOS Signing & Certificate Setup Guide

## Overview

This guide explains how to set up code signing for iOS app distribution. You'll need an Apple Developer account ($99/year) to publish to the App Store.

## Prerequisites

- Apple Developer Account (https://developer.apple.com/programs/)
- Xcode installed on macOS
- iOS project set up (already done)

## Step 1: Apple Developer Account Setup

1. Go to https://developer.apple.com/programs/
2. Enroll in the Apple Developer Program ($99/year)
3. Wait for approval (usually 24-48 hours)
4. Sign in to https://developer.apple.com/account/

## Step 2: Configure Bundle Identifier

1. Open `ios/App/App.xcodeproj` in Xcode
2. Select project in Navigator
3. Select app target "App"
4. Go to "Signing & Capabilities" tab
5. Ensure Bundle Identifier is: `com.nicebase.app`
6. If it's different, update it to match `capacitor.config.ts`

## Step 3: Automatic Signing (Recommended for Development)

1. In "Signing & Capabilities" tab
2. Check "Automatically manage signing"
3. Select your Team from dropdown
4. Xcode will automatically:
   - Create App ID
   - Create provisioning profiles
   - Manage certificates

## Step 4: Manual Signing (For Production)

### 4.1 Create App ID

1. Go to https://developer.apple.com/account/resources/identifiers/list
2. Click "+" to create new identifier
3. Select "App IDs" → Continue
4. Select "App" → Continue
5. Enter Description: `NICEBASE`
6. Enter Bundle ID: `com.nicebase.app` (must be exact)
7. Enable capabilities:
   - Push Notifications
   - Associated Domains (if using universal links)
8. Click "Continue" → "Register"

### 4.2 Create Distribution Certificate

#### Option A: Let Xcode Manage (Easier)

1. In Xcode, go to Preferences → Accounts
2. Select your Apple ID
3. Click "Manage Certificates"
4. Click "+" → "Apple Distribution"
5. Certificate is automatically created and downloaded

#### Option B: Manual Certificate Creation

1. Go to https://developer.apple.com/account/resources/certificates/list
2. Click "+" to create new certificate
3. Select "Apple Distribution" → Continue
4. Upload Certificate Signing Request (CSR):
   - On Mac: Keychain Access → Certificate Assistant → Request a Certificate
   - Enter email and name
   - Save to disk
   - Upload the .certSigningRequest file
5. Download certificate
6. Double-click to install in Keychain

### 4.3 Create Provisioning Profile

1. Go to https://developer.apple.com/account/resources/profiles/list
2. Click "+" to create new profile
3. Select "App Store" (for App Store distribution) → Continue
4. Select App ID: `com.nicebase.app` → Continue
5. Select Distribution Certificate → Continue
6. Enter Profile Name: `NICEBASE App Store` → Generate
7. Download provisioning profile
8. Double-click to install in Xcode

### 4.4 Configure Xcode Project

1. In Xcode, go to "Signing & Capabilities" tab
2. Uncheck "Automatically manage signing"
3. Select provisioning profile from dropdown
4. Select signing certificate

## Step 5: Configure for Different Build Configurations

### Development/Debug

- Use "Apple Development" certificate
- Use "Development" provisioning profile
- Can test on connected devices

### App Store Distribution

- Use "Apple Distribution" certificate
- Use "App Store" provisioning profile
- For App Store submission only

### Ad Hoc Distribution

- Use "Apple Distribution" certificate
- Use "Ad Hoc" provisioning profile
- For testing on specific registered devices

## Step 6: Archive and Export

### Create Archive

1. In Xcode, select "Any iOS Device" as destination
2. Product → Archive
3. Wait for archive to complete
4. Organizer window opens

### Export for App Store

1. In Organizer, click "Distribute App"
2. Select "App Store Connect" → Next
3. Select distribution options → Next
4. Select signing options:
   - "Automatically manage signing" (recommended)
   - Or select manual signing
5. Click "Upload" → Wait for upload to complete

## Step 7: App Store Connect Setup

1. Go to https://appstoreconnect.apple.com/
2. Create new app:
   - Platform: iOS
   - Name: NICEBASE
   - Primary Language: English (or Turkish)
   - Bundle ID: `com.nicebase.app`
   - SKU: `nicebase-ios-001` (unique identifier)
3. Fill in app information (see STORE_LISTING_TEMPLATE.md)
4. Upload builds from Xcode Organizer
5. Submit for review

## Troubleshooting

### "No signing certificate found"

- Make sure you're logged in with Apple Developer account in Xcode
- Check that certificate is installed in Keychain
- Try "Download Manual Profiles" in Xcode Preferences → Accounts

### "Provisioning profile doesn't match"

- Ensure Bundle ID matches exactly: `com.nicebase.app`
- Delete old provisioning profiles
- Let Xcode regenerate them

### "App ID not found"

- Create App ID in Apple Developer Portal first
- Ensure Bundle ID matches exactly

### "Code signing failed"

- Clean build folder: Product → Clean Build Folder (Shift+Cmd+K)
- Delete DerivedData folder
- Restart Xcode

## Important Notes

1. **Keep certificates secure**: Export and backup your distribution certificate and private key
2. **Certificate expiration**: Distribution certificates expire after 1 year, need to renew
3. **Bundle ID cannot change**: Once app is published, Bundle ID is permanent
4. **Team ID**: Make note of your Team ID (found in Apple Developer account)

## Resources

- [Apple Developer Documentation](https://developer.apple.com/documentation/)
- [Xcode Help](https://help.apple.com/xcode/)
- [App Store Connect Help](https://help.apple.com/app-store-connect/)










