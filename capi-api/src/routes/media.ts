import { Elysia, t } from 'elysia';
import { config } from '../config';

interface TenorMedia {
  url: string;
  dims: [number, number];
}

interface TenorResult {
  id: string;
  media_formats: Record<string, TenorMedia | undefined>;
}

export interface GifResult {
  id: string;
  url: string;
  preview: string;
  width: number;
  height: number;
}

const CACHE_MS = 60_000;
const cache = new Map<string, { at: number; results: GifResult[] }>();

async function searchTenor(query: string, limit: number): Promise<GifResult[]> {
  const key = config.tenorApiKey;
  if (!key) return [];
  const cacheKey = `${query}|${limit}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.results;
  const endpoint = query ? 'search' : 'featured';
  const params = new URLSearchParams({ key, limit: String(limit), media_filter: 'gif,tinygif', contentfilter: 'medium', locale: 'es_ES', client_key: 'capi' });
  if (query) params.set('q', query);
  const res = await fetch(`https://tenor.googleapis.com/v2/${endpoint}?${params}`);
  if (!res.ok) return [];
  const body = (await res.json()) as { results?: TenorResult[] };
  const results = (body.results ?? [])
    .map((r): GifResult | null => {
      const gif = r.media_formats.gif;
      const tiny = r.media_formats.tinygif ?? gif;
      if (!gif || !tiny) return null;
      return { id: r.id, url: gif.url, preview: tiny.url, width: gif.dims[0], height: gif.dims[1] };
    })
    .filter((r): r is GifResult => r !== null);
  cache.set(cacheKey, { at: Date.now(), results });
  return results;
}

export const mediaRoutes = () =>
  new Elysia({ name: 'media' })
    .get(
      '/api/gifs',
      async ({ query }) => ({ configured: config.tenorApiKey !== null, results: await searchTenor(query.q?.trim() ?? '', Math.min(40, Math.max(1, Number(query.limit ?? 24)))) }),
      {
        query: t.Object({ q: t.Optional(t.String({ maxLength: 80 })), limit: t.Optional(t.String()) }),
        detail: { tags: ['media'], summary: 'Search GIFs through Tenor (needs TENOR_API_KEY)' },
      },
    )
    .get(
      '/api/rtc/config',
      () => {
        const iceServers: Array<{ urls: string[] | string; username?: string; credential?: string }> = [{ urls: config.stunUrls }];
        if (config.turnUrl) iceServers.push({ urls: config.turnUrl, username: config.turnUsername ?? undefined, credential: config.turnCredential ?? undefined });
        return { iceServers, turn: config.turnUrl !== null };
      },
      { detail: { tags: ['media'], summary: 'ICE servers for voice chat (STUN by default, TURN when configured)' } },
    );
