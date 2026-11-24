import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DbService } from '../../services/db.service';
import { MilkRecord, AppSettings, Session } from '../../models/milk-record.model';

export interface HindiQuote {
  text: string;
  author?: string;
}

export const HINDI_QUOTES: HindiQuote[] = [
  { text: 'स्वास्थ्य ही सबसे बड़ा धन है, संतोष सबसे बड़ा खजाना है।', author: 'महात्मा बुद्ध' },
  { text: 'उठो, जागो और तब तक मत रुको जब तक लक्ष्य की प्राप्ति न हो जाए।', author: 'स्वामी विवेकानंद' },
  { text: 'सफलता का कोई रहस्य नहीं है, यह केवल तैयारी, कड़ी मेहनत और निरंतर प्रयास का परिणाम है।', author: 'डॉ. ए. पी. जे. अब्दुल कलाम' },
  { text: 'सुबह की एक अच्छी और सकारात्मक सोच आपके पूरे दिन को खुशहाल बना सकती है।', author: 'सुविचार' },
  { text: 'जो अपने कदमों की काबिलियत पर विश्वास रखते हैं, वही अक्सर मंजिल तक पहुंचते हैं।', author: 'स्वामी विवेकानंद' },
  { text: 'समय और स्वास्थ्य दो ऐसी अनमोल संपत्तियां हैं, जिन्हें हमेशा संजो कर रखना चाहिए।', author: 'सुविचार' },
  { text: 'परिश्रम ही सफलता की कुंजी है, हर नया दिन एक नया अवसर लेकर आता है।', author: 'सुविचार' },
  { text: 'सादगी और ईमानदारी से भरा जीवन ही सबसे सच्चा और सुंदर जीवन है।', author: 'महात्मा गांधी' },
  { text: 'सकारात्मक दृष्टिकोण और धैर्य से जीवन की हर मुश्किल आसान हो जाती है।', author: 'सुविचार' },
  { text: 'अच्छी आदतें और मधुर वाणी ही इंसान की सबसे बड़ी पहचान हैं।', author: 'सुविचार' },
  { text: 'हर दिन कुछ नया सीखें, सदैव प्रसन्न रहें और सबका भला सोचें।', author: 'सुविचार' },
  { text: 'मन को शांत रखें, कर्म उत्तम करें और परिणाम ईश्वर पर छोड़ दें।', author: 'श्रीमद्भगवद्गीता' },
  { text: 'सच्चाई और अच्छाई की राह में चुनौतियां हो सकती हैं, लेकिन विजय निश्चित होती है।', author: 'सुविचार' },
  { text: 'स्वस्थ शरीर और शांत मन ही वास्तविक सुख की नींव हैं।', author: 'सुविचार' },
  { text: 'जीवन में निरंतर सीखते रहना ही आगे बढ़ने का सबसे सरल मार्ग है।', author: 'सुविचार' }
];

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

  // Quote of the day in Hindi
  currentQuote = signal<HindiQuote>(HINDI_QUOTES[0]);
  private quoteIndex = -1;

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

  constructor(private db: DbService, private router: Router) {}

  async ngOnInit() {
    const now = new Date();
    const dateStr = this.formatDateKey(now);
    this.today.set(dateStr);
    this.todayFormatted.set(this.formatDateDisplay(now));

    // Initialize daily quote
    this.initDailyQuote();

    await this.loadData();
  }

  initDailyQuote() {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
    this.quoteIndex = Math.abs(dayOfYear) % HINDI_QUOTES.length;
    this.currentQuote.set(HINDI_QUOTES[this.quoteIndex]);
  }

  refreshQuote() {
    this.quoteIndex = (this.quoteIndex + 1) % HINDI_QUOTES.length;
    this.currentQuote.set(HINDI_QUOTES[this.quoteIndex]);
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
