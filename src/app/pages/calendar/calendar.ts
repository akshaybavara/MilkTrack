import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DbService } from '../../services/db.service';
import { Session, MilkRecord, AppSettings } from '../../models/milk-record.model';

export interface CalendarDay {
  date: number;
  dateStr: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  status: 'both' | 'partial' | 'absent' | 'none';
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calendar.html',
  styleUrl: './calendar.scss'
})
export class CalendarComponent implements OnInit {
  currentYear = signal<number>(new Date().getFullYear());
  currentMonth = signal<number>(new Date().getMonth()); // 0-indexed
  calendarDays = signal<CalendarDay[]>([]);
  monthLabel = signal<string>('');
  weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  selectedDate = signal<string | null>(null);
  selectedRecords = signal<MilkRecord[]>([]);
  settings = signal<AppSettings | null>(null);
  showDetail = signal<boolean>(false);

  // Restrict navigation to upcoming/future months
  isNextMonthDisabled = computed(() => {
    const today = new Date();
    const y = this.currentYear();
    const m = this.currentMonth();
    return y > today.getFullYear() || (y === today.getFullYear() && m >= today.getMonth());
  });

  hasMorning = computed(() => {
    return this.selectedRecords().some(r => r.session === 'Morning');
  });

  hasEvening = computed(() => {
    return this.selectedRecords().some(r => r.session === 'Evening');
  });

  isDayAllAbsent = computed(() => {
    const recs = this.selectedRecords();
    return recs.length > 0 && recs.every(r => r.isAbsent || r.quantity === 0);
  });

  dayTotalQuantity = computed(() => {
    return Math.round(this.selectedRecords().reduce((sum, r) => sum + r.quantity, 0) * 100) / 100;
  });

  dayTotalAmount = computed(() => {
    return Math.round(this.selectedRecords().reduce((sum, r) => sum + r.amount, 0) * 100) / 100;
  });

  constructor(private db: DbService, private router: Router) {}

  async ngOnInit() {
    const settings = await this.db.getSettings();
    this.settings.set(settings);
    await this.buildCalendar();
  }

  async buildCalendar() {
    const year = this.currentYear();
    const month = this.currentMonth();

    this.monthLabel.set(new Date(year, month).toLocaleDateString('en-IN', {
      month: 'long',
      year: 'numeric'
    }));

    // Get records map for this month
    const recordsMap = await this.db.getRecordsMapByMonth(year, month + 1);

    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth();
    const todayDate = today.getDate();
    const todayStr = `${todayYear}-${String(todayMonth + 1).padStart(2, '0')}-${String(todayDate).padStart(2, '0')}`;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Do not show upcoming dates: only show till today for current month
    let maxDay = daysInMonth;
    if (year === todayYear && month === todayMonth) {
      maxDay = todayDate;
    } else if (year > todayYear || (year === todayYear && month > todayMonth)) {
      maxDay = 0;
    }

    const days: CalendarDay[] = [];

    // Empty slots before first day
    for (let i = 0; i < firstDay; i++) {
      days.push({ date: 0, dateStr: '', isCurrentMonth: false, isToday: false, status: 'none' });
    }

    // Only generate dates up to today (do not show upcoming dates)
    for (let d = 1; d <= maxDay; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const recs = recordsMap.get(dateStr) || [];
      let status: 'both' | 'partial' | 'absent' | 'none' = 'none';

      if (recs.length === 0) {
        status = 'none';
      } else if (recs.every(r => r.isAbsent || r.quantity === 0)) {
        status = 'absent';
      } else if (recs.length >= 2) {
        status = 'both';
      } else {
        status = 'partial';
      }

      days.push({
        date: d,
        dateStr,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        status
      });
    }

    this.calendarDays.set(days);
  }

  async prevMonth() {
    let m = this.currentMonth();
    let y = this.currentYear();
    if (m === 0) {
      m = 11;
      y--;
    } else {
      m--;
    }
    this.currentMonth.set(m);
    this.currentYear.set(y);
    await this.buildCalendar();
  }

  async nextMonth() {
    if (this.isNextMonthDisabled()) return;

    let m = this.currentMonth();
    let y = this.currentYear();
    if (m === 11) {
      m = 0;
      y++;
    } else {
      m++;
    }
    this.currentMonth.set(m);
    this.currentYear.set(y);
    await this.buildCalendar();
  }

  async selectDay(day: CalendarDay) {
    if (!day.isCurrentMonth || day.date === 0) return;
    this.selectedDate.set(day.dateStr);
    await this.loadDayRecords(day.dateStr);
    this.showDetail.set(true);
  }

  async loadDayRecords(dateStr: string) {
    const records = await this.db.getRecordsByDate(dateStr);
    this.selectedRecords.set(records);
  }

  closeDetail() {
    this.showDetail.set(false);
  }

  addForDate(session: Session) {
    this.router.navigate(['/add'], {
      queryParams: { date: this.selectedDate(), session }
    });
  }

  async markSessionAbsent(session: Session) {
    const d = this.selectedDate();
    if (!d) return;
    await this.db.markAbsent(d, session, 'Absent');
    await this.loadDayRecords(d);
    await this.buildCalendar();
  }

  async markDayAbsent() {
    const d = this.selectedDate();
    if (!d) return;
    await this.db.markDayAbsent(d, 'Absent');
    await this.loadDayRecords(d);
    await this.buildCalendar();
  }

  async deleteRecord(record: MilkRecord) {
    if (!record.id) return;
    await this.db.deleteRecord(record.id);
    const d = this.selectedDate();
    if (d) {
      await this.loadDayRecords(d);
    }
    await this.buildCalendar();
  }

  editRecord(record: MilkRecord) {
    this.router.navigate(['/add'], {
      queryParams: { editId: record.id }
    });
  }

  formatSelectedDate(): string {
    const d = this.selectedDate();
    if (!d) return '';
    const date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }
}
