// 版本與更新紀錄：每次更新時，在 src/data/changelog.json 最上面加一筆
import changelog from '../data/changelog.json';

export interface ChangeEntry { version: string; date: string; items: string[] }
export const CHANGELOG = changelog as ChangeEntry[];
export const APP_VERSION = CHANGELOG[0].version;

const SEEN_KEY = 'tidehunter.seenVersion';
export const hasUnreadNews = () => { try { return localStorage.getItem(SEEN_KEY) !== APP_VERSION; } catch { return false; } };
export const markNewsRead = () => { try { localStorage.setItem(SEEN_KEY, APP_VERSION); } catch { /* 略過 */ } };

/** 向伺服器查詢最新版本號；查不到就回傳 null */
export async function fetchLatestVersion(): Promise<string | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const v = (await res.json()) as { version?: string };
    return v.version ?? null;
  } catch { return null; }
}
