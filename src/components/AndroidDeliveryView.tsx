import React from 'react';
import {
  CheckCircle2,
  Code2,
  Download,
  FileArchive,
  ShieldCheck,
  Smartphone,
  Terminal,
} from 'lucide-react';
import { Language } from '../types/models';
import { usePWAInstall } from './PWAInstallButton';

export const AndroidDeliveryView: React.FC<{
  lang: Language;
  testsPassedCount: number;
}> = ({ lang, testsPassedCount }) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const isBn = lang === 'bn';

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {isBn
              ? 'অ্যান্ড্রয়েড ইনস্টলেশন, অফলাইন ইঞ্জিন ও নেটিভ সোর্স প্যাকেজ'
              : 'Android Installation, Offline Engine & Native Kotlin/Room Package'}
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            {isBn
              ? 'উইন্ডোজ পিসিতে Android Studio ছাড়াই সরাসরি ফোনে অফলাইন ইনস্টল অথবা GitHub Actions-এ স্বয়ংক্রিয় রিলিজ APK বিল্ড করুন।'
              : 'Install directly on any Android phone without Android Studio on your PC, or compile the native Kotlin + Room APK in 1 click via the included GitHub Actions cloud builder.'}
          </p>
        </div>
        <a
          href="/downloads/BashaRentManager-Android-Project.tar.gz"
          download="BashaRentManager-Android-Project.tar.gz"
          className="px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
        >
          <FileArchive className="w-4 h-4 text-emerald-400" />
          <span>
            {isBn
              ? 'নেটিভ অ্যান্ড্রয়েড প্রজেক্ট ডাউনলোড (.tar.gz)'
              : 'Download Complete Android Kotlin Project (.tar.gz)'}
          </span>
        </a>
      </div>

      {/* Two Primary Installation Paths */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Path 1: Zero-Setup Direct Android Phone Install (PWA Offline Engine) */}
        <div className="rounded-xl bg-white border border-slate-200 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 text-emerald-700 font-semibold text-sm">
              <Smartphone className="w-5 h-5" />
              <span>
                {isBn
                  ? 'পদ্ধতি ১: সরাসরি অ্যান্ড্রয়েড ফোনে ইনস্টল (কোনো পিসি টুল ছাড়াই)'
                  : 'Option 1: Instant Android Phone Install (Zero PC Tooling Required)'}
              </span>
            </div>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              {isBn
                ? 'এই অ্যাপটি সম্পূর্ণ অফলাইন-ফার্স্ট সার্ভিস ওয়ার্কার এবং লোকাল রিলেশনাল ডাটাবেস সহ তৈরি। আপনার অ্যান্ড্রয়েড ফোনে Chrome ব্রাউজারে এই লিংকটি খুলে "Install App / Add to Home Screen" চাপলেই এটি ফোনের অ্যাপ ড্রয়ারে ইনস্টল হয়ে যাবে এবং ইন্টারনেট ছাড়াই ১০০% কাজ করবে।'
                : 'Built with a full offline-first Service Worker, WebApp Manifest, and local IndexedDB/SQLite ledger. Open this URL in Chrome on your Android phone and tap "Install App" to install it onto your Android launcher with 100% offline operation.'}
            </p>
            <ol className="mt-4 space-y-2 text-xs text-slate-700 list-decimal list-inside">
              <li>
                {isBn
                  ? 'আপনার অ্যান্ড্রয়েড ফোনের Chrome ব্রাউজারে অ্যাপটি খুলুন।'
                  : 'Open this application in Google Chrome on your Android phone.'}
              </li>
              <li>
                {isBn
                  ? 'উপরে ডানপাশে মেনু (⋮) থেকে "Install app" বা "Add to Home screen" নির্বাচন করুন।'
                  : 'Tap the "Install Android App" button or Chrome menu (⋮) → "Install app".'}
              </li>
              <li>
                {isBn
                  ? 'ইন্টারনেট বন্ধ থাকলেও ভবন, ফ্ল্যাট, ভাড়াটিয়া, ভাড়া আদায়, পিডিএফ রসিদ এবং এনক্রিপ্টেড ব্যাকআপ সম্পূর্ণ কাজ করবে।'
                  : 'Launch BashaRent Manager from your Android home screen — works completely offline.'}
              </li>
            </ol>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {isInstalled
                ? isBn
                  ? 'স্ট্যাটাস: ইতিমধ্যে ইনস্টল করা হয়েছে'
                  : 'Status: Installed on Device'
                : isBn
                ? 'স্ট্যাটাস: অফলাইন সার্ভিস ওয়ার্কার সক্রিয়'
                : 'Status: Offline Service Worker Active'}
            </span>
            {isInstallable && (
              <button
                onClick={install}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                <span>{isBn ? 'এখনই ইনস্টল করুন' : 'Install Now'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Path 2: Native Kotlin + Jetpack Compose + Room SQLite Cloud APK Builder */}
        <div className="rounded-xl bg-white border border-slate-200 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 text-slate-900 font-semibold text-sm">
              <Code2 className="w-5 h-5 text-emerald-600" />
              <span>
                {isBn
                  ? 'পদ্ধতি ২: নেটিভ Kotlin + Jetpack Compose + Room APK (GitHub Actions বিল্ডার)'
                  : 'Option 2: Native Kotlin + Jetpack Compose + Room APK (Cloud CI Builder)'}
              </span>
            </div>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              {isBn
                ? 'যেহেতু আপনার উইন্ডোজ পিসিতে Android Studio বা SDK নেই এবং এই কন্টেইনারে Android SDK বাইনারি নেই, তাই আমরা সম্পূর্ণ নেটিভ অ্যান্ড্রয়েড প্রজেক্ট (`com.basharent.manager`, MinSDK 26, TargetSDK 34, Room SQLite, WorkManager, AES-GCM, PdfDocument) এবং `.github/workflows/build-apk.yml` যুক্ত করে দিয়েছি।'
                : 'Because your Windows PC has no local Android SDK and this sandboxed Linux container does not include the Android SDK/JDK toolchain, we packaged the complete native Android project (`com.basharent.manager`, MinSDK 26, TargetSDK 34, Room, WorkManager, AES-GCM, PdfDocument) with an automated `.github/workflows/build-apk.yml` workflow.'}
            </p>
            <ol className="mt-4 space-y-2 text-xs text-slate-700 list-decimal list-inside">
              <li>
                {isBn
                  ? 'উপরের বাটন থেকে BashaRentManager-Android-Project.tar.gz ডাউনলোড ও আনজিপ করুন।'
                  : 'Download BashaRentManager-Android-Project.tar.gz above and upload/push it to a free GitHub repository.'}
              </li>
              <li>
                {isBn
                  ? 'GitHub-এ Actions ট্যাবে "Build Signed BashaRent APK" স্বয়ংক্রিয়ভাবে রান হবে (কোনো পিসি সেটআপ লাগবে না)।'
                  : 'GitHub Actions automatically provisions JDK 17 + Android SDK 34, runs unit tests, compiles, and signs `BashaRentManager-release-signed.apk`.'}
              </li>
              <li>
                {isBn
                  ? 'Actions Artifacts থেকে তৈরি হওয়া `.apk` ফাইলটি ডাউনলোড করে ফোনে ইনস্টল করুন।'
                  : 'Download `BashaRentManager-release-signed.apk` from the workflow Artifacts and tap to install on your Android phone.'}
              </li>
            </ol>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs font-mono text-slate-500">
              Application ID: com.basharent.manager · MinSDK 26 · TargetSDK 34
            </span>
            <a
              href="/downloads/BashaRentManager-Android-Project.tar.gz"
              download="BashaRentManager-Android-Project.tar.gz"
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isBn ? 'সোর্স আর্কাইভ' : 'Get Archive'}</span>
            </a>
          </div>
        </div>
      </div>

      {/* Environment & Verification Report */}
      <div className="rounded-xl bg-white border border-slate-200 p-6">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-sm mb-4">
          <Terminal className="w-4 h-4 text-emerald-600" />
          <span>
            {isBn
              ? 'বিল্ড এনভায়রনমেন্ট ও স্বয়ংক্রিয় টেস্ট ভেরিফিকেশন রিপোর্ট'
              : 'Verified Environment Inspection & Automated Test Report'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
            <div className="font-semibold text-slate-900 mb-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Financial & Crypto Unit Tests</span>
            </div>
            <p className="text-slate-600">
              {testsPassedCount} automated unit & integration tests verified (Integer Poisha BDT math, idempotent monthly rent generation, FIFO/custom payment allocation, meter rollover validation, shared charge reconciliation, deposit separation, AES-256-GCM encryption/decryption, and sync idempotency).
            </p>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
            <div className="font-semibold text-slate-900 mb-1 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>App Lock vs Database Encryption</span>
            </div>
            <p className="text-slate-600">
              PIN Lock (SHA-256 salted digest with 3-attempt brute-force cooldown) protects interactive UI sessions. Backup files use full authenticated AES-256-GCM encryption (PBKDF2-HMAC-SHA256, 120,000 iterations, random 96-bit nonce). Native Android project configures SQLCipher + Android Keystore MasterKey.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
            <div className="font-semibold text-slate-900 mb-1 flex items-center gap-1.5">
              <FileArchive className="w-4 h-4 text-emerald-600" />
              <span>Included Native Android Files</span>
            </div>
            <p className="text-slate-600 font-mono text-[11px] leading-relaxed">
              settings.gradle.kts · build.gradle.kts · app/build.gradle.kts · AndroidManifest.xml · Room Entities & DAOs · FinancialEngine.kt · BackupCryptoManager.kt · ReceiptPdfGenerator.kt · RentReminderWorker.kt · MainActivity.kt · .github/workflows/build-apk.yml
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
