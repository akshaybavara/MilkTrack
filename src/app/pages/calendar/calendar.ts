import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DbService } from '../../services/db.service';
import { Session, MilkRecord, AppSettings } from '../../models/milk-record.model';

interface CalendarDay {
  date: number;
  dateStr: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  status: 'both' | 'partial' | 'none';
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

  hasMorning = computed(() => {
    return this.selectedRecords().some(r => r.session === 'Morning');
  });

  hasEvening = computed(() => {
    return this.selectedRecords().some(r => r.session === 'Evening');
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

    // Get recorded dates map
    const recordedDates = await this.db.getRecordedDatesForMonth(year, month + 1);

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: CalendarDay[] = [];

    // Empty slots before first day
    for (let i = 0; i < firstDay; i++) {
      days.push({ date: 0, dateStr: '', isCurrentMonth: false, isToday: false, status: 'none' });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const sessions = recordedDates.get(dateStr) || [];
      let status: 'both' | 'partial' | 'none' = 'none';
      if (sessions.length >= 2) {
        status = 'both';
      } else if (sessions.length === 1) {
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
    const records = await this.db.getRecordsByDate(day.dateStr);
    this.selectedRecords.set(records);
    this.showDetail.set(true);
  }

  closeDetail() {
    this.showDetail.set(false);
  }

  addForDate(session: Session) {
    this.router.navigate(['/add'], {
      queryParams: { date: this.selectedDate(), session }
    });
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
