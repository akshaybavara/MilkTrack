import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DbService } from '../../services/db.service';
import { MilkRecord, AppSettings, Session } from '../../models/milk-record.model';
import { QuoteService } from '../../services/quote.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class DashboardComponent implements OnInit {
  today = signal('');
  todayFormatted = signal('');
  morningRecord = signal<MilkRecord | null>(null);
  eveningRecord = signal<MilkRecord | null>(null);
  settings = signal<AppSettings | null>(null);

  totalQuantity = computed(() => {
    const m = this.morningRecord();
    const e = this.eveningRecord();
    return this.round((m?.quantity || 0) + (e?.quantity || 0));
  });

  totalAmount = computed(() => {
    const m = this.morningRecord();
    const e = this.eveningRecord();
    return this.round((m?.amount || 0) + (e?.amount || 0));
  });

  isDayAllAbsent = computed(() => {
    const m = this.morningRecord();
    const e = this.eveningRecord();
    if (!m && !e) return false;
    const mAbsent = !m || m.isAbsent || m.quantity === 0;
    const eAbsent = !e || e.isAbsent || e.quantity === 0;
    return mAbsent && eAbsent && (!!m || !!e);
  });

  constructor(
    private db: DbService,
    private router: Router,
    public quoteService: QuoteService
  ) {}

  async ngOnInit() {
    const now = new Date();
    const dateStr = this.formatDateKey(now);
    this.today.set(dateStr);
    this.todayFormatted.set(this.formatDateDisplay(now));

    // Initialize daily quote (fetches fresh online if connected to internet, or loads cached/offline)
    await this.quoteService.initDailyQuote();

    await this.loadData();
  }

  async loadData() {
    const settings = await this.db.getSettings();
    this.settings.set(settings);

    const records = await this.db.getRecordsByDate(this.today());
    const morning = records.find(r => r.session === 'Morning') || null;
    const evening = records.find(r => r.session === 'Evening') || null;
    this.morningRecord.set(morning);
    this.eveningRecord.set(evening);
  }

  addMilk(session?: Session) {
    if (session) {
      this.router.navigate(['/add'], { queryParams: { session } });
    } else {
      this.router.navigate(['/add']);
    }
  }

  async markAbsent(session: Session) {
    await this.db.markAbsent(this.today(), session, 'Absent');
    await this.loadData();
  }

  editRecord(record: MilkRecord) {
    this.router.navigate(['/add'], { queryParams: { editId: record.id } });
  }

  private formatDateKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private formatDateDisplay(d: Date): string {
    return d.toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  private round(n: number): number {
    return Math.round(n * 100) / 100;
  }
}
