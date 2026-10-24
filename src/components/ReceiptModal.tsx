import React, { useEffect, useRef } from 'react';
import { Download, FileText, Printer, Share2, X } from 'lucide-react';
import {
  downloadReceiptAsPdf,
  downloadReceiptAsPng,
  ReceiptRenderContext,
  renderReceiptToCanvas,
  shareReceiptFile,
} from '../services/receiptGenerator';

export const ReceiptModal: React.FC<{
  context: ReceiptRenderContext | null;
  onClose: () => void;
}> = ({ context, onClose }) => {
  const previewContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!context || !previewContainerRef.current) return;
    const canvas = renderReceiptToCanvas(context);
    canvas.style.width = '100%';
    canvas.style.height = 'auto';
    canvas.style.borderRadius = '8px';
    canvas.style.border = '1px solid #E2E8F0';
    previewContainerRef.current.innerHTML = '';
    previewContainerRef.current.appendChild(canvas);
  }, [context]);

  if (!context) return null;
  const isBn = context.lang === 'bn';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {isBn ? 'ভাড়া ও বিলের রসিদ প্রিভিউ' : 'Official Payment Receipt Preview'}
            </h3>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              #{context.payment.receiptNumber} · {context.payment.paymentDate}
            </p>
          </div>
          <button
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200/60"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 max-h-[68vh] overflow-y-auto bg-slate-100/70">
          <div ref={previewContainerRef} className="w-full shadow-sm" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-slate-200 bg-white">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => downloadReceiptAsPdf(context)}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <FileText className="w-4 h-4" />
              <span>{isBn ? 'PDF ডাউনলোড' : 'Download PDF'}</span>
            </button>
            <button
              onClick={() => downloadReceiptAsPng(context)}
              className="px-4 py-2 text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>{isBn ? 'ছবি (PNG) ডাউনলোড' : 'Download Image (PNG)'}</span>
            </button>
            <button
              onClick={() => shareReceiptFile(context)}
              className="px-4 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Share2 className="w-4 h-4" />
              <span>{isBn ? 'শেয়ার (WhatsApp/Share)' : 'Share Receipt'}</span>
            </button>
            <button
              onClick={() => window.print()}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Printer className="w-4 h-4" />
              <span>{isBn ? 'প্রিন্ট' : 'Print'}</span>
            </button>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap shrink-0"
          >
            {isBn ? 'বন্ধ করুন' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
