import { Injectable } from '@angular/core';
import { MilkRecord, AppSettings, MonthlySummary } from '../models/milk-record.model';

export interface DayReportItem {
  dayNum: number;
  dateStr: string;
  formattedDate: string;
  dayOfWeek: string;
  morning?: MilkRecord;
  evening?: MilkRecord;
  totalQuantity: number;
  rate: number;
  totalAmount: number;
  isAbsent: boolean;
  statusText: string;
}

export interface MonthlyReportData {
  month: number;
  year: number;
  monthName: string;
  settings: AppSettings;
  summary: MonthlySummary;
  days: DayReportItem[];
}

@Injectable({ providedIn: 'root' })
export class PdfReportService {

  /**
   * Generates a complete month report PDF and triggers browser download.
   */
  downloadMonthlyPdf(data: MonthlyReportData) {
    const pdfBytes = this.buildPdf(data);
    const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const filename = `MilkTrack_Report_${dd}_${mm}_${yyyy}.pdf`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /**
   * Builds valid PDF 1.4 binary Uint8Array.
   */
  buildPdf(data: MonthlyReportData): Uint8Array {
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const margin = 36;
    const contentWidth = pageWidth - margin * 2; // 523.28 pt

    // Currency representation for PDF Type 1 Helvetica font
    const currSym = data.settings.currency === 'INR' || data.settings.currencySymbol === '₹' ? 'Rs. ' : (data.settings.currencySymbol || '$ ');

    // Commands array for content stream
    const streamOps: string[] = [];

    // Helper: draw rectangle
    const drawRect = (x: number, y: number, w: number, h: number, r: number, g: number, b: number, fill = true, stroke = false) => {
      streamOps.push(`q ${r} ${g} ${b} ${fill ? 'rg' : 'RG'} ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re ${fill && stroke ? 'b' : fill ? 'f' : 's'} Q`);
    };

    // Helper: draw line
    const drawLine = (x1: number, y1: number, x2: number, y2: number, r = 0.8, g = 0.85, b = 0.9, lineWidth = 0.5) => {
      streamOps.push(`q ${lineWidth} w ${r} ${g} ${b} RG ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S Q`);
    };

    // Helper: escape text for PDF syntax
    const escapePdf = (text: string) => {
      return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    };

    // Helper: draw text
    const drawText = (text: string, x: number, y: number, font = '/F1', size = 10, r = 0.1, g = 0.15, b = 0.2) => {
      const escaped = escapePdf(text);
      streamOps.push(`BT ${r} ${g} ${b} rg ${font} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${escaped}) Tj ET`);
    };

    // ─── Header Banner ──────────────────────────
    // Blue top brand banner
    drawRect(margin, pageHeight - margin - 46, contentWidth, 46, 0.12, 0.35, 0.85);
    drawText('MILKTRACK - MONTHLY MILK STATEMENT', margin + 14, pageHeight - margin - 24, '/F2', 15, 1, 1, 1);
    drawText('Daily Milk Delivery Record & Bill Summary', margin + 14, pageHeight - margin - 38, '/F1', 9, 0.85, 0.92, 1);

    // Month & Year badge on top right (ensure year is only shown once)
    const displayPeriod = data.monthName.includes(String(data.year))
      ? data.monthName
      : `${data.monthName} ${data.year}`;
    drawText(displayPeriod, pageWidth - margin - 150, pageHeight - margin - 22, '/F2', 13, 1, 1, 1);
    const genDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    drawText(`Generated: ${genDate}`, pageWidth - margin - 150, pageHeight - margin - 37, '/F1', 8.5, 0.85, 0.92, 1);

    // ─── Summary Card Box ───────────────────────
    const summaryY = pageHeight - margin - 105;
    drawRect(margin, summaryY, contentWidth, 52, 0.95, 0.97, 1); // background light box
    drawRect(margin, summaryY, contentWidth, 52, 0.75, 0.85, 0.98, false, true); // border

    // Row 1 metrics
    drawText('TOTAL MILK:', margin + 12, summaryY + 36, '/F2', 9, 0.15, 0.25, 0.5);
    drawText(`${data.summary.totalQuantity.toFixed(2)} Litres`, margin + 80, summaryY + 36, '/F2', 10, 0.05, 0.3, 0.8);

    drawText('TOTAL AMOUNT:', margin + 195, summaryY + 36, '/F2', 9, 0.15, 0.25, 0.5);
    drawText(`${currSym}${data.summary.totalAmount.toLocaleString('en-IN')}`, margin + 275, summaryY + 36, '/F2', 11, 0.1, 0.55, 0.25);

    drawText('DEFAULT RATE:', margin + 395, summaryY + 36, '/F2', 9, 0.15, 0.25, 0.5);
    drawText(`${currSym}${data.settings.defaultRate} / L`, margin + 465, summaryY + 36, '/F1', 9.5, 0.1, 0.2, 0.4);

    // Row 2 metrics
    drawText(`Morning: ${data.summary.morningQuantity.toFixed(1)} L`, margin + 12, summaryY + 16, '/F1', 8.5, 0.3, 0.4, 0.5);
    drawText(`Evening: ${data.summary.eveningQuantity.toFixed(1)} L`, margin + 110, summaryY + 16, '/F1', 8.5, 0.3, 0.4, 0.5);
    drawText(`Delivered: ${data.summary.deliveredDays} Days`, margin + 205, summaryY + 16, '/F1', 8.5, 0.1, 0.5, 0.2);
    drawText(`Absent: ${data.summary.absentDays} Days`, margin + 305, summaryY + 16, '/F1', 8.5, 0.8, 0.2, 0.2);
    drawText(`Daily Avg: ${data.summary.averagePerDay.toFixed(2)} L`, margin + 395, summaryY + 16, '/F1', 8.5, 0.3, 0.4, 0.5);

    // ─── Table Header ───────────────────────────
    const tableTop = summaryY - 14;
    const headerHeight = 18;
    drawRect(margin, tableTop - headerHeight, contentWidth, headerHeight, 0.15, 0.25, 0.45);

    // Column coordinates
    // Col 1: Date (0 to 65) -> margin + 6
    // Col 2: Day (65 to 110) -> margin + 70
    // Col 3: Morning (110 to 180) -> margin + 115
    // Col 4: Evening (180 to 250) -> margin + 185
    // Col 5: Total Qty (250 to 325) -> margin + 255
    // Col 6: Rate (325 to 390) -> margin + 330
    // Col 7: Amount (390 to 460) -> margin + 395
    // Col 8: Status (460 to 523) -> margin + 465

    drawText('Date', margin + 6, tableTop - headerHeight + 5, '/F2', 8.5, 1, 1, 1);
    drawText('Day', margin + 70, tableTop - headerHeight + 5, '/F2', 8.5, 1, 1, 1);
    drawText('Morning', margin + 112, tableTop - headerHeight + 5, '/F2', 8.5, 1, 1, 1);
    drawText('Evening', margin + 182, tableTop - headerHeight + 5, '/F2', 8.5, 1, 1, 1);
    drawText('Total Milk', margin + 252, tableTop - headerHeight + 5, '/F2', 8.5, 1, 1, 1);
    drawText('Rate', margin + 330, tableTop - headerHeight + 5, '/F2', 8.5, 1, 1, 1);
    drawText('Amount', margin + 395, tableTop - headerHeight + 5, '/F2', 8.5, 1, 1, 1);
    drawText('Status', margin + 465, tableTop - headerHeight + 5, '/F2', 8.5, 1, 1, 1);

    // ─── Day-by-Day Table Rows ───────────────────
    let currentY = tableTop - headerHeight;
    // Calculate row height to fit comfortably
    const rowHeight = data.days.length > 28 ? 14.5 : 15.5;

    for (let i = 0; i < data.days.length; i++) {
      const item = data.days[i];
      currentY -= rowHeight;

      // Background alternating colors
      if (item.isAbsent) {
        drawRect(margin, currentY, contentWidth, rowHeight, 1, 0.94, 0.94); // light red for absent
      } else if (i % 2 === 0) {
        drawRect(margin, currentY, contentWidth, rowHeight, 0.97, 0.98, 0.99); // slight off-white
      }

      // Thin bottom line
      drawLine(margin, currentY, margin + contentWidth, currentY, 0.9, 0.92, 0.94, 0.3);

      const yText = currentY + 4;
      const font = item.isAbsent ? '/F2' : '/F1';
      const textColor = item.isAbsent ? [0.8, 0.15, 0.15] : [0.15, 0.2, 0.25];

      // Date
      drawText(item.formattedDate, margin + 6, yText, font, 7.5, textColor[0], textColor[1], textColor[2]);

      // Day of week
      drawText(item.dayOfWeek, margin + 70, yText, '/F1', 7.5, 0.4, 0.45, 0.5);

      // Morning
      if (item.morning) {
        const mText = item.morning.isAbsent || item.morning.quantity === 0 ? 'Absent' : `${item.morning.quantity.toFixed(1)} L`;
        drawText(mText, margin + 112, yText, font, 7.5, ...textColor);
      } else {
        drawText('-', margin + 112, yText, '/F1', 7.5, 0.6, 0.6, 0.6);
      }

      // Evening
      if (item.evening) {
        const eText = item.evening.isAbsent || item.evening.quantity === 0 ? 'Absent' : `${item.evening.quantity.toFixed(1)} L`;
        drawText(eText, margin + 182, yText, font, 7.5, ...textColor);
      } else {
        drawText('-', margin + 182, yText, '/F1', 7.5, 0.6, 0.6, 0.6);
      }

      // Total Quantity
      const totalQtyText = item.isAbsent ? '0 L' : (item.totalQuantity > 0 ? `${item.totalQuantity.toFixed(2)} L` : '-');
      drawText(totalQtyText, margin + 252, yText, item.totalQuantity > 0 ? '/F2' : '/F1', 7.5, ...textColor);

      // Rate
      const rateText = item.rate > 0 ? `${currSym}${item.rate}` : '-';
      drawText(rateText, margin + 330, yText, '/F1', 7.5, 0.4, 0.45, 0.5);

      // Total Amount
      const amtText = item.totalAmount > 0 ? `${currSym}${item.totalAmount.toFixed(1)}` : (item.isAbsent ? `${currSym}0` : '-');
      drawText(amtText, margin + 395, yText, item.totalAmount > 0 ? '/F2' : '/F1', 7.5, item.totalAmount > 0 ? 0.08 : textColor[0], item.totalAmount > 0 ? 0.5 : textColor[1], item.totalAmount > 0 ? 0.2 : textColor[2]);

      // Status
      drawText(item.statusText, margin + 465, yText, item.isAbsent ? '/F2' : '/F1', 7.5, ...textColor);
    }

    // ─── Grand Totals Row ───────────────────────
    currentY -= 20;
    drawRect(margin, currentY, contentWidth, 20, 0.92, 0.95, 0.99);
    drawRect(margin, currentY, contentWidth, 20, 0.3, 0.45, 0.7, false, true); // border

    drawText('GRAND TOTAL', margin + 12, currentY + 6, '/F2', 9, 0.1, 0.2, 0.5);
    drawText(`${data.summary.totalQuantity.toFixed(2)} Litres`, margin + 252, currentY + 6, '/F2', 9, 0.05, 0.3, 0.8);
    drawText(`${currSym}${data.summary.totalAmount.toLocaleString('en-IN')}`, margin + 395, currentY + 6, '/F2', 10, 0.08, 0.55, 0.2);

    // ─── Signature Block ────────────────────────
    const sigY = currentY - 38;
    drawLine(margin + 10, sigY + 12, margin + 180, sigY + 12, 0.5, 0.5, 0.5, 0.8);
    drawText('Customer / Household Signature', margin + 10, sigY, '/F1', 8, 0.4, 0.45, 0.5);

    drawLine(pageWidth - margin - 180, sigY + 12, pageWidth - margin - 10, sigY + 12, 0.5, 0.5, 0.5, 0.8);
    drawText('Milkman / Dairy Vendor Signature', pageWidth - margin - 180, sigY, '/F1', 8, 0.4, 0.45, 0.5);

    // ─── Footer ─────────────────────────────────
    const footerY = margin + 10;
    drawLine(margin, footerY + 12, margin + contentWidth, footerY + 12, 0.85, 0.88, 0.92, 0.5);
    drawText('Developed by Akshay Kumar', margin, footerY, '/F2', 8, 0.15, 0.25, 0.5);
    drawText('MilkTrack • Daily Milk Tracking System', margin + 140, footerY, '/F1', 7.5, 0.5, 0.55, 0.6);
    drawText(`Page 1 of 1 • ${displayPeriod}`, pageWidth - margin - 100, footerY, '/F1', 7.5, 0.5, 0.55, 0.6);

    // Assemble the PDF document
    const contentStream = streamOps.join('\n');
    return this.compilePdfString(contentStream, pageWidth, pageHeight);
  }

  /**
   * Compiles the PDF binary structure.
   */
  private compilePdfString(contentStream: string, width: number, height: number): Uint8Array {
    const objects: string[] = [];
    const addObject = (content: string) => {
      objects.push(content);
      return objects.length;
    };

    // 1: Catalog
    addObject('<< /Type /Catalog /Pages 2 0 R >>');
    // 2: Pages (placeholder, updated later)
    addObject('');
    // 3: Font Helvetica Regular
    addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    // 4: Font Helvetica Bold
    addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

    // 5: Content stream
    const streamLen = new TextEncoder().encode(contentStream).length;
    const streamObjIdx = addObject(`<< /Length ${streamLen} >>\nstream\n${contentStream}\nendstream`);

    // 6: Page object
    const pageObjIdx = addObject(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width.toFixed(2)} ${height.toFixed(2)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${streamObjIdx} 0 R >>`);

    // Update Pages object (index 2)
    objects[1] = `<< /Type /Pages /Kids [${pageObjIdx} 0 R] /Count 1 >>`;

    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [];

    const encoder = new TextEncoder();
    let byteLength = encoder.encode(pdf).length;

    for (let i = 0; i < objects.length; i++) {
      offsets.push(byteLength);
      const objStr = `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
      pdf += objStr;
      byteLength += encoder.encode(objStr).length;
    }

    const xrefOffset = byteLength;
    let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const offset of offsets) {
      xref += `${String(offset).padStart(10, '0')} 00000 n \n`;
    }
    const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    pdf += xref + trailer;
    return encoder.encode(pdf);
  }
}
