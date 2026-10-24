import { jsPDF } from 'jspdf';
import {
  AppSettings,
  Building,
  Language,
  Payment,
  RentalUnit,
  Tenant,
} from '../types/models';
import { formatBDT } from './financialEngine';

export interface ReceiptRenderContext {
  payment: Payment;
  tenant: Tenant;
  building: Building;
  unit: RentalUnit;
  settings: AppSettings;
  lang: Language;
}

/**
 * Renders a high-resolution (1200x1550) receipt onto an HTML5 Canvas using native system/Google Bengali & English fonts.
 * Never includes NID numbers or private documents.
 */
export function renderReceiptToCanvas(ctxData: ReceiptRenderContext): HTMLCanvasElement {
  const { payment, tenant, building, unit, settings, lang } = ctxData;
  const isBn = lang === 'bn';

  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 1520;
  const ctx = canvas.getContext('2d')!;

  // White paper background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Top header band
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(0, 0, canvas.width, 190);

  // Header Title
  ctx.fillStyle = '#10B981';
  ctx.font = '700 38px "Plus Jakarta Sans", "Hind Siliguri", sans-serif';
  ctx.fillText(settings.appName || 'BashaRent Manager', 64, 78);

  ctx.fillStyle = '#F8FAFC';
  ctx.font = '600 24px "Plus Jakarta Sans", "Hind Siliguri", sans-serif';
  ctx.fillText(
    isBn ? 'বাড়িভাড়া ও ইউটিলিটি পরিশোধের রসিদ' : 'OFFICIAL RENT & UTILITY PAYMENT RECEIPT',
    64,
    122
  );

  ctx.fillStyle = '#94A3B8';
  ctx.font = '400 20px "Plus Jakarta Sans", "Hind Siliguri", sans-serif';
  ctx.fillText(`${building.name} — ${building.address}`, 64, 158);

  // Right side Receipt Badge in Header
  ctx.textAlign = 'right';
  ctx.fillStyle = '#F8FAFC';
  ctx.font = '700 26px "JetBrains Mono", monospace';
  ctx.fillText(`#${payment.receiptNumber}`, 1136, 80);

  ctx.fillStyle = '#10B981';
  ctx.font = '600 20px "Plus Jakarta Sans", "Hind Siliguri", sans-serif';
  ctx.fillText(
    payment.isReversed
      ? isBn
        ? 'বাতিলকৃত (REVERSED)'
        : 'REVERSED RECEIPT'
      : isBn
      ? 'পরিশোধিত (PAID)'
      : 'VERIFIED PAID',
    1136,
    118
  );

  ctx.fillStyle = '#CBD5E1';
  ctx.font = '400 19px "JetBrains Mono", monospace';
  ctx.fillText(
    `${isBn ? 'তারিখ:' : 'Date:'} ${payment.paymentDate}`,
    1136,
    154
  );
  ctx.textAlign = 'left';

  // Info Grid Box
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2;
  ctx.strokeRect(64, 230, 1072, 230);

  const drawLabelValue = (
    x: number,
    y: number,
    label: string,
    val: string,
    mono = false
  ) => {
    ctx.fillStyle = '#64748B';
    ctx.font = '600 18px "Plus Jakarta Sans", "Hind Siliguri", sans-serif';
    ctx.fillText(label, x, y);

    ctx.fillStyle = '#0F172A';
    ctx.font = mono
      ? '600 22px "JetBrains Mono", "Hind Siliguri", monospace'
      : '700 22px "Plus Jakarta Sans", "Hind Siliguri", sans-serif';
    ctx.fillText(val, x, y + 32);
  };

  drawLabelValue(
    96,
    272,
    isBn ? 'ভাড়াটিয়ার নাম (Tenant Name)' : 'Tenant Name',
    tenant.fullName
  );
  drawLabelValue(
    640,
    272,
    isBn ? 'ভবন ও ফ্ল্যাট (Building & Unit)' : 'Building & Unit',
    `${building.name} · ${unit.unitNumber}`
  );
  drawLabelValue(
    96,
    375,
    isBn ? 'মোবাইল নম্বর (Phone)' : 'Mobile Phone',
    tenant.primaryPhone,
    true
  );
  drawLabelValue(
    640,
    375,
    isBn ? 'পরিশোধের মাধ্যম (Payment Method)' : 'Payment Method & Ref',
    `${payment.method}${payment.transactionRef ? ` (${payment.transactionRef})` : ''}`,
    true
  );

  // Allocations Table Header
  let y = 510;
  ctx.fillStyle = '#F1F5F9';
  ctx.fillRect(64, y, 1072, 56);
  ctx.fillStyle = '#334155';
  ctx.font = '700 20px "Plus Jakarta Sans", "Hind Siliguri", sans-serif';
  ctx.fillText(
    isBn ? 'বিবরণ ও বিলিং মাস (Charge Allocation Breakdown)' : 'Charge Description & Billing Period',
    92,
    y + 35
  );
  ctx.textAlign = 'right';
  ctx.fillText(
    isBn ? 'পরিমাণ (Amount BDT)' : 'Allocated Amount (BDT)',
    1108,
    y + 35
  );
  ctx.textAlign = 'left';

  y += 56;
  for (const alloc of payment.allocations) {
    ctx.strokeStyle = '#E2E8F0';
    ctx.beginPath();
    ctx.moveTo(64, y + 64);
    ctx.lineTo(1136, y + 64);
    ctx.stroke();

    ctx.fillStyle = '#0F172A';
    ctx.font = '600 21px "Plus Jakarta Sans", "Hind Siliguri", sans-serif';
    ctx.fillText(alloc.label, 92, y + 40);

    ctx.textAlign = 'right';
    ctx.font = '600 22px "JetBrains Mono", "Hind Siliguri", monospace';
    ctx.fillText(formatBDT(alloc.amountPoisha, lang), 1108, y + 40);
    ctx.textAlign = 'left';
    y += 64;
  }

  // Summary Totals Box
  y = Math.max(y + 40, 920);
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(580, y, 556, 230);
  ctx.strokeStyle = '#CBD5E1';
  ctx.strokeRect(580, y, 556, 230);

  const drawSummaryRow = (
    rowY: number,
    label: string,
    val: string,
    highlight = false
  ) => {
    ctx.fillStyle = highlight ? '#0F172A' : '#475569';
    ctx.font = highlight
      ? '700 24px "Plus Jakarta Sans", "Hind Siliguri", sans-serif'
      : '600 20px "Plus Jakarta Sans", "Hind Siliguri", sans-serif';
    ctx.fillText(label, 612, rowY);

    ctx.textAlign = 'right';
    ctx.fillStyle = highlight ? '#059669' : '#0F172A';
    ctx.font = highlight
      ? '700 28px "JetBrains Mono", "Hind Siliguri", monospace'
      : '600 22px "JetBrains Mono", "Hind Siliguri", monospace';
    ctx.fillText(val, 1104, rowY);
    ctx.textAlign = 'left';
  };

  drawSummaryRow(
    y + 52,
    isBn ? 'পূর্ববর্তী বকেয়া (Previous Due):' : 'Previous Balance Due:',
    formatBDT(payment.previousBalancePoisha, lang)
  );
  drawSummaryRow(
    y + 115,
    isBn ? 'মোট প্রাপ্ত টাকা (Amount Received):' : 'Total Amount Received:',
    formatBDT(payment.amountReceivedPoisha, lang),
    true
  );
  drawSummaryRow(
    y + 182,
    isBn ? 'অবশিষ্ট বকেয়া (Remaining Balance):' : 'Remaining Balance Due:',
    formatBDT(payment.remainingBalancePoisha, lang)
  );

  // Notes & Recorded By
  if (payment.notes) {
    ctx.fillStyle = '#475569';
    ctx.font = '400 19px "Plus Jakarta Sans", "Hind Siliguri", sans-serif';
    ctx.fillText(
      `${isBn ? 'মন্তব্য:' : 'Notes:'} ${payment.notes.slice(0, 75)}`,
      64,
      y + 60
    );
  }

  // Footer & Signature
  const sigY = 1360;
  ctx.strokeStyle = '#94A3B8';
  ctx.beginPath();
  ctx.moveTo(64, sigY);
  ctx.lineTo(420, sigY);
  ctx.moveTo(780, sigY);
  ctx.lineTo(1136, sigY);
  ctx.stroke();

  ctx.fillStyle = '#0F172A';
  ctx.font = '600 20px "Plus Jakarta Sans", "Hind Siliguri", sans-serif';
  ctx.fillText(
    `${isBn ? 'আদায়কারী:' : 'Recorded By:'} ${payment.recordedByName}`,
    64,
    sigY + 36
  );

  ctx.textAlign = 'right';
  ctx.fillText(
    settings.ownerSignature || settings.ownerName || 'Authorized Signature',
    1136,
    sigY - 16
  );
  ctx.fillStyle = '#64748B';
  ctx.fillText(
    isBn ? 'বাড়িওয়ালার স্বাক্ষর (Owner Signature)' : 'Property Owner / Authorized Signature',
    1136,
    sigY + 36
  );
  ctx.textAlign = 'left';

  ctx.fillStyle = '#94A3B8';
  ctx.font = '400 16px "Plus Jakarta Sans", "Hind Siliguri", sans-serif';
  ctx.fillText(
    isBn
      ? 'BashaRent Manager অফলাইন লেজার দ্বারা প্রস্তুতকৃত। কোনো সংবেদনশীল এনআইডি তথ্য এই রসিদে যুক্ত করা হয়নি।'
      : 'Generated offline by BashaRent Manager. Sensitive NID & personal documents are strictly excluded.',
    64,
    1465
  );

  return canvas;
}

export async function downloadReceiptAsPng(
  ctxData: ReceiptRenderContext
): Promise<void> {
  const canvas = renderReceiptToCanvas(ctxData);
  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `Receipt_${ctxData.payment.receiptNumber}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function downloadReceiptAsPdf(
  ctxData: ReceiptRenderContext
): Promise<void> {
  const canvas = renderReceiptToCanvas(ctxData);
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = (canvas.height * pageWidth) / canvas.width;
  pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight);
  pdf.save(`Receipt_${ctxData.payment.receiptNumber}.pdf`);
}

export async function shareReceiptFile(
  ctxData: ReceiptRenderContext
): Promise<boolean> {
  const canvas = renderReceiptToCanvas(ctxData);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png')
  );
  if (!blob) return false;

  const file = new File([blob], `Receipt_${ctxData.payment.receiptNumber}.png`, {
    type: 'image/png',
  });

  if (
    typeof navigator !== 'undefined' &&
    navigator.canShare &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({
        title: `Receipt ${ctxData.payment.receiptNumber}`,
        text: `${ctxData.settings.appName}: Receipt #${ctxData.payment.receiptNumber} for ${ctxData.tenant.fullName} (${formatBDT(ctxData.payment.amountReceivedPoisha, ctxData.lang)})`,
        files: [file],
      });
      return true;
    } catch {
      return false;
    }
  }
  await downloadReceiptAsPng(ctxData);
  return true;
}
