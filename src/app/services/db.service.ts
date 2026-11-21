import { Injectable } from '@angular/core';
import { MilkRecord, AppSettings, BackupData, Session } from '../models/milk-record.model';

const DB_NAME = 'MilkTrackDB';
const DB_VERSION = 1;
const RECORDS_STORE = 'milkRecords';
const SETTINGS_STORE = 'appSettings';

@Injectable({ providedIn: 'root' })
export class DbService {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(RECORDS_STORE)) {
          const store = db.createObjectStore(RECORDS_STORE, { keyPath: 'id', autoIncrement: true });
          store.createIndex('date', 'date', { unique: false });
          store.createIndex('date_session', ['date', 'session'], { unique: true });
          store.createIndex('session', 'session', { unique: false });
        }
        if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
          db.createObjectStore(SETTINGS_STORE, { keyPath: 'id', autoIncrement: true });
        }
      };
      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  private getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): IDBObjectStore {
    if (!this.db) throw new Error('Database not initialized');
    const tx = this.db.transaction(storeName, mode);
    return tx.objectStore(storeName);
  }

  // ─── Milk Records ────────────────────────────

  async addRecord(record: Omit<MilkRecord, 'id'>): Promise<number> {
    await this.init();
    return new Promise((resolve, reject) => {
      const store = this.getStore(RECORDS_STORE, 'readwrite');
      const request = store.add(record);
      request.onsuccess = () => resolve(request.result as number);
      request.onerror = () => reject(request.error);
    });
  }

  async updateRecord(record: MilkRecord): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const store = this.getStore(RECORDS_STORE, 'readwrite');
      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteRecord(id: number): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const store = this.getStore(RECORDS_STORE, 'readwrite');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getRecordByDateSession(date: string, session: Session): Promise<MilkRecord | undefined> {
    await this.init();
    return new Promise((resolve, reject) => {
      const store = this.getStore(RECORDS_STORE);
      const index = store.index('date_session');
      const request = index.get([date, session]);
      request.onsuccess = () => resolve(request.result as MilkRecord | undefined);
      request.onerror = () => reject(request.error);
    });
  }

  async getRecordsByDate(date: string): Promise<MilkRecord[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const store = this.getStore(RECORDS_STORE);
      const index = store.index('date');
      const request = index.getAll(date);
      request.onsuccess = () => resolve(request.result as MilkRecord[]);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllRecords(): Promise<MilkRecord[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const store = this.getStore(RECORDS_STORE);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result as MilkRecord[]);
      request.onerror = () => reject(request.error);
    });
  }

  async getRecordsByMonth(year: number, month: number): Promise<MilkRecord[]> {
    await this.init();
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endMonth = month === 12 ? 1 : month + 1;
    const endYear = month === 12 ? year + 1 : year;
    const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

    return new Promise((resolve, reject) => {
      const store = this.getStore(RECORDS_STORE);
      const index = store.index('date');
      const range = IDBKeyRange.bound(startDate, endDate, false, true);
      const request = index.getAll(range);
      request.onsuccess = () => resolve(request.result as MilkRecord[]);
      request.onerror = () => reject(request.error);
    });
  }

  async getRecordCount(): Promise<number> {
    await this.init();
    return new Promise((resolve, reject) => {
      const store = this.getStore(RECORDS_STORE);
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async clearAllRecords(): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const store = this.getStore(RECORDS_STORE, 'readwrite');
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ─── Settings ────────────────────────────────

  async getSettings(): Promise<AppSettings> {
    await this.init();
    return new Promise((resolve, reject) => {
      const store = this.getStore(SETTINGS_STORE);
      const request = store.getAll();
      request.onsuccess = () => {
        const results = request.result as AppSettings[];
        if (results.length > 0) {
          resolve(results[0]);
        } else {
          const defaults: AppSettings = {
            defaultRate: 60,
            currency: 'INR',
            currencySymbol: '₹',
            unit: 'Litre'
          };
          resolve(defaults);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    await this.init();
    return new Promise(async (resolve, reject) => {
      const store = this.getStore(SETTINGS_STORE, 'readwrite');
      // Clear and re-add to ensure only one settings record
      const clearReq = store.clear();
      clearReq.onsuccess = () => {
        const addReq = store.add({ ...settings, id: 1 });
        addReq.onsuccess = () => resolve();
        addReq.onerror = () => reject(addReq.error);
      };
      clearReq.onerror = () => reject(clearReq.error);
    });
  }

  // ─── Backup / Restore ────────────────────────

  async exportBackup(): Promise<BackupData> {
    const records = await this.getAllRecords();
    const settings = await this.getSettings();
    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      records,
      settings
    };
  }

  async importBackup(data: BackupData): Promise<number> {
    await this.init();
    // Clear existing records
    await this.clearAllRecords();

    // Import settings
    if (data.settings) {
      await this.saveSettings(data.settings);
    }

    // Import records
    let count = 0;
    for (const record of data.records) {
      const { id, ...rest } = record;
      await this.addRecord(rest);
      count++;
    }
    return count;
  }

  async exportCSV(): Promise<string> {
    const records = await this.getAllRecords();
    // Sort by date descending, then session
    records.sort((a, b) => {
      const dateComp = b.date.localeCompare(a.date);
      if (dateComp !== 0) return dateComp;
      return a.session === 'Morning' ? -1 : 1;
    });

    const headers = 'Date,Session,Quantity (L),Rate (₹/L),Amount (₹),Notes';
    const rows = records.map(r =>
      `${r.date},${r.session},${r.quantity},${r.ratePerLitre},${r.amount},"${(r.notes || '').replace(/"/g, '""')}"`
    );
    return [headers, ...rows].join('\n');
  }

  // ─── Calendar Helpers ────────────────────────

  async getRecordedDatesForMonth(year: number, month: number): Promise<Map<string, Session[]>> {
    const records = await this.getRecordsByMonth(year, month);
    const map = new Map<string, Session[]>();
    for (const r of records) {
      const sessions = map.get(r.date) || [];
      sessions.push(r.session);
      map.set(r.date, sessions);
    }
    return map;
  }
}
