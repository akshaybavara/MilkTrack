import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DbService } from '../../services/db.service';
import { AppSettings, BackupData } from '../../models/milk-record.model';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.scss'
})
export class SettingsComponent implements OnInit {
  defaultRate = signal<number>(60);
  currency = signal<string>('INR');
  currencySymbol = signal<string>('₹');
  unit = signal<string>('Litre');
  totalRecords = signal<number>(0);

  // Status/Toast messages
  message = signal<string>('');
  messageType = signal<'success' | 'error'>('success');

  // Confirmation dialogs
  showImportConfirm = signal<boolean>(false);
  pendingBackupData: BackupData | null = null;

  showClearConfirmStep1 = signal<boolean>(false);
  showClearConfirmStep2 = signal<boolean>(false);

  constructor(private db: DbService) {}

  async ngOnInit() {
    await this.loadSettings();
    await this.loadStats();
  }

  async loadSettings() {
    const s = await this.db.getSettings();
    this.defaultRate.set(s.defaultRate);
    this.currency.set(s.currency);
    this.currencySymbol.set(s.currencySymbol);
    this.unit.set(s.unit);
  }

  async loadStats() {
    const count = await this.db.getRecordCount();
    this.totalRecords.set(count);
  }

  async saveSettings() {
    const settings: AppSettings = {
      defaultRate: Number(this.defaultRate()) || 60,
      currency: this.currency(),
      currencySymbol: this.currencySymbol(),
      unit: this.unit()
    };
    await this.db.saveSettings(settings);
    this.showMessage('Settings saved successfully!');
  }

  async exportBackup() {
    try {
      const data = await this.db.exportBackup();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const filename = `milk-backup-${dateStr}.json`;

      this.downloadBlob(blob, filename);
      this.showMessage('Backup exported successfully!');
    } catch (err) {
      this.showMessage('Failed to export backup.', 'error');
    }
  }

  async exportCSV() {
    try {
      const csv = await this.db.exportCSV();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const filename = `milk-records-${dateStr}.csv`;

      this.downloadBlob(blob, filename);
      this.showMessage('CSV exported successfully!');
    } catch (err) {
      this.showMessage('Failed to export CSV.', 'error');
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string) as BackupData;
        if (!parsed.records || !Array.isArray(parsed.records)) {
          throw new Error('Invalid backup file structure.');
        }
        this.pendingBackupData = parsed;
        this.showImportConfirm.set(true);
      } catch (e) {
        this.showMessage('Invalid backup JSON file.', 'error');
      } finally {
        input.value = '';
      }
    };
    reader.readAsText(file);
  }

  async confirmImport() {
    if (!this.pendingBackupData) return;
    try {
      const count = await this.db.importBackup(this.pendingBackupData);
      this.showImportConfirm.set(false);
      this.pendingBackupData = null;
      await this.loadSettings();
      await this.loadStats();
      this.showMessage(`Successfully imported ${count} records!`);
    } catch (err) {
      this.showMessage('Error importing backup.', 'error');
    }
  }

  cancelImport() {
    this.showImportConfirm.set(false);
    this.pendingBackupData = null;
  }

  // Clear All Data with double confirmation
  promptClearData() {
    this.showClearConfirmStep1.set(true);
  }

  proceedToClearStep2() {
    this.showClearConfirmStep1.set(false);
    this.showClearConfirmStep2.set(true);
  }

  cancelClear() {
    this.showClearConfirmStep1.set(false);
    this.showClearConfirmStep2.set(false);
  }

  async executeClearAll() {
    try {
      await this.db.clearAllRecords();
      this.showClearConfirmStep2.set(false);
      await this.loadStats();
      this.showMessage('All milk records cleared.');
    } catch (err) {
      this.showMessage('Failed to clear records.', 'error');
    }
  }

  private downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private showMessage(msg: string, type: 'success' | 'error' = 'success') {
    this.message.set(msg);
    this.messageType.set(type);
    setTimeout(() => {
      this.message.set('');
    }, 3000);
  }
}
