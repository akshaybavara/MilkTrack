import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DbService } from '../../services/db.service';
import { MilkRecord, AppSettings, DaySummary, Session } from '../../models/milk-record.model';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './history.html',
  styleUrl: './history.scss'
})
export class HistoryComponent implements OnInit {
  days = signal<DaySummary[]>([]);
  settings = signal<AppSettings | null>(null);

  showDeleteDialog = signal(false);
  deleteTarget = signal<MilkRecord | null>(null);

  constructor(private db: DbService, private router: Router) {}

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    const settings = await this.db.getSettings();
    this.settings.set(settings);

    const records = await this.db.getAllRecords();
    // Group by date
    const dateMap = new Map<string, MilkRecord[]>();
    for (const r of records) {
      const list = dateMap.get(r.date) || [];
      list.push(r);
      dateMap.set(r.date, list);
    }

    // Build summaries sorted by date descending
    const summaries: DaySummary[] = [];
    const dates = Array.from(dateMap.keys()).sort((a, b) => b.localeCompare(a));
    for (const date of dates) {
      const recs = dateMap.get(date)!;
      const morning = recs.find(r => r.session === 'Morning');
      const evening = recs.find(r => r.session === 'Evening');
      summaries.push({
        date,
        morning,
        evening,
        totalQuantity: Math.round(((morning?.quantity || 0) + (evening?.quantity || 0)) * 100) / 100,
        totalAmount: Math.round(((morning?.amount || 0) + (evening?.amount || 0)) * 100) / 100
      });
    }
    this.days.set(summaries);
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  editRecord(record: MilkRecord) {
    this.router.navigate(['/add'], {
      queryParams: { editId: record.id }
    });
  }

  addMissingSession(date: string, session: Session) {
    this.router.navigate(['/add'], {
      queryParams: { date, session }
    });
  }

  confirmDelete(record: MilkRecord) {
    this.deleteTarget.set(record);
    this.showDeleteDialog.set(true);
  }

  async doDelete() {
    const record = this.deleteTarget();
    if (record?.id) {
      await this.db.deleteRecord(record.id);
      this.showDeleteDialog.set(false);
      this.deleteTarget.set(null);
      await this.loadData();
    }
  }

  cancelDelete() {
    this.showDeleteDialog.set(false);
    this.deleteTarget.set(null);
  }
}
