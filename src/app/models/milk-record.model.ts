export type Session = 'Morning' | 'Evening';

export interface MilkRecord {
  id?: number;
  date: string;        // YYYY-MM-DD format
  session: Session;
  quantity: number;     // in litres (0 if absent)
  ratePerLitre: number; // rate per litre
  amount: number;       // quantity × ratePerLitre (0 if absent)
  notes: string;
  isAbsent?: boolean;   // true if marked absent (no milk)
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
  isAbsent?: boolean;
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
  absentDays: number;
  deliveredDays: number;
  averagePerDay: number;
  averageDailyCost: number;
}

export interface BackupData {
  version: string;
  exportedAt: string;
  records: MilkRecord[];
  settings: AppSettings;
}
