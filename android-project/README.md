# BashaRent Manager — Offline-First Bangladesh Rent & Property Management Android Project

## 1. Zero-Setup Installation Options for Windows Users

### Option A: Instant Offline Android App Installation (No Android Studio or PC Tools Needed)
Open the hosted BashaRent Manager application URL in **Google Chrome on your Android phone** and tap **"Install Android App"** (or Chrome menu `⋮` → **Install app**).
- Installs directly to your Android app launcher with a native standalone window.
- Stores all 22 relational tables offline on your phone via IndexedDB/SQLite.
- Generates PDF and PNG receipts in Bengali & English, sends WhatsApp/SMS reminders on the 5th/10th/15th, and exports AES-256-GCM encrypted `.brmbackup` files.

### Option B: Cloud-Compiled Native Kotlin + Jetpack Compose + Room APK via GitHub Actions
If you want the standalone `.apk` binary compiled from the native Kotlin/Room source code without installing Android Studio on your Windows PC:
1. Extract `BashaRentManager-Android-Project.tar.gz` and push or upload the files to a free GitHub repository.
2. Open the **Actions** tab in GitHub — the included `.github/workflows/build-apk.yml` workflow runs automatically on Ubuntu with JDK 17 and Android SDK 34.
3. Download **`BashaRentManager-release-signed-apk`** from the workflow Artifacts and install it on your Android phone.
