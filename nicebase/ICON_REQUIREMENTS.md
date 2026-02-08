# App Icon Requirements

## Overview

This document outlines the icon requirements for NICEBASE across all platforms. Currently, placeholder icons are being used. Professional icons need to be designed and implemented.

## PWA Icons

**Location**: `/public/` folder

### Required Icons

1. **pwa-192x192.png**
   - Size: 192x192 pixels
   - Format: PNG
   - Purpose: Standard PWA icon
   - Usage: Referenced in `manifest.json`

2. **pwa-512x512.png**
   - Size: 512x512 pixels
   - Format: PNG
   - Purpose: Maskable icon (can be cropped to different shapes)
   - Usage: Referenced in `manifest.json`

3. **Apple Touch Icon**
   - Size: 180x180 pixels
   - Format: PNG
   - Location: `/public/apple-touch-icon.png`
   - Usage: Referenced in `index.html` as `<link rel="apple-touch-icon">`

4. **Favicon**
   - Size: 32x32 pixels (or SVG)
   - Format: PNG or SVG
   - Location: `/public/favicon.ico` or `/public/favicon.svg`
   - Usage: Browser tab icon

### Implementation

After creating the icons:

1. Place all icons in the `/public/` folder
2. Update `public/manifest.json` to reference the correct icon paths
3. Update `index.html` to reference the apple-touch-icon and favicon

## Android Icons

**Location**: `android/app/src/main/res/mipmap-*/`

### Required Sizes

Android requires icons in multiple densities:

- **mipmap-mdpi**: 48x48 pixels
- **mipmap-hdpi**: 72x72 pixels
- **mipmap-xhdpi**: 96x96 pixels
- **mipmap-xxhdpi**: 144x144 pixels
- **mipmap-xxxhdpi**: 192x192 pixels

### Icon Files Needed

For each density folder, you need:
- `ic_launcher.png` - Square icon
- `ic_launcher_round.png` - Round icon (for devices with round icons)
- `ic_launcher_foreground.png` - Foreground layer (for adaptive icons)

### Adaptive Icon Configuration

Android also uses adaptive icons defined in:
- `mipmap-anydpi-v26/ic_launcher.xml`
- `mipmap-anydpi-v26/ic_launcher_round.xml`

These reference:
- `drawable/ic_launcher_background.xml` - Background
- `drawable-v24/ic_launcher_foreground.xml` - Foreground

### Tools

Use Android Studio's Image Asset Studio or online tools like:
- https://romannurik.github.io/AndroidAssetStudio/
- https://www.appicon.co/

### Implementation Steps

1. Generate icon in all required sizes using Android Asset Studio or similar tool
2. Replace files in each `mipmap-*` folder
3. Update adaptive icon XML files if needed
4. Test on different Android devices

## iOS Icons

**Location**: `ios/App/App/Assets.xcassets/AppIcon.appiconset/`

### Required Sizes

iOS requires icons in various sizes for different devices:

- **1024x1024** - App Store (required)
- **20x20** (2x: 40x40, 3x: 60x60) - Notification
- **29x29** (2x: 58x58, 3x: 87x87) - Settings
- **40x40** (2x: 80x80, 3x: 120x120) - Spotlight
- **60x60** (2x: 120x120, 3x: 180x180) - App

### Asset Catalog

iOS uses an Asset Catalog (`.appiconset`) defined in `Contents.json`.

### Tools

- Use Xcode's Asset Catalog editor
- Or use online tools like:
  - https://www.appicon.co/
  - https://icon.kitchen/

### Implementation Steps

1. Open `ios/App/App.xcodeproj` in Xcode
2. Navigate to Assets.xcassets → AppIcon
3. Drag and drop icons into appropriate slots
4. Or use Xcode's built-in icon generator

## Design Guidelines

### General Guidelines

1. **Simple and recognizable**: Icon should be recognizable even at small sizes
2. **No text**: Avoid text in icons (except brand logos)
3. **Consistent branding**: Use consistent colors and style across all platforms
4. **Safe area**: Keep important elements within safe area (10% margin from edges)
5. **Square base**: Design as square, platforms will apply mask

### Platform-Specific

#### Android
- **Safe area**: 66% of icon (centered)
- **Adaptive icons**: Design foreground and background layers separately
- **No transparency**: For adaptive icons, use opaque backgrounds

#### iOS
- **No transparency**: Icons must have opaque backgrounds
- **No rounded corners**: iOS will apply corner radius automatically
- **No alpha channel**: Remove alpha channel for App Store icon

#### PWA
- **Maskable**: 512x512 icon should have safe area (80% of canvas)
- **Padding**: Keep important content within center 80%

## Color Scheme

Based on current app theme:
- Primary: #FF6B35 (Orange)
- Background: #FFFFFF (White)
- Dark mode: Consider dark mode variants

## Current Status

- ✅ Icon placeholders exist
- ❌ Professional icons needed
- ❌ Icons need to be generated in all required sizes
- ❌ Icons need to be implemented in project

## Next Steps

1. Design professional icon (1024x1024 base)
2. Generate all required sizes for each platform
3. Replace placeholder icons
4. Test on all platforms
5. Update manifest and configuration files

## Resources

- [Android Icon Design Guidelines](https://developer.android.com/guide/practices/ui_guidelines/icon_design)
- [iOS Human Interface Guidelines - Icons](https://developer.apple.com/design/human-interface-guidelines/app-icons)
- [PWA Icon Guidelines](https://web.dev/add-manifest/#icons)










