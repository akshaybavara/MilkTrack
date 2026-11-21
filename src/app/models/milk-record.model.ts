export type Session = 'Morning' | 'Evening';

export interface MilkRecord {
  id?: number;
  date: string;        // YYYY-MM-DD format
  session: Session;
  quantity: number;     // in litres
  ratePerLitre: number; // rate per litre
  amount: number;       // quantity × ratePerLitre
  notes: string;
  createdAt: string;    // ISO date string
  updatedAt: string;    // ISO date string
}

export interface AppSettings {
  id?: number;
  defaultRate: number;
  currency: string;
  currencySymbol: string;
  unit: string;
}

export interface DaySummary {
  date: string;
  morning?: MilkRecord;
  evening?: MilkRecord;
  totalQuantity: number;
  totalAmount: number;
}

export interface MonthlySummary {
  month: number;
  year: number;
  totalQuantity: number;
  totalAmount: number;
  morningQuantity: number;
  eveningQuantity: number;
  totalDays: number;
  recordedDays: number;
  averagePerDay: number;
  averageDailyCost: number;
}

export interface BackupData {
  version: string;
  exportedAt: string;
  records: MilkRecord[];
  settings: AppSettings;
}
