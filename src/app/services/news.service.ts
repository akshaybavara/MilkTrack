import { Injectable, signal } from '@angular/core';

export interface NewsItem {
  id: string;
  title: string;
  link: string;
  image?: string;
  source: string;
  pubDate?: string;
  timeAgo?: string;
}

export const FALLBACK_TOP_NEWS: NewsItem[] = [
  {
    id: '1',
    title: 'Supreme Court issues landmark directions on judicial transparency and state law compliance',
    link: 'https://timesofindia.indiatimes.com/india',
    image: 'https://static.toiimg.com/photo/msid-136116626,imgsize-135568.cms',
    source: 'Times of India',
    timeAgo: 'Today'
  },
  {
    id: '2',
    title: 'Team India prepares for upcoming international cricket fixtures after intensive series',
    link: 'https://timesofindia.indiatimes.com/sports/cricket',
    image: 'https://static.toiimg.com/photo/msid-136118102,imgsize-72720.cms',
    source: 'Sports',
    timeAgo: 'Today'
  },
  {
    id: '3',
    title: 'Indian economy shows resilient growth backed by manufacturing and rural consumption',
    link: 'https://timesofindia.indiatimes.com/business',
    image: 'https://static.toiimg.com/photo/msid-136098125,imgsize-149258.cms',
    source: 'Business',
    timeAgo: 'Today'
  },
  {
    id: '4',
    title: 'S Jaishankar emphasizes regional stability and diplomatic dialogue in bilateral discussions',
    link: 'https://www.ndtv.com/india-news',
    image: 'https://c.ndtvimg.com/2024-07/5h8ad9m8_sergey-lavrov-s-jaishankar-_625x300_18_July_24.jpg',
    source: 'NDTV India',
    timeAgo: 'Today'
  },
  {
    id: '5',
    title: 'Technology sector leads market rebound with renewed investor confidence in AI & semiconductors',
    link: 'https://www.ndtv.com/world-news',
    image: 'https://c.ndtvimg.com/2026-11/umet5cuc_jensen-huang-bbg_625x300_17_November_26.jpg',
    source: 'Tech World',
    timeAgo: 'Today'
  },
  {
    id: '6',
    title: 'National dairy and agriculture development initiatives expand digital tracking across states',
    link: 'https://timesofindia.indiatimes.com/india',
    image: 'https://static.toiimg.com/photo/msid-136117449,imgsize-364014.cms',
    source: 'National',
    timeAgo: 'Today'
  },
  {
    id: '7',
    title: 'ISRO advances timeline for next-generation space exploration missions and satellite launches',
    link: 'https://www.ndtv.com/science',
    image: 'https://c.ndtvimg.com/2026-11/fdj9a4v4_china-flag_625x300_24_November_26.jpeg',
    source: 'Science & Tech',
    timeAgo: 'Today'
  },
  {
    id: '8',
    title: 'India accelerates renewable energy infrastructure with new solar and wind hybrid corridors',
    link: 'https://timesofindia.indiatimes.com/business',
    image: 'https://static.toiimg.com/photo/msid-136118077,imgsize-100472.cms',
    source: 'Green Energy',
    timeAgo: 'Today'
  },
  {
    id: '9',
    title: 'Consumer digital payments hit new record milestone driven by seamless UPI adoption',
    link: 'https://timesofindia.indiatimes.com/business/india-business',
    image: 'https://static.toiimg.com/photo/msid-136117772,imgsize-1052516.cms',
    source: 'Finance',
    timeAgo: 'Today'
  },
  {
    id: '10',
    title: 'Healthcare experts urge seasonal wellness vigilance and balanced nutrition during winter',
    link: 'https://timesofindia.indiatimes.com/life-style/health-fitness',
    image: 'https://static.toiimg.com/photo/msid-136118523,imgsize-71610.cms',
    source: 'Health',
    timeAgo: 'Today'
  }
];

const STORAGE_KEY = 'milktrack_top_10_news';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes cache

const NEWS_FEEDS = [
  { url: 'https://api.rss2json.com/v1/api.json?rss_url=https://timesofindia.indiatimes.com/rssfeedstopstories.cms', defaultSource: 'Times of India' },
  { url: 'https://api.rss2json.com/v1/api.json?rss_url=https://feeds.feedburner.com/ndtvnews-top-stories', defaultSource: 'NDTV' }
];

@Injectable({ providedIn: 'root' })
export class NewsService {
  newsList = signal<NewsItem[]>(FALLBACK_TOP_NEWS);
  isLoading = signal<boolean>(false);
  isOnline = signal<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);

  constructor() {
    this.setupNetworkListeners();
  }

  private setupNetworkListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.isOnline.set(true);
      this.loadTopNews(true);
    });

    window.addEventListener('offline', () => {
      this.isOnline.set(false);
    });
  }

  /**
   * Loads the top 10 news articles. Uses cached news if fresh, otherwise fetches live.
   */
  async loadTopNews(forceRefresh = false): Promise<void> {
    if (!forceRefresh) {
      const cached = this.getCachedNews();
      if (cached && cached.length >= 10) {
        this.newsList.set(cached.slice(0, 10));
        return;
      }
    }

    if (!this.isOnline()) {
      const cached = this.getCachedNews();
      this.newsList.set(cached && cached.length > 0 ? cached.slice(0, 10) : FALLBACK_TOP_NEWS);
      return;
    }

    this.isLoading.set(true);

    try {
      const liveItems = await this.fetchLiveNews();
      if (liveItems && liveItems.length >= 5) {
        const top10 = liveItems.slice(0, 10);
        this.saveCachedNews(top10);
        this.newsList.set(top10);
        return;
      }
    } catch (err) {
      // Fallback
    } finally {
      this.isLoading.set(false);
    }

    // Fallback if network failed
    const cached = this.getCachedNews();
    this.newsList.set(cached && cached.length > 0 ? cached.slice(0, 10) : FALLBACK_TOP_NEWS);
  }

  /**
   * Fetches news from live RSS feeds via JSON proxies.
   */
  private async fetchLiveNews(): Promise<NewsItem[] | null> {
    for (const feed of NEWS_FEEDS) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(feed.url, {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' }
        });
        clearTimeout(timeoutId);

        if (!response.ok) continue;

        const data = await response.json();
        if (data.status === 'ok' && Array.isArray(data.items) && data.items.length > 0) {
          const items: NewsItem[] = data.items.slice(0, 10).map((it: any, idx: number) => {
            const rawTitle = (it.title || '').trim();
            // Clean HTML tags or entity decodes from title if any
            const cleanTitle = rawTitle.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

            // Image from enclosure or thumbnail or media
            let imageUrl: string | undefined;
            if (it.enclosure && it.enclosure.link) {
              imageUrl = it.enclosure.link;
            } else if (it.thumbnail) {
              imageUrl = it.thumbnail;
            }

            return {
              id: String(idx + 1),
              title: cleanTitle,
              link: it.link || '#',
              image: imageUrl,
              source: it.author ? it.author.replace(/^(by|from)\s+/i, '').trim() : feed.defaultSource,
              pubDate: it.pubDate,
              timeAgo: this.formatRelativeTime(it.pubDate)
            };
          });

          return items;
        }
      } catch {
        // Try next feed
      }
    }
    return null;
  }

  private formatRelativeTime(dateStr?: string): string {
    if (!dateStr) return 'Latest';
    try {
      const pub = new Date(dateStr.replace(/-/g, '/'));
      const now = new Date();
      const diffMs = now.getTime() - pub.getTime();
      if (isNaN(diffMs) || diffMs < 0) return 'Recent';

      const diffMins = Math.floor(diffMs / (1000 * 60));
      if (diffMins < 60) return `${diffMins || 1}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return `${Math.floor(diffHours / 24)}d ago`;
    } catch {
      return 'Recent';
    }
  }

  private getCachedNews(): NewsItem[] | null {
    if (typeof localStorage === 'undefined') return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed.timestamp && Date.now() - parsed.timestamp < CACHE_TTL_MS && Array.isArray(parsed.items)) {
        return parsed.items as NewsItem[];
      }
      return null;
    } catch {
      return null;
    }
  }

  private saveCachedNews(items: NewsItem[]) {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        timestamp: Date.now(),
        items
      }));
    } catch {
      // Storage error
    }
  }
}
