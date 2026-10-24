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
        className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
      >
        <Smartphone className="w-3.5 h-3.5" />
        <span>{isBn ? 'ফোনে ইনস্টল করুন' : 'Install on Phone'}</span>
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {isBn
                  ? 'অ্যান্ড্রয়েড ফোনে ইনস্টল করার নিয়ম (Option 1)'
                  : 'How to Open & Install on Your Android Phone (Option 1)'}
              </h3>
              <button
                onClick={() => setShowGuide(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-900 space-y-1.5">
              <div className="font-bold flex items-center gap-1.5">
                <Share2 className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  {isBn
                    ? 'গুরুত্বপূর্ণ ধাপ ১: AI Studio থেকে পাবলিক লিংক চালু করুন'
                    : 'Step 1 (Required): Enable the Shared Link in AI Studio First'}
                </span>
              </div>
              <p className="leading-relaxed">
                {isBn
                  ? 'AI Studio-এর প্রিভিউ লিংকটি ডিফল্টভাবে প্রাইভেট থাকে। আপনার ফোনে লিংকটি চালু করতে পিসির স্ক্রিনের একদম উপরে ডানপাশে AI Studio-এর "Share" বা "Deploy" (রকেট/শেয়ার আইকন) বাটনে ক্লিক করে অ্যাপটি পাবলিক বা শেয়ার করুন, অথবা নিচের বাটন থেকে ফুল-স্ক্রিন ট্যাবে খুলুন।'
                  : 'By default, AI Studio blocks direct phone access until you enable sharing. Look at the top-right corner of the Google AI Studio toolbar (above this preview frame) and click the "Share" or "Deploy" button to activate the public URL for your phone.'}
              </p>
            </div>

            <div className="space-y-2.5 text-xs text-slate-700">
              <div className="font-bold text-slate-900">
                {isBn
                  ? 'ধাপ ২: ফোনের Chrome ব্রাউজারে ইনস্টল করুন'
                  : 'Step 2: Open in Chrome on Your Phone & Tap Install'}
              </div>
              <ol className="space-y-1.5 list-decimal list-inside leading-relaxed">
                <li>
                  {isBn
                    ? 'Share/Deploy চালু করার পর প্রাপ্ত লিংকটি আপনার অ্যান্ড্রয়েড ফোনের Google Chrome ব্রাউজারে খুলুন।'
                    : 'Open the shared link in Google Chrome on your Android phone (make sure you are signed into the same Google account if set to Restricted).'}
                </li>
                <li>
                  {isBn
                    ? 'Chrome-এর উপরে ডানপাশে তিন ডট মেনুতে (⋮) ট্যাপ করে "Install app" বা "Add to Home screen" নির্বাচন করুন।'
                    : 'Tap the Chrome menu (⋮) in the top-right corner and tap "Install app" or "Add to Home screen".'}
                </li>
                <li>
                  {isBn
                    ? 'ইনস্টল হয়ে গেলে অ্যাপটি ইন্টারনেট ছাড়াই (Offline) আপনার ফোনে কাজ করবে।'
                    : 'Once installed on your home screen, BashaRent Manager runs 100% offline.'}
                </li>
              </ol>
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
