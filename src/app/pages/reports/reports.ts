import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DbService } from '../../services/db.service';
import { AppSettings, MonthlySummary } from '../../models/milk-record.model';

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

  constructor(private db: DbService) {}

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

    const morningRecs = records.filter(r => r.session === 'Morning');
    const eveningRecs = records.filter(r => r.session === 'Evening');

    const totalQuantity = this.round(records.reduce((sum, r) => sum + r.quantity, 0));
    const totalAmount = this.round(records.reduce((sum, r) => sum + r.amount, 0));
    const morningQuantity = this.round(morningRecs.reduce((sum, r) => sum + r.quantity, 0));
    const eveningQuantity = this.round(eveningRecs.reduce((sum, r) => sum + r.quantity, 0));

    // Unique days recorded
    const uniqueDays = new Set(records.map(r => r.date));
    const recordedDays = uniqueDays.size;
    const daysInMonth = new Date(year, month, 0).getDate();

    // Average per day over the calendar month (e.g. 152.5 / 30 = 5.08 L; 9150 / 30 = 305)
    const averagePerDay = daysInMonth > 0 ? this.round(totalQuantity / daysInMonth) : 0;
    const averageDailyCost = daysInMonth > 0 ? this.round(totalAmount / daysInMonth) : 0;

    this.summary.set({
      month,
      year,
      totalQuantity,
      totalAmount,
      morningQuantity,
      eveningQuantity,
      totalDays: daysInMonth,
      recordedDays,
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

  private round(n: number): number {
    return Math.round(n * 100) / 100;
  }
}
