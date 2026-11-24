import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DbService } from '../../services/db.service';
import { AppSettings, MonthlySummary, MilkRecord } from '../../models/milk-record.model';
import { PdfReportService, DayReportItem, MonthlyReportData } from '../../services/pdf-report.service';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reports.html',
  styleUrl: './reports.scss'
})
export class ReportsComponent implements OnInit {
  currentYear = signal<number>(new Date().getFullYear());
  currentMonth = signal<number>(new Date().getMonth() + 1); // 1-indexed
  settings = signal<AppSettings | null>(null);
  summary = signal<MonthlySummary | null>(null);
  monthLabel = signal<string>('');
  dayItems = signal<DayReportItem[]>([]);

  // Toast feedback
  showToast = signal(false);
  toastMessage = signal('');

  // Disallow navigating past current month
  isNextMonthDisabled = computed(() => {
    const today = new Date();
    return this.currentYear() > today.getFullYear() ||
      (this.currentYear() === today.getFullYear() && this.currentMonth() >= today.getMonth() + 1);
  });

  constructor(
    private db: DbService,
    private pdfService: PdfReportService
  ) {}

  async ngOnInit() {
    const settings = await this.db.getSettings();
    this.settings.set(settings);
    await this.loadSummary();
  }

  async loadSummary() {
    const year = this.currentYear();
    const month = this.currentMonth();

    this.monthLabel.set(new Date(year, month - 1).toLocaleDateString('en-IN', {
      month: 'long',
      year: 'numeric'
    }));

    const records = await this.db.getRecordsByMonth(year, month);
    const settings = this.settings() || { defaultRate: 60, currency: 'INR', currencySymbol: '₹', unit: 'Litre' };

    const morningRecs = records.filter(r => r.session === 'Morning');
    const eveningRecs = records.filter(r => r.session === 'Evening');

    const totalQuantity = this.round(records.reduce((sum, r) => sum + r.quantity, 0));
    const totalAmount = this.round(records.reduce((sum, r) => sum + r.amount, 0));
    const morningQuantity = this.round(morningRecs.reduce((sum, r) => sum + r.quantity, 0));
    const eveningQuantity = this.round(eveningRecs.reduce((sum, r) => sum + r.quantity, 0));

    // Group records by day
    const recordsByDay = new Map<string, MilkRecord[]>();
    for (const r of records) {
      const list = recordsByDay.get(r.date) || [];
      list.push(r);
      recordsByDay.set(r.date, list);
    }

    const daysInMonth = new Date(year, month, 0).getDate();
    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth() + 1;
    const todayDate = today.getDate();

    // If current month, we track days up to today (or entire month)
    let maxDaysToReport = daysInMonth;
    if (year === todayYear && month === todayMonth) {
      maxDaysToReport = todayDate;
    }

    const dayItemsList: DayReportItem[] = [];
    let deliveredDaysCount = 0;
    let absentDaysCount = 0;

    for (let d = 1; d <= maxDaysToReport; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayDate = new Date(year, month - 1, d);
      const dayOfWeek = dayDate.toLocaleDateString('en-IN', { weekday: 'short' });
      const formattedDate = dayDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

      const dayRecs = recordsByDay.get(dateStr) || [];
      const mRec = dayRecs.find(r => r.session === 'Morning');
      const eRec = dayRecs.find(r => r.session === 'Evening');

      const mQty = (mRec && !mRec.isAbsent) ? mRec.quantity : 0;
      const eQty = (eRec && !eRec.isAbsent) ? eRec.quantity : 0;
      const dayQty = this.round(mQty + eQty);
      const dayAmt = this.round((mRec?.amount || 0) + (eRec?.amount || 0));
      const rate = mRec?.ratePerLitre || eRec?.ratePerLitre || settings.defaultRate || 60;

      const isMarkedAbsent = dayRecs.length > 0 && dayRecs.every(r => r.isAbsent || r.quantity === 0);

      let statusText = 'Not Added';
      if (isMarkedAbsent) {
        statusText = 'Absent';
        absentDaysCount++;
      } else if (dayQty > 0) {
        deliveredDaysCount++;
        if (mRec?.isAbsent && eQty > 0) {
          statusText = 'M: Absent';
        } else if (eRec?.isAbsent && mQty > 0) {
          statusText = 'E: Absent';
        } else if (mRec && eRec) {
          statusText = 'Delivered';
        } else if (mRec) {
          statusText = 'Morning Only';
        } else if (eRec) {
          statusText = 'Evening Only';
        }
      }

      dayItemsList.push({
        dayNum: d,
        dateStr,
        formattedDate,
        dayOfWeek,
        morning: mRec,
        evening: eRec,
        totalQuantity: dayQty,
        rate,
        totalAmount: dayAmt,
        isAbsent: isMarkedAbsent,
        statusText
      });
    }

    this.dayItems.set(dayItemsList);

    // Days recorded: unique days with any record
    const recordedDays = recordsByDay.size;
    const averagePerDay = maxDaysToReport > 0 ? this.round(totalQuantity / maxDaysToReport) : 0;
    const averageDailyCost = maxDaysToReport > 0 ? this.round(totalAmount / maxDaysToReport) : 0;

    this.summary.set({
      month,
      year,
      totalQuantity,
      totalAmount,
      morningQuantity,
      eveningQuantity,
      totalDays: maxDaysToReport,
      recordedDays,
      absentDays: absentDaysCount,
      deliveredDays: deliveredDaysCount,
      averagePerDay,
      averageDailyCost
    });
  }

  async prevMonth() {
    let m = this.currentMonth();
    let y = this.currentYear();
    if (m === 1) {
      m = 12;
      y--;
    } else {
      m--;
    }
    this.currentMonth.set(m);
    this.currentYear.set(y);
    await this.loadSummary();
  }

  async nextMonth() {
    if (this.isNextMonthDisabled()) return;

    let m = this.currentMonth();
    let y = this.currentYear();
    if (m === 12) {
      m = 1;
      y++;
    } else {
      m++;
    }
    this.currentMonth.set(m);
    this.currentYear.set(y);
    await this.loadSummary();
  }

  /**
   * Generates and downloads complete month report as PDF.
   */
  downloadPdf() {
    const s = this.summary();
    const settings = this.settings() || { defaultRate: 60, currency: 'INR', currencySymbol: '₹', unit: 'Litre' };
    if (!s) return;

    const reportData: MonthlyReportData = {
      month: s.month,
      year: s.year,
      monthName: this.monthLabel(),
      settings,
      summary: s,
      days: this.dayItems()
    };

    this.pdfService.downloadMonthlyPdf(reportData);
    this.triggerToast('📄 PDF Report downloaded successfully!');
  }

  /**
   * Builds formatted report message and opens WhatsApp.
   */
  async shareWhatsApp() {
    const s = this.summary();
    const settings = this.settings() || { defaultRate: 60, currency: 'INR', currencySymbol: '₹', unit: 'Litre' };
    if (!s) return;

    const sym = settings.currencySymbol || '₹';
    const lines: string[] = [
      `🥛 *MILKTRACK - MONTHLY STATEMENT*`,
      `📅 *${this.monthLabel()}*`,
      `───────────────────────`,
      `📊 *MONTHLY SUMMARY:*`,
      `• Total Milk: *${s.totalQuantity} L*`,
      `• Total Amount: *${sym}${s.totalAmount.toLocaleString('en-IN')}*`,
      `• Morning Milk: ${s.morningQuantity} L`,
      `• Evening Milk: ${s.eveningQuantity} L`,
      `• Active Days: ${s.deliveredDays} / ${s.totalDays}`,
      `• Absent Days: ${s.absentDays} days`,
      `• Rate: ${sym}${settings.defaultRate || 60} / L`,
      `───────────────────────`,
      `📋 *DAILY DETAILS:*`
    ];

    for (const item of this.dayItems()) {
      if (item.isAbsent) {
        lines.push(`• ${item.formattedDate} (${item.dayOfWeek}): 🚫 *Absent*`);
      } else if (item.totalQuantity > 0) {
        const parts = [];
        if (item.morning && item.morning.quantity > 0) parts.push(`🌅 ${item.morning.quantity}L`);
        if (item.evening && item.evening.quantity > 0) parts.push(`🌆 ${item.evening.quantity}L`);
        const sessionStr = parts.join(' + ');
        lines.push(`• ${item.formattedDate} (${item.dayOfWeek}): ${sessionStr} = *${item.totalQuantity}L* (${sym}${item.totalAmount})`);
      }
    }

    lines.push(`───────────────────────`);
    lines.push(`💵 *TOTAL PAYABLE: ${sym}${s.totalAmount.toLocaleString('en-IN')}*`);
    lines.push(`Generated via MilkTrack 🥛`);

    const text = lines.join('\n');

    // Try Web Share API first (on mobile devices)
    if (navigator.share) {
      try {
        await navigator.share({
          title: `MilkTrack Report - ${this.monthLabel()}`,
          text
        });
        this.triggerToast('Shared successfully!');
        return;
      } catch (err) {
        // User cancelled or fallback to direct WhatsApp URL
      }
    }

    // Direct WhatsApp share URL
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank');
    this.triggerToast('Opening WhatsApp...');
  }

  /**
   * Copies formatted text to clipboard.
   */
  async copyReportText() {
    const s = this.summary();
    const settings = this.settings() || { defaultRate: 60, currency: 'INR', currencySymbol: '₹', unit: 'Litre' };
    if (!s) return;

    const sym = settings.currencySymbol || '₹';
    const lines: string[] = [
      `🥛 MILKTRACK - MONTHLY STATEMENT`,
      `Month: ${this.monthLabel()}`,
      `---------------------------------`,
      `Total Milk: ${s.totalQuantity} L`,
      `Total Cost: ${sym}${s.totalAmount.toLocaleString('en-IN')}`,
      `Morning: ${s.morningQuantity} L | Evening: ${s.eveningQuantity} L`,
      `Delivered Days: ${s.deliveredDays} | Absent Days: ${s.absentDays}`,
      `---------------------------------`,
      `Daily Breakdown:`
    ];

    for (const item of this.dayItems()) {
      if (item.isAbsent) {
        lines.push(`${item.formattedDate} (${item.dayOfWeek}): Absent`);
      } else if (item.totalQuantity > 0) {
        lines.push(`${item.formattedDate} (${item.dayOfWeek}): ${item.totalQuantity}L = ${sym}${item.totalAmount}`);
      }
    }

    lines.push(`---------------------------------`);
    lines.push(`Grand Total: ${sym}${s.totalAmount.toLocaleString('en-IN')}`);

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      this.triggerToast('📋 Report copied to clipboard!');
    } catch (e) {
      this.triggerToast('Failed to copy report text.');
    }
  }

  /**
   * System Print for the monthly statement.
   */
  printReport() {
    window.print();
  }

  private triggerToast(msg: string) {
    this.toastMessage.set(msg);
    this.showToast.set(true);
    setTimeout(() => this.showToast.set(false), 2500);
  }

  private round(n: number): number {
    return Math.round(n * 100) / 100;
  }
}
