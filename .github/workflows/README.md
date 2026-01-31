# Mobile Build & Release Process (Two-Tier)

This directory contains the GitHub Actions workflows for the Kortix/Suna mobile application. We use a **Two-Tier** deployment strategy to balance development speed with native consistency.

---

## 🏗️ Tier 1: The Native Shell (Heavyweight)
**Workflow**: [`mobile-ios-binary.yml`](./mobile-ios-binary.yml)  
**Trigger**: Manual (`workflow_dispatch`) via GitHub UI or `gh` CLI.

### What it does:
Produces a complete, unsigned `.ipa` binary for iOS. It "bakes in" all native code, app icons, splash screens, and configuration files (`app.json`).

### Use this when:
- **Native Changes**: You added a new Expo plugin or native library.
- **Project Identity**: You changed the Expo `owner`, `slug`, or `projectId`.
- **Deep Linking**: You modified intent filters or associated domains.
- **First Install**: You are installing the app on a new device.

### How to trigger:
```powershell
gh workflow run "Mobile iOS Binary Build" --ref dev -f environment=railway
```

---

## ⚡ Tier 2: EAS OTA Updates (Lightweight)
**Workflow**: [`mobile-eas-update.yml`](./mobile-eas-update.yml)  
**Trigger**: Automatic on `push` to `dev` (Railway) or `stable` (Local).

### What it does:
Pushes JavaScript and asset bundles directly to existing app installs. The app "hot-swaps" the code in the background or on the next restart.

### Use this for:
- **UI Tweaks**: Changing colors, text, or layout.
- **Business Logic**: Updating hooks, API calls, or frontend validation.
- **Bug Fixes**: Fixing JS-level crashes without requiring a new download.

### Automatic Guardrail:
This workflow scans for native file changes. If it detects changes to `ios/`, `app.json`, or `package.json`, it will flag a **Warning** in the GitHub Action summary to remind you that an OTA update may not be sufficient.

---

## 🔄 Standard Development Workflow

1. **Active Dev**: Make changes, test locally.
2. **Push**: `jj git push` to the `dev` branch.
3. **Wait**: Tier 2 (OTA) will trigger automatically.
4. **Verify**: Open the app on your phone. You should see the changes (and the OTA test version string in Settings/Splash) within ~30 seconds of app restart.
5. **Native Sync**: If the changes are native, run the Tier 1 (Binary) build manually using the CLI command above.

---

## 🔐 Credentials Manager
All workflows require the following repository secrets to be set in GitHub:
- `EXPO_TOKEN`: Your personal Expo access token (`yhcsanction`).
