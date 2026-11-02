/**
 * ثبت اتصال‌دهنده‌ها
 * پلتفرم‌های بدون پیاده‌سازی صریحاً «پشتیبانی‌نشده» اعلام می‌شوند؛
 * هرگز اتصال نمایشی به‌عنوان قابلیت واقعی معرفی نمی‌شود.
 */
import type { Connector } from './types';
import { telegramConnector } from './telegram';
import { eitaaConnector } from './eitaa';
import { baleConnector } from './bale';
import { rssConnector } from './rss';
import { webConnector } from './web';
import { twitterConnector } from './twitter';
import { truthsocialConnector } from './truthsocial';

export const connectors: Record<string, Connector> = {
  telegram: telegramConnector,
  eitaa: eitaaConnector,
  bale: baleConnector,
  rss: rssConnector,
  web: webConnector,
  twitter: twitterConnector,
  truthsocial: truthsocialConnector,
};

/** فهرست همه پلتفرم‌ها برای رابط کاربری — پشتیبانی‌نشده‌ها هم شفاف اعلام می‌شوند */
export const platformCatalog: Array<{
  key: string; label: string; implemented: boolean; limits: string; auth: string;
}> = [
  ...Object.values(connectors).map((c) => ({
    key: c.key, label: c.label, implemented: c.implemented,
    limits: c.limitsDescription, auth: c.authDescription,
  })),
  { key: 'instagram', label: 'اینستاگرام', implemented: false, limits: 'پیاده‌سازی نشده — نیازمند Graph API و مجوز متا', auth: 'در انتظار پیاده‌سازی' },
  { key: 'aparat', label: 'آپارات', implemented: false, limits: 'پیاده‌سازی نشده', auth: 'در انتظار پیاده‌سازی' },
];

export function getConnector(platform: string): Connector | null {
  return connectors[platform] || null;
}

export function isPlatformSupported(platform: string): boolean {
  return platform in connectors;
}
