import { Injectable, signal } from '@angular/core';

export interface HindiQuote {
  text: string;
  author?: string;
  source?: 'online' | 'offline';
  date?: string;
}

export const HINDI_OFFLINE_QUOTES: HindiQuote[] = [
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

const STORAGE_KEY = 'milktrack_daily_hindi_quote';
const ONLINE_ENDPOINTS = [
  'https://hindi-quotes.vercel.app/random',
  'https://hindi-quotes.vercel.app/random/motivational',
  'https://hindi-quotes.vercel.app/random/success'
];

@Injectable({ providedIn: 'root' })
export class QuoteService {
  currentQuote = signal<HindiQuote>(HINDI_OFFLINE_QUOTES[0]);
  isRefreshing = signal<boolean>(false);
  isOnline = signal<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);

  private offlineIndex = 0;

  constructor() {
    this.setupNetworkListeners();
  }

  private setupNetworkListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.isOnline.set(true);
      // When coming online, check if today's quote needs to be updated from internet
      this.checkAndUpdateWhenOnline();
    });

    window.addEventListener('offline', () => {
      this.isOnline.set(false);
    });
  }

  /**
   * Initializes the daily quote on app startup.
   * If today's quote was already fetched today, loads it from cache.
   * If connected to internet, fetches fresh quote for today.
   * If offline, uses deterministic offline quote based on calendar date.
   */
  async initDailyQuote(): Promise<void> {
    const todayStr = this.getTodayDateKey();
    const cached = this.getCachedQuote();

    // If we already have an online quote fetched for today, use it
    if (cached && cached.date === todayStr && cached.source === 'online') {
      this.currentQuote.set(cached);
      return;
    }

    // If connected to internet, attempt to fetch a fresh quote for today
    if (this.isOnline()) {
      const onlineQuote = await this.fetchOnlineQuote();
      if (onlineQuote) {
        this.saveCachedQuote(onlineQuote);
        this.currentQuote.set(onlineQuote);
        return;
      }
    }

    // Fallback: If cached from earlier today (even if offline), use it
    if (cached && cached.date === todayStr) {
      this.currentQuote.set(cached);
      return;
    }

    // Otherwise, compute deterministic daily offline quote
    const dailyOffline = this.getDeterministicDailyQuote();
    this.saveCachedQuote(dailyOffline);
    this.currentQuote.set(dailyOffline);
  }

  /**
   * Called when internet connection is restored.
   */
  private async checkAndUpdateWhenOnline() {
    const todayStr = this.getTodayDateKey();
    const cached = this.getCachedQuote();

    // If today's quote was not fetched from online, fetch it now
    if (!cached || cached.date !== todayStr || cached.source !== 'online') {
      const onlineQuote = await this.fetchOnlineQuote();
      if (onlineQuote) {
        this.saveCachedQuote(onlineQuote);
        this.currentQuote.set(onlineQuote);
      }
    }
  }

  /**
   * User manual refresh to see another quote.
   * Fetches fresh from internet if online, otherwise cycles offline list.
   */
  async refreshQuote(): Promise<void> {
    this.isRefreshing.set(true);

    try {
      if (this.isOnline()) {
        const fresh = await this.fetchOnlineQuote();
        if (fresh) {
          this.saveCachedQuote(fresh);
          this.currentQuote.set(fresh);
          return;
        }
      }

      // Offline rotation
      this.offlineIndex = (this.offlineIndex + 1) % HINDI_OFFLINE_QUOTES.length;
      const nextQuote: HindiQuote = {
        ...HINDI_OFFLINE_QUOTES[this.offlineIndex],
        source: 'offline',
        date: this.getTodayDateKey()
      };
      this.currentQuote.set(nextQuote);
    } finally {
      setTimeout(() => this.isRefreshing.set(false), 400);
    }
  }

  /**
   * Fetches a quote from the online API with timeout and endpoint fallback.
   */
  async fetchOnlineQuote(): Promise<HindiQuote | null> {
    for (const url of ONLINE_ENDPOINTS) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const response = await fetch(url, {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' }
        });
        clearTimeout(timeoutId);

        if (!response.ok) continue;

        const data = await response.json();
        const quoteText = data.quote || data.content || data.text;

        if (quoteText && typeof quoteText === 'string' && quoteText.trim().length > 0) {
          return {
            text: quoteText.trim(),
            author: data.author || data.type === 'motivational' ? 'प्रेरक विचार' : 'आज का सुविचार',
            source: 'online',
            date: this.getTodayDateKey()
          };
        }
      } catch (err) {
        // Try next endpoint or fallback
      }
    }
    return null;
  }

  /**
   * Deterministic quote for the day from the offline list based on calendar day.
   */
  getDeterministicDailyQuote(d = new Date()): HindiQuote {
    const startOfYear = new Date(d.getFullYear(), 0, 1);
    const dayOfYear = Math.floor((d.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
    this.offlineIndex = Math.abs(dayOfYear) % HINDI_OFFLINE_QUOTES.length;
    return {
      ...HINDI_OFFLINE_QUOTES[this.offlineIndex],
      source: 'offline',
      date: this.getTodayDateKey(d)
    };
  }

  private getCachedQuote(): HindiQuote | null {
    if (typeof localStorage === 'undefined') return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as HindiQuote;
    } catch {
      return null;
    }
  }

  private saveCachedQuote(quote: HindiQuote) {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(quote));
    } catch {
      // Storage might be full or disabled
    }
  }

  private getTodayDateKey(d = new Date()): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
