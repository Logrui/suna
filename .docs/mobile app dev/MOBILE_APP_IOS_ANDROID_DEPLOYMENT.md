# 📱 Kortix Mobile App - iOS & Android Deployment Guide

**Complete walkthrough for deploying to App Store and Google Play Store**

---

## 🎯 Overview: How It All Works

### Cross-Platform Architecture

```
┌─────────────────────────────────────────────────────┐
│   Single React Native Codebase (TypeScript)         │
│   apps/mobile/                                      │
└─────────────────┬───────────────────────────────────┘
                  │
      ┌───────────┴───────────┐
      │                       │
┌─────▼──────────┐   ┌───────▼──────────┐
│  iOS Bundle    │   │  Android Bundle  │
├────────────────┤   ├──────────────────┤
│ .ipa file      │   │ .aab file        │
│ compiled for   │   │ compiled for     │
│ ARM64          │   │ ARMv8/x86_64     │
└─────┬──────────┘   └────────┬─────────┘
      │                       │
      ▼                       ▼
  App Store              Google Play Store
  (Apple)                (Google)
```

### The Build Pipeline

```
Your Code (React Native + TypeScript)
         ↓
   EAS Build (Expo's cloud build service)
         ├─ Compiles to native code
         ├─ Runs on their infrastructure
         ├─ Takes 10-20 minutes
         └─ Produces signed binaries
         ↓
   Two Outputs:
   ├─ .ipa file (iOS - for App Store)
   └─ .aab file (Android - for Google Play)
         ↓
   EAS Submit (Auto-submit to stores)
   or Manual Upload
         ↓
   ✅ Apps Available on Stores
```

---

## 🍎 iOS Deployment

### How iOS Works with React Native

```
React Native Code
    ↓
Expo Build System
    ├─ Compiles JavaScript to native iOS
    ├─ Links native modules (audio, camera, etc.)
    ├─ Creates Xcode project
    └─ Compiles to ARM64 binary
    ↓
Codesigns with Apple certificate
    ├─ iOS requires all apps to be signed
    ├─ Uses your Apple Developer certificate
    └─ Includes provisioning profile
    ↓
Produces .ipa file
    ├─ iOS app archive
    ├─ Ready for App Store
    └─ Contains all code + resources
    ↓
Uploaded to App Store Connect
    ├─ Apple's management platform
    ├─ Builds processed by Apple
    └─ Available after review (1-3 days)
```

### iOS Build Profiles

**In `eas.json`:**

```json
"testflight": {
  "ios": {
    "simulator": false,        // Don't build for simulator
    "distribution": "store",   // For App Store distribution
    "autoIncrement": true      // Auto-increment build number
  },
  "env": {
    "EXPO_PUBLIC_BACKEND_URL": "https://staging-api.suna.so/api"
  }
},

"production": {
  "ios": {
    "simulator": false,
    "autoIncrement": true
  },
  "env": {
    "EXPO_PUBLIC_BACKEND_URL": "https://staging-api.suna.so/api"
  }
}
```

### Prerequisites for iOS

```
✅ Apple Developer Account ($99/year)
   ├─ Apple ID
   ├─ App bundle identifier (com.kortix.app)
   └─ Signing certificate

✅ Expo Account (free)
   ├─ Needed for EAS Build
   └─ Authenticated via CLI

✅ App ID in App Store Connect
   ├─ Created before first build
   ├─ Identifier: com.kortix.app
   └─ Name: Kortix

✅ Signing credentials set up
   ├─ Certificate + private key
   ├─ Provisioning profile
   └─ Managed by EAS (automatic)
```

### iOS Build Step-by-Step

#### Step 1: Setup (First Time Only)

```bash
# Navigate to mobile app
cd apps/mobile

# Login to Expo
eas login

# Set up credentials for iOS
eas credentials
# Follow prompts to create/link Apple Developer account
```

#### Step 2: Build for TestFlight

```bash
# Build and upload to TestFlight (Apple's beta testing service)
eas build --profile testflight --platform ios --auto-submit

# Or just build, then submit later:
eas build --profile testflight --platform ios
# After build completes:
eas submit --profile testflight --platform ios
```

#### Step 3: Test on TestFlight

- App appears in TestFlight app (invite testers via email)
- Users can install and test the beta version
- Receive crash reports and feedback

#### Step 4: Build for Production

```bash
# When ready for production
eas build --profile production --platform ios --auto-submit
```

#### Step 5: App Review & Release

- Apple reviews the app (1-3 days)
- If approved, it goes live on App Store
- If rejected, you get feedback and can resubmit

### Monitoring iOS Builds

```bash
# Check build status
eas build:list

# View specific build
eas build:list --platform ios

# Cancel a build
eas build:cancel <BUILD_ID>

# View build logs
# Click the build URL provided in terminal
```

---

## 🤖 Android Deployment

### How Android Works with React Native

```
React Native Code
    ↓
Expo Build System
    ├─ Compiles JavaScript to native Android
    ├─ Links native modules
    ├─ Creates Gradle build
    └─ Compiles to .aab (Android App Bundle)
    ↓
Signs with keystore
    ├─ Android requires all apps to be signed
    ├─ Uses your private keystore file
    ├─ Managed by EAS automatically
    └─ Keeps key secure in EAS
    ↓
Produces .aab file
    ├─ Android App Bundle
    ├─ Google Play optimizes for each device
    └─ Includes native code for multiple architectures
    ↓
Uploaded to Google Play Console
    ├─ Google's management platform
    ├─ Auto-generated APKs for each device
    └─ Available immediately after release
```

### Android Build Profiles

**In `eas.json`:**

```json
"production": {
  "android": {
    "buildType": "apk"  // or "aab" for Play Store
  },
  "env": {
    "EXPO_PUBLIC_BACKEND_URL": "https://staging-api.suna.so/api"
  }
},

"preview": {
  "android": {
    "buildType": "apk"
  }
}
```

### Prerequisites for Android

```
✅ Google Play Developer Account ($25 one-time)
   ├─ Google account
   ├─ Payment method
   └─ Developer profile

✅ App created in Google Play Console
   ├─ App name: Kortix
   ├─ Package name: com.kortix.app
   ├─ Store listing created
   └─ Privacy policy link

✅ Expo Account (free)
   ├─ Needed for EAS Build
   └─ Authenticated via CLI

✅ Signing key
   ├─ Managed by Google Play's app signing
   ├─ EAS can manage upload key
   └─ (Simpler than iOS setup)
```

### Android Build Step-by-Step

#### Step 1: Setup (First Time Only)

```bash
# Navigate to mobile app
cd apps/mobile

# Login to Expo
eas login

# Set up credentials for Android
eas credentials
# EAS handles Android signing automatically
```

#### Step 2: Build for Google Play Internal Testing

```bash
# Build for internal testing (Google Play)
eas build --profile production --platform android

# After build completes:
eas submit --profile production --platform android
```

#### Step 3: Upload to Internal Testing Track

- App appears in Google Play Console
- Can add testers and share link
- Testers can install immediately

#### Step 4: Promote to Closed Testing

- More testers can access
- Collect feedback before production release

#### Step 5: Release to Production

- App goes live on Google Play Store
- Available to all users immediately
- No approval process (unlike iOS)

### Monitoring Android Builds

```bash
# Check build status
eas build:list --platform android

# View specific build
eas build:list

# Cancel a build
eas build:cancel <BUILD_ID>
```

---

## 🚀 Deployment Workflow

### Timeline

```
Day 1 - Prepare
├─ Update version in app.json
├─ Test app thoroughly locally
├─ Prepare release notes
└─ Create screenshots for stores

Day 2-3 - iOS Build & Submit
├─ eas build --profile testflight --platform ios --auto-submit
├─ Test on TestFlight (1-2 hours)
├─ eas build --profile production --platform ios --auto-submit
└─ Wait for Apple review (1-3 days)

Day 3-5 - Android Build & Submit
├─ eas build --profile production --platform android --auto-submit
├─ Appears on Google Play immediately
└─ (No review required)

Day 5+ - iOS App Store Review
├─ Apple reviews app
├─ If approved → App Store live! 🎉
└─ If rejected → Fix issues and resubmit
```

### Version Management

**In `app.json`:**

```json
{
  "expo": {
    "version": "1.0.0"  // Update this for releases
                        // Format: MAJOR.MINOR.PATCH
  }
}
```

**Build numbers** (auto-managed by EAS):
- TestFlight: Auto-incremented (1, 2, 3, ...)
- Production: Separate counter
- You only update the version, not build number

### Environment Variables

Different URLs for different environments:

**Development (local):**
```
EXPO_PUBLIC_BACKEND_URL=http://localhost:8000/api
```

**TestFlight (testing):**
```
EXPO_PUBLIC_BACKEND_URL=https://staging-api.suna.so/api
```

**Production (live):**
```
EXPO_PUBLIC_BACKEND_URL=https://api.suna.so/api
```

All configured in `eas.json` per profile.

---

## 📊 Comparison: iOS vs Android

| Aspect | iOS | Android |
|--------|-----|---------|
| **Store** | App Store | Google Play Store |
| **Review** | 1-3 days | Immediate |
| **Cost/Year** | $99 | $25 |
| **Build Time** | 10-15 min | 10-15 min |
| **Signing** | Certificate-based | Keystore-based |
| **Distribution** | App Archive (.ipa) | App Bundle (.aab) |
| **Testing** | TestFlight | Google Play Internal |
| **Architectures** | ARM64 | ARMv8, x86_64 |
| **Release Process** | Manual + review | Automatic |

---

## 🔑 Key Configuration Files

### `app.json`

```json
{
  "expo": {
    "name": "Kortix",
    "slug": "kortix",
    "version": "1.0.0",
    
    "ios": {
      "bundleIdentifier": "com.kortix.app",
      "usesAppleSignIn": true,
      "supportsTablet": true
    },
    
    "android": {
      "package": "com.kortix.app",
      "adaptiveIcon": {
        "foregroundImage": "./assets/images/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      }
    }
  }
}
```

### `eas.json`

```json
{
  "cli": {
    "version": ">= 5.9.0",
    "appVersionSource": "remote"  // Version from app.json
  },
  
  "build": {
    "production": {
      "ios": {
        "autoIncrement": true      // Auto-increment build #
      },
      "env": {
        "EXPO_PUBLIC_BACKEND_URL": "https://api.suna.so/api"
      }
    },
    
    "testflight": {
      "ios": {
        "distribution": "store",   // For App Store
        "autoIncrement": true
      },
      "env": {
        "EXPO_PUBLIC_BACKEND_URL": "https://staging-api.suna.so/api"
      }
    }
  },
  
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-email@example.com",
        "ascAppId": "YOUR_APP_ID",
        "appleTeamId": "YOUR_TEAM_ID"
      }
    }
  }
}
```

---

## 🛠️ Complete Command Reference

### Initial Setup

```bash
# Login to Expo
eas login

# Set up credentials
eas credentials
```

### Building

```bash
# iOS TestFlight
eas build --profile testflight --platform ios

# iOS Production
eas build --profile production --platform ios

# Android Production
eas build --profile production --platform android

# Both platforms
eas build --platform ios && eas build --platform android

# With auto-submit
eas build --profile production --platform ios --auto-submit
```

### Submitting

```bash
# Submit iOS to TestFlight
eas submit --profile testflight --platform ios

# Submit iOS to App Store
eas submit --profile production --platform ios

# Submit Android
eas submit --profile production --platform android

# Auto-submit during build
eas build --profile production --platform ios --auto-submit
```

### Monitoring

```bash
# List all builds
eas build:list

# List iOS builds only
eas build:list --platform ios

# List Android builds only
eas build:list --platform android

# Cancel a build
eas build:cancel <BUILD_ID>

# View latest build
eas build:view
```

---

## 🔐 Security & Credentials

### How EAS Manages Signing

**iOS:**
```
✅ EAS handles certificate creation
✅ Private key stored securely on EAS servers
✅ You don't need to manage certificates manually
✅ EAS auto-provisions for new devices
```

**Android:**
```
✅ EAS can generate signing keystore
✅ OR use Google Play App Signing
✅ Private key never leaves secure storage
✅ New APK signatures guaranteed
```

### Environment Variables

Sensitive data configured per profile in `eas.json`:

```json
"env": {
  "EXPO_PUBLIC_BACKEND_URL": "...",
  "EXPO_PUBLIC_SUPABASE_URL": "...",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY": "..."
}
```

**Note:** Only use `EXPO_PUBLIC_*` prefix for public data. Secrets should be stored in Supabase or backend.

---

## 🎯 Platform-Specific Features

### iOS Features

```typescript
// Apps/mobile/app.json
"ios": {
  "bundleIdentifier": "com.kortix.app",
  "usesAppleSignIn": true,      // Sign in with Apple
  "supportsTablet": true,        // iPad support
  "infoPlist": {
    "NSLocalNetworkUsageDescription": "..."
  }
}
```

**Supported:**
- Apple Sign In ✅
- Face ID / Touch ID ✅
- Haptics ✅
- Background refresh ✅
- Push notifications ✅

### Android Features

```typescript
// Apps/mobile/app.json
"android": {
  "package": "com.kortix.app",
  "adaptiveIcon": {
    "foregroundImage": "...",
    "backgroundColor": "#ffffff"
  },
  "permissions": [
    "android.permission.CAMERA",
    "android.permission.RECORD_AUDIO"
  ]
}
```

**Supported:**
- Camera ✅
- Microphone ✅
- Location ✅
- Storage ✅
- File picker ✅

---

## 📋 Pre-Release Checklist

Before building for production:

```
General:
- [ ] Code committed and pushed
- [ ] All tests passing
- [ ] No console errors or warnings
- [ ] Tested locally on simulator/emulator

iOS Specific:
- [ ] Updated app.json version
- [ ] Icons updated (1024x1024)
- [ ] Splash screen updated
- [ ] Privacy policy URL set
- [ ] App Store screenshots ready
- [ ] Release notes written
- [ ] Apple Developer account verified

Android Specific:
- [ ] Updated app.json version
- [ ] Adaptive icon created (512x512)
- [ ] Feature graphic created (1024x500)
- [ ] Screenshots ready
- [ ] Content rating completed
- [ ] Privacy policy link provided

Build:
- [ ] Environment variables correct
- [ ] Build profile configured
- [ ] Credentials up to date
- [ ] Backend API available

After Build:
- [ ] Build completes successfully
- [ ] Verify app works in TestFlight / internal testing
- [ ] Test on real device if possible
- [ ] Ready for store submission
```

---

## 🚨 Common Issues & Solutions

### iOS Issues

**"Certificate not found"**
```
Solution: Run `eas credentials` and regenerate iOS certificates
```

**"Provisioning profile error"**
```
Solution: 
1. Go to Apple Developer account
2. Revoke old certificates
3. Run `eas credentials` again
```

**"App rejected for policy reasons"**
```
Solution: 
1. Read Apple's rejection reason carefully
2. Make required changes
3. Increment version
4. Resubmit
```

### Android Issues

**"Build fails: Gradle compilation error"**
```
Solution:
1. Check app.json for syntax errors
2. Verify all plugin configurations
3. Retry build
```

**"Upload fails: Invalid APK/AAB"**
```
Solution:
1. Ensure correct build type (aab for store)
2. Check minimum API level requirements
3. Verify signing certificate
```

---

## 📈 Release Strategy

### Option 1: TestFlight First (Recommended)

```
1. Build TestFlight version
2. Test thoroughly (5-7 days)
3. Fix bugs found
4. Build production iOS
5. Submit to App Store
6. While iOS reviews, build Android
7. Release Android immediately
8. iOS releases after approval
```

### Option 2: Parallel Development

```
1. Build TestFlight iOS
2. Build Android internal testing simultaneously
3. Test both in parallel
4. Fix issues
5. Build production versions
6. Submit both
7. iOS reviews, Android live immediately
```

### Option 3: Staged Rollout

```
1. Release on Android first (faster)
2. Monitor for issues
3. Release on iOS after iOS review
4. Consider staged rollout on Google Play (20% → 50% → 100%)
```

---

## 🎓 Understanding the Tech

### Why We Use EAS Build

```
✅ Cloud-based - Don't need Mac for iOS builds
✅ Managed credentials - No certificate headaches
✅ Automatic signing - No manual key management
✅ Consistent - Same environment every build
✅ Fast - Parallel builds for iOS + Android
✅ Integration - Direct submission to stores
```

### What Happens During Build

```
1. Source code bundled
2. Environment variables injected
3. Dependencies installed
4. TypeScript compiled to JavaScript
5. Metro bundler creates bundle
6. Native modules compiled
7. Code signed with certificate
8. Final binary created (.ipa or .aab)
9. Uploaded to App Store/Play Store
```

### Why Different Files

```
iOS (.ipa - iOS Package Archive):
- Contains ARM64 native code only
- Signed with Apple certificate
- Optimized for iPhone/iPad
- ~100-200 MB

Android (.aab - Android App Bundle):
- Contains code for multiple architectures
- Signed with app signing key
- Google Play generates APKs per device
- ~50-100 MB total
```

---

## 📚 Next Steps

1. **Ensure prerequisites are set up**
   - Apple Developer account
   - Google Play Developer account
   - Expo account
   - CLI installed: `npm install -g eas-cli`

2. **Configure credentials** (first time)
   ```bash
   eas credentials
   ```

3. **Test locally**
   ```bash
   npm run dev
   ```

4. **Build for TestFlight** (test first)
   ```bash
   eas build --profile testflight --platform ios --auto-submit
   ```

5. **Test in TestFlight** (1-2 hours)
   - Invite yourself as tester
   - Verify app works

6. **Build for Production**
   ```bash
   eas build --profile production --platform ios --auto-submit
   eas build --profile production --platform android --auto-submit
   ```

7. **Monitor app stores**
   - iOS: Check status daily (review takes 1-3 days)
   - Android: Published immediately

---

## 🎉 Success Criteria

Your app is successfully deployed when:

✅ **iOS**
- TestFlight build installed and working
- App Store build submitted and approved
- Live on App Store

✅ **Android**
- Internal testing build working
- Google Play internal testing verified
- Live on Google Play Store

✅ **Monitoring**
- Crash rates: < 1%
- User feedback: Positive
- Backend API: Connected properly

---

## 📞 Resources

- **Expo Docs:** https://docs.expo.dev/build/setup/
- **EAS Submit:** https://docs.expo.dev/submit/ios/
- **App Store Connect:** https://appstoreconnect.apple.com/
- **Google Play Console:** https://play.google.com/console/

---

**Current Setup:**
- iOS Bundle ID: `com.kortix.app`
- Android Package: `com.kortix.app`
- Expo Project ID: `9fca3cff-a291-41c9-88b9-feb8053b990f`
- Staging API: `https://staging-api.suna.so/api`
- Production API: `https://api.suna.so/api`

*Last Updated: November 1, 2025*
