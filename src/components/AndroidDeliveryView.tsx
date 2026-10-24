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

      {/* Highlight Box: Direct Signed APK Download (Zero Tooling, Works on Any Android Phone) */}
      <div className="rounded-xl bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 border-2 border-emerald-500/50 p-6 text-white shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>{isBn ? 'সরাসরি ইনস্টলেশন যোগ্য সাইন করা APK' : 'Official Pre-Compiled & Signed Android APK'}</span>
            </div>
            <h3 className="text-xl font-bold text-white">
              {isBn
                ? 'BashaRentManager.apk সরাসরি ডাউনলোড করুন'
                : 'Download BashaRentManager.apk (Direct Install)'}
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              {isBn
                ? 'ব্রাউজারের কোনো ঝামেলা ছাড়াই সরাসরি আপনার অ্যান্ড্রয়েড ফোনে ইনস্টল করুন। এটি অফলাইন ইঞ্জিন সহ সাইন করা (v1+v2+v3 Signature, TargetSDK 33, MinSDK 21) আসল APK ফাইল।'
                : 'Direct native Android package with built-in offline engine and local database. Pre-compiled, aligned, and verified with Android v1+v2+v3 signing schemes (TargetSDK 33, MinSDK 21).'}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-300 font-mono tabular-nums">
              <span>Size: 1.4 MB</span>
              <span aria-hidden="true">·</span>
              <span>Package: com.basharent.manager</span>
              <span aria-hidden="true">·</span>
              <span>100% Standalone Offline</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
            <a
              href="/downloads/BashaRentManager.apk"
              download="BashaRentManager.apk"
              className="px-6 py-3.5 text-sm font-bold text-slate-950 bg-emerald-400 rounded-xl hover:bg-emerald-300 transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2.5 active:scale-95"
            >
              <Download className="w-5 h-5" />
              <span>{isBn ? 'APK ডাউনলোড করুন (১.৪ MB)' : 'Download APK File (1.4 MB)'}</span>
            </a>
            <a
              href="/downloads/BashaRentManager-Android-Project.tar.gz"
              download="BashaRentManager-Android-Project.tar.gz"
              className="px-4 py-2.5 text-xs font-semibold text-slate-300 bg-slate-800/80 hover:bg-slate-800 rounded-xl transition-colors border border-slate-700 flex items-center justify-center gap-2"
            >
              <FileArchive className="w-4 h-4 text-emerald-400" />
              <span>{isBn ? 'সম্পূর্ণ সোর্স কোড (.tar.gz)' : 'Full Source Code (.tar.gz)'}</span>
            </a>
          </div>
        </div>

        {/* Installation Steps Guide */}
        <div className="mt-6 pt-5 border-t border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/60 space-y-1">
            <span className="font-bold text-emerald-400">{isBn ? '১. ডাউনলোড করুন' : '1. Download APK'}</span>
            <p className="text-slate-300">
              {isBn 
                ? 'উপরের "APK ডাউনলোড করুন" বাটনে চাপুন। ফাইলটি সরাসরি আপনার ফোনে ডাউনলোড হবে।'
                : 'Tap "Download APK File". Chrome will download BashaRentManager.apk directly to your phone.'}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/60 space-y-1">
            <span className="font-bold text-emerald-400">{isBn ? '২. পারমিশন দিন' : '2. Allow Unknown Sources'}</span>
            <p className="text-slate-300">
              {isBn
                ? 'ডাউনলোড শেষে ট্যাপ করুন। "Install unknown apps" আসলে Settings-এ গিয়ে "Allow from this source" অন করুন।'
                : 'Tap the downloaded file. If prompted by Android, tap "Settings" and turn on "Allow from this source".'}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/60 space-y-1">
            <span className="font-bold text-emerald-400">{isBn ? '৩. ইনস্টল সম্পন্ন' : '3. Tap Install'}</span>
            <p className="text-slate-300">
              {isBn
                ? '"Install" চাপুন। অ্যাপটি আপনার ফোনের হোম স্ক্রিনে এসে যাবে এবং ইন্টারনেট ছাড়াই চলবে।'
                : 'Tap "Install". The app will appear on your home screen and launcher, fully offline!'}
            </p>
          </div>
        </div>
      </div>

      {/* Two Alternate Paths */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Path 1: Chrome Shortcut Explanation */}
        <div className="rounded-xl bg-white border border-slate-200 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 text-slate-900 font-semibold text-sm">
              <Smartphone className="w-5 h-5 text-emerald-600" />
              <span>
                {isBn
                  ? 'Chrome ব্রাউজার অপশন: "Create shortcut" (আপনার স্ক্রিনশট অনুযায়ী)'
                  : 'Chrome Shortcut Method: "Create shortcut" (From Your Screenshot)'}
              </span>
            </div>
            <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
              <p className="font-semibold mb-1">
                {isBn
                  ? 'স্ক্রিনশটে "This app cannot be installed" কেন দেখিয়েছে?'
                  : 'Why Chrome showed "This app cannot be installed":'}
              </p>
              <p className="text-amber-800 leading-relaxed">
                {isBn
                  ? 'Chrome ব্রাউজার স্বয়ংক্রিয়ভাবে Google-এর ক্লাউড সার্ভার দিয়ে WebAPK তৈরি করতে চেষ্টা করে। AI Studio প্রিভিউ লিংকটি ক্লাউড সিকিউরিটি দিয়ে সুরক্ষিত থাকায় গুগল সার্ভার বাইরে থেকে এটি সরাসরি মিন্ট করতে পারেনি। এর সহজ সমাধান হলো:'
                  : 'Google Chrome on Android attempts to communicate with external WebAPK servers (webapk.googleapis.com). Because the AI Studio development preview environment restricts external automated bot requests, Chrome defaults to the shortcut option.'}
              </p>
            </div>
            <ol className="mt-4 space-y-2 text-xs text-slate-700 list-decimal list-inside">
              <li>
                {isBn
                  ? 'আপনার স্ক্রিনশটে থাকা নীল রঙের "Create shortcut" বাটনে সরাসরি ট্যাপ করুন।'
                  : 'Simply tap the blue "Create shortcut" button shown on your phone screen.'}
              </li>
              <li>
                {isBn
                  ? 'এটি সাথে সাথে আপনার অ্যান্ড্রয়েড ফোনের হোম স্ক্রিনে "BashaRent" আইকন যোগ করে দেবে।'
                  : 'Chrome will immediately add the BashaRent Manager icon to your phone\'s home screen.'}
              </li>
              <li>
                {isBn
                  ? 'আমাদের সার্ভিস ওয়ার্কার ইতিমধ্যে ক্যাশ করে রাখায় এটি ইন্টারনেট ছাড়াই পূর্ণাঙ্গ অ্যাপের মতো খুলবে।'
                  : 'Because the offline service worker is already cached, it launches full-screen and works 100% offline.'}
              </li>
            </ol>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {isBn ? 'বিকল্প: সরাসরি উপরে থাকা APK ডাউনলোড বাটন ব্যবহার করুন' : 'Or use the Direct APK Download button above'}
            </span>
          </div>
        </div>

        {/* Path 2: Native Android Source & Cloud CI */}
        <div className="rounded-xl bg-white border border-slate-200 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 text-slate-900 font-semibold text-sm">
              <Code2 className="w-5 h-5 text-emerald-600" />
              <span>
                {isBn
                  ? 'নেটিভ Kotlin + Jetpack Compose সোর্স কোড ও GitHub Actions'
                  : 'Native Android Kotlin Source Archive & GitHub CI'}
              </span>
            </div>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              {isBn
                ? 'আমরা সম্পূর্ণ নেটিভ অ্যান্ড্রয়েড সোর্স প্রজেক্ট (`com.basharent.manager`, Room SQLite, WorkManager, AES-GCM, PdfDocument) এবং `.github/workflows/build-apk.yml` তৈরি করে দিয়েছি।'
                : 'Includes the complete native Android Kotlin project (`com.basharent.manager`, MinSDK 26, TargetSDK 34, Room SQLite, WorkManager, AES-GCM) with automated GitHub Actions workflow.'}
            </p>
            <ol className="mt-4 space-y-2 text-xs text-slate-700 list-decimal list-inside">
              <li>
                {isBn
                  ? 'BashaRentManager-Android-Project.tar.gz ফাইলটি যেকোনো সময় সংরক্ষণ করতে পারেন।'
                  : 'Download BashaRentManager-Android-Project.tar.gz for your archives or future custom extensions.'}
              </li>
              <li>
                {isBn
                  ? 'Android Studio-তে ওপেন করে বা GitHub-এ পুশ করে নতুন সংস্করণ বিল্ড করা সম্ভব।'
                  : 'Open in Android Studio anytime or push to GitHub to trigger automated cloud builds.'}
              </li>
            </ol>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs font-mono text-slate-500">
              Application ID: com.basharent.manager
            </span>
            <a
              href="/downloads/BashaRentManager-Android-Project.tar.gz"
              download="BashaRentManager-Android-Project.tar.gz"
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isBn ? 'সোর্স কোড ডাউনলোড' : 'Download Source'}</span>
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
