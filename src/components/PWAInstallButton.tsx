import React, { useEffect, useState } from 'react';
import { Check, Copy, Download, Share2, Smartphone, X } from 'lucide-react';
import { Language } from '../types/models';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone ===
        true;
    setIsInstalled(isStandalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    install,
  };
}

export const PWAInstallButton: React.FC<{
  lang: Language;
  onOpenAndroidCenter?: () => void;
}> = ({ lang, onOpenAndroidCenter }) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [copied, setCopied] = useState(false);
  const isBn = lang === 'bn';

  const currentUrl =
    typeof window !== 'undefined' ? window.location.origin : '';

  const handleCopyUrl = () => {
    if (!currentUrl) return;
    navigator.clipboard.writeText(currentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
      >
        <Download className="w-3.5 h-3.5" />
        <span>{isBn ? 'অ্যাপ ইনস্টল করুন' : 'Install Android App'}</span>
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowGuide(true)}
        className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 shadow-sm"
      >
        <Download className="w-3.5 h-3.5 text-emerald-400" />
        <span>{isBn ? 'APK ডাউনলোড ও ইনস্টল' : 'Download APK'}</span>
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {isBn
                  ? 'ফোনে ইনস্টল করার ২টি সহজ উপায়'
                  : '2 Simple Ways to Install on Your Android Phone'}
              </h3>
              <button
                onClick={() => setShowGuide(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Direct APK Option (Best) */}
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs text-emerald-950 space-y-2.5">
              <div className="font-bold text-sm text-emerald-900 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-emerald-700 shrink-0" />
                  {isBn ? 'উপায় ১: সাইন করা APK সরাসরি ডাউনলোড (সবচেয়ে সহজ)' : 'Method 1: Direct Signed APK Download (Fastest)'}
                </span>
                <span className="text-[10px] bg-emerald-200/80 px-2 py-0.5 rounded text-emerald-800 font-mono">720 KB</span>
              </div>
              <p className="text-emerald-800 leading-relaxed">
                {isBn
                  ? 'Chrome ব্রাউজারের কোনো সীমাবদ্ধতা ছাড়া আসল অ্যান্ড্রয়েড অ্যাপ হিসেবে ইনস্টল করুন।'
                  : 'Pre-compiled, signed Android release package (TargetSDK 33, MinSDK 21) that installs cleanly on any Android phone.'}
              </p>
              <a
                href="/downloads/BashaRentManager.apk"
                download="BashaRentManager.apk"
                className="w-full py-2.5 text-xs font-bold text-slate-950 bg-emerald-400 rounded-lg hover:bg-emerald-300 transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>{isBn ? 'BashaRentManager.apk ডাউনলোড করুন' : 'Download BashaRentManager.apk'}</span>
              </a>
            </div>

            {/* Chrome Shortcut Explanation for their screenshot */}
            <div className="space-y-2 text-xs text-slate-700 rounded-xl bg-slate-50 border border-slate-200 p-3.5">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-slate-700 shrink-0" />
                <span>
                  {isBn
                    ? 'উপায় ২: আপনার স্ক্রিনশটের "Create shortcut" বাটনে চাপুন'
                    : 'Method 2: Tap "Create shortcut" on your Chrome screen'}
                </span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                {isBn
                  ? 'Chrome-এ "This app cannot be installed" দেখালে নিচে থাকা নীল রঙের "Create shortcut" বোতামে চাপুন। এটি সাথে সাথে আপনার ফোনের হোম স্ক্রিনে অ্যাপের আইকন তৈরি করে দেবে এবং অফলাইনে সম্পূর্ণ কাজ করবে।'
                  : 'If Chrome displays "This app cannot be installed", simply tap the blue "Create shortcut" button shown on your screen. It adds the icon to your home screen and operates 100% offline via the active Service Worker.'}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-between gap-2">
              <span className="text-[11px] font-mono text-slate-700 truncate">
                {currentUrl}
              </span>
              <button
                onClick={handleCopyUrl}
                className="px-3 py-1.5 rounded bg-slate-900 text-white text-xs font-semibold flex items-center gap-1 shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              {onOpenAndroidCenter && (
                <button
                  onClick={() => {
                    setShowGuide(false);
                    onOpenAndroidCenter();
                  }}
                  className="text-xs font-semibold text-emerald-700 hover:underline"
                >
                  {isBn
                    ? 'বিকল্প: অফলাইন HTML বা APK ফাইল ডাউনলোড →'
                    : 'Alternative: Download Portable Offline File or APK →'}
                </button>
              )}
              <button
                onClick={() => setShowGuide(false)}
                className="px-4 py-2 rounded-lg bg-slate-900 text-xs font-semibold text-white hover:bg-slate-800 ml-auto"
              >
                {isBn ? 'বুঝেছি' : 'Got It'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
