import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { DbService } from '../../services/db.service';
import { MilkRecord, Session, AppSettings } from '../../models/milk-record.model';

@Component({
  selector: 'app-add-record',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './add-record.html',
  styleUrl: './add-record.scss'
})
export class AddRecordComponent implements OnInit {
  date = signal<string>('');
  todayStr = signal<string>('');
  session = signal<Session | ''>('');
  quantity = signal<number | null>(null);
  rate = signal<number>(60);
  notes = signal<string>('');
  settings = signal<AppSettings | null>(null);
  isAbsent = signal<boolean>(false);

  // Quick quantities including 0.25 L
  quickQuantities = [0.25, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4];

  amount = computed(() => {
    if (this.isAbsent()) return 0;
    const q = this.quantity();
    const r = this.rate();
    if (q !== null && q > 0 && r > 0) {
      return Math.round(q * r * 100) / 100;
    }
    return 0;
  });

  // Editing mode
  editingRecord = signal<MilkRecord | null>(null);
  isEditing = computed(() => this.editingRecord() !== null);

  // Duplicate dialog
  showDuplicateDialog = signal(false);
  duplicateRecord = signal<MilkRecord | null>(null);

  // Success toast
  showSuccess = signal(false);
  successMessage = signal('');

  constructor(
    private db: DbService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  async ngOnInit() {
    const settings = await this.db.getSettings();
    this.settings.set(settings);
    this.rate.set(settings.defaultRate || 60);

    // Set default date to today and max date to today
    const now = new Date();
    const todayFormatted = this.formatDateKey(now);
    this.todayStr.set(todayFormatted);
    this.date.set(todayFormatted);

    // Handle query params
    this.route.queryParams.subscribe(async params => {
      if (params['session']) {
        this.session.set(params['session'] as Session);
      }
      if (params['date']) {
        this.date.set(params['date']);
      }
      if (params['absent'] === 'true') {
        this.isAbsent.set(true);
        this.quantity.set(0);
        this.notes.set('Absent');
      }
      if (params['editId']) {
        await this.loadRecordForEdit(Number(params['editId']));
      }
    });
  }

  async loadRecordForEdit(id: number) {
    const records = await this.db.getAllRecords();
    const record = records.find(r => r.id === id);
    if (record) {
      this.editingRecord.set(record);
      this.date.set(record.date);
      this.session.set(record.session);
      this.rate.set(record.ratePerLitre);
      this.notes.set(record.notes || '');

      const isAbs = !!(record.isAbsent || record.quantity === 0);
      this.isAbsent.set(isAbs);
      this.quantity.set(isAbs ? 0 : record.quantity);
    }
  }

  selectSession(s: Session) {
    this.session.set(s);
  }

  setQuickQuantity(q: number) {
    this.isAbsent.set(false);
    this.quantity.set(q);
  }

  addExtraQuantity(extra = 0.25) {
    this.isAbsent.set(false);
    const curr = this.quantity() || 0;
    const updated = Math.round((curr + extra) * 100) / 100;
    this.quantity.set(updated);
  }

  toggleAbsent() {
    const next = !this.isAbsent();
    this.isAbsent.set(next);
    if (next) {
      this.quantity.set(0);
      if (!this.notes()) {
        this.notes.set('Absent');
      }
    } else {
      this.quantity.set(null);
      if (this.notes() === 'Absent') {
        this.notes.set('');
      }
    }
  }

  async save() {
    if (!this.session()) {
      return;
    }

    if (!this.isAbsent() && (this.quantity() === null || this.quantity()! <= 0)) {
      return;
    }

    const session = this.session() as Session;
    const date = this.date();

    // Check for duplicate (if not already editing this specific record)
    if (!this.isEditing() || (this.editingRecord() && (this.editingRecord()!.date !== date || this.editingRecord()!.session !== session))) {
      const existing = await this.db.getRecordByDateSession(date, session);
      if (existing && existing.id !== this.editingRecord()?.id) {
        this.duplicateRecord.set(existing);
        this.showDuplicateDialog.set(true);
        return;
      }
    }

    await this.saveRecord();
  }

  async saveRecord() {
    const session = this.session() as Session;
    const now = new Date().toISOString();
    const isAbs = this.isAbsent();
    const q = isAbs ? 0 : (this.quantity() || 0);
    const r = this.rate();
    const calculatedAmount = isAbs ? 0 : Math.round(q * r * 100) / 100;
    const noteText = this.notes() || (isAbs ? 'Absent' : '');

    if (this.isEditing()) {
      const record = this.editingRecord()!;
      const updated: MilkRecord = {
        ...record,
        date: this.date(),
        session,
        quantity: q,
        ratePerLitre: r,
        amount: calculatedAmount,
        notes: noteText,
        isAbsent: isAbs,
        updatedAt: now
      };
      await this.db.updateRecord(updated);
      this.showSuccessToast(isAbs ? 'Marked as Absent!' : 'Record updated successfully!');
    } else {
      const record: Omit<MilkRecord, 'id'> = {
        date: this.date(),
        session,
        quantity: q,
        ratePerLitre: r,
        amount: calculatedAmount,
        notes: noteText,
        isAbsent: isAbs,
        createdAt: now,
        updatedAt: now
      };
      await this.db.addRecord(record);
      this.showSuccessToast(isAbs ? 'Marked as Absent!' : 'Record saved successfully!');
    }

    // Automatically remember the rate used for subsequent entries
    const settings = this.settings();
    if (settings && settings.defaultRate !== r) {
      settings.defaultRate = r;
      await this.db.saveSettings(settings);
    }

    setTimeout(() => {
      this.router.navigate(['/']);
    }, 700);
  }

  editDuplicate() {
    const dup = this.duplicateRecord();
    if (dup) {
      this.editingRecord.set(dup);
      this.date.set(dup.date);
      this.session.set(dup.session);
      this.isAbsent.set(!!dup.isAbsent || dup.quantity === 0);
      this.quantity.set(dup.quantity);
      this.rate.set(dup.ratePerLitre);
      this.notes.set(dup.notes || '');
    }
    this.showDuplicateDialog.set(false);
  }

  cancelDuplicate() {
    this.showDuplicateDialog.set(false);
  }

  goBack() {
    this.router.navigate(['/']);
  }

  private showSuccessToast(msg: string) {
    this.successMessage.set(msg);
    this.showSuccess.set(true);
    setTimeout(() => this.showSuccess.set(false), 2000);
  }

  private formatDateKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
