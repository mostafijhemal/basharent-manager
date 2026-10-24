import React, { useEffect, useState } from 'react';
import { Fingerprint, Lock, ShieldAlert } from 'lucide-react';
import { hashPinCode } from '../services/cryptoBackupService';
import { Language } from '../types/models';

export const PinLockOverlay: React.FC<{
  expectedPinHash: string;
  pinLength: 4 | 6;
  biometricEnabled: boolean;
  lang: Language;
  appName: string;
  onUnlocked: () => void;
}> = ({
  expectedPinHash,
  pinLength,
  biometricEnabled,
  lang,
  appName,
  onUnlocked,
}) => {
  const [enteredPin, setEnteredPin] = useState('');
  const [failedCount, setFailedCount] = useState(0);
  const [cooldownSec, setCooldownSec] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const isBn = lang === 'bn';

  useEffect(() => {
    if (cooldownSec <= 0) return;
    const t = setInterval(() => {
      setCooldownSec((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [cooldownSec]);

  const verifyPin = async (candidate: string) => {
    if (cooldownSec > 0) return;
    const candidateHash = await hashPinCode(candidate);
    if (candidateHash === expectedPinHash) {
      setEnteredPin('');
      setFailedCount(0);
      setErrorMsg('');
      onUnlocked();
    } else {
      const nextFails = failedCount + 1;
      setFailedCount(nextFails);
      setEnteredPin('');
      if (nextFails >= 3) {
        setCooldownSec(15);
        setErrorMsg(
          isBn
            ? '৩ বার ভুল পিন। নিরাপত্তার জন্য ১৫ সেকেন্ড অপেক্ষা করুন।'
            : '3 incorrect attempts. Throttled for 15 seconds.'
        );
      } else {
        setErrorMsg(
          isBn
            ? 'ভুল পিন কোড। আবার চেষ্টা করুন।'
            : 'Incorrect PIN code. Please try again.'
        );
      }
    }
  };

  const handleDigit = (d: string) => {
    if (cooldownSec > 0) return;
    setErrorMsg('');
    const next = (enteredPin + d).slice(0, pinLength);
    setEnteredPin(next);
    if (next.length === pinLength) {
      void verifyPin(next);
    }
  };

  const handleBiometric = async () => {
    if (!window.PublicKeyCredential) {
      setErrorMsg(
        isBn
          ? 'এই ব্রাউজারে বায়োমেট্রিক সমর্থিত নয়। অনুগ্রহ করে পিন ব্যবহার করুন।'
          : 'Biometric hardware not available in this session. Please use your PIN fallback.'
      );
      return;
    }
    setErrorMsg(
      isBn
        ? 'নিরাপত্তা যাচাইয়ের জন্য পিন কোড প্রদান করুন।'
        : 'Please enter your PIN to verify session.'
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 p-4 text-white">
      <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl">
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold tracking-tight">{appName}</h2>
          <p className="text-xs text-slate-400 mt-1">
            {isBn
              ? `${pinLength} সংখ্যার নিরাপত্তা পিন কোড দিন`
              : `Enter your ${pinLength}-digit security PIN`}
          </p>
        </div>

        {/* PIN Indicators */}
        <div className="flex items-center justify-center gap-3 my-6">
          {Array.from({ length: pinLength }).map((_, idx) => (
            <div
              key={idx}
              className={`w-3.5 h-3.5 rounded-full border transition-colors ${
                idx < enteredPin.length
                  ? 'bg-emerald-400 border-emerald-400'
                  : 'bg-slate-800 border-slate-600'
              }`}
            />
          ))}
        </div>

        {errorMsg && (
          <div className="mb-4 rounded-lg bg-red-950/60 border border-red-800/70 px-3 py-2 text-xs text-red-300 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-red-400" />
            <span>
              {errorMsg} {cooldownSec > 0 ? `(${cooldownSec}s)` : ''}
            </span>
          </div>
        )}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-2.5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              disabled={cooldownSec > 0}
              onClick={() => handleDigit(digit)}
              className="h-12 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 font-mono text-base font-semibold transition-colors disabled:opacity-40"
            >
              {digit}
            </button>
          ))}
          {biometricEnabled ? (
            <button
              onClick={handleBiometric}
              className="h-12 rounded-xl bg-slate-800/70 hover:bg-slate-700 flex items-center justify-center text-emerald-400"
              title="Biometric Unlock"
            >
              <Fingerprint className="w-5 h-5" />
            </button>
          ) : (
            <div />
          )}
          <button
            disabled={cooldownSec > 0}
            onClick={() => handleDigit('0')}
            className="h-12 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 font-mono text-base font-semibold transition-colors disabled:opacity-40"
          >
            0
          </button>
          <button
            onClick={() => setEnteredPin((p) => p.slice(0, -1))}
            className="h-12 rounded-xl bg-slate-800/70 hover:bg-slate-700 text-xs font-medium text-slate-300"
          >
            {isBn ? 'মুছুন' : 'Clear'}
          </button>
        </div>
      </div>
    </div>
  );
};
