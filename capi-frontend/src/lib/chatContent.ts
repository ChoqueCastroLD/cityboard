const URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;
const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?.*)?$/i;
const IMAGE_HOSTS = /^(https?:\/\/)?(media\.tenor\.com|c\.tenor\.com|media[0-9]*\.giphy\.com|i\.imgur\.com|i\.redd\.it|pbs\.twimg\.com)\//i;

export type ChatPart = { kind: 'text'; text: string } | { kind: 'link'; url: string } | { kind: 'image'; url: string };

export const isImageUrl = (url: string): boolean => IMAGE_EXTENSIONS.test(url) || IMAGE_HOSTS.test(url);

export function parseChatText(text: string): ChatPart[] {
  const parts: ChatPart[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const url = match[0].replace(/[),.;!?]+$/, '');
    const start = match.index ?? 0;
    if (start > last) parts.push({ kind: 'text', text: text.slice(last, start) });
    parts.push(isImageUrl(url) ? { kind: 'image', url } : { kind: 'link', url });
    last = start + url.length;
  }
  if (last < text.length) parts.push({ kind: 'text', text: text.slice(last) });
  return parts;
}

const FAVORITES_KEY = 'capi:gif-favorites';
const FAVORITES_LIMIT = 60;

export interface FavoriteGif {
  url: string;
  preview: string;
}

export function loadFavorites(): FavoriteGif[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    const parsed = raw ? (JSON.parse(raw) as FavoriteGif[]) : [];
    return Array.isArray(parsed) ? parsed.filter((f) => typeof f?.url === 'string') : [];
  } catch {
    return [];
  }
}

export function saveFavorites(list: FavoriteGif[]): void {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(list.slice(0, FAVORITES_LIMIT)));
  } catch {
  }
}
