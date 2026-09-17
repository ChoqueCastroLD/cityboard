import { useQuery } from '@tanstack/react-query';
import { Heart, Search, Star, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { API_URL } from '../../client/api';
import { type FavoriteGif, loadFavorites, saveFavorites } from '../../lib/chatContent';
import { Segmented } from '../ui/Segmented';

interface GifResult {
  id: string;
  url: string;
  preview: string;
  width: number;
  height: number;
}

type Tab = 'search' | 'favorites';
const TABS = [
  { id: 'search' as const, label: 'Buscar', Icon: Search },
  { id: 'favorites' as const, label: 'Favoritos', Icon: Star },
];

async function fetchGifs(q: string): Promise<{ configured: boolean; results: GifResult[] }> {
  const res = await fetch(`${API_URL}/api/gifs?q=${encodeURIComponent(q)}&limit=24`);
  if (!res.ok) throw new Error('No se pudieron cargar los GIFs.');
  return res.json() as Promise<{ configured: boolean; results: GifResult[] }>;
}

function useDebounced(value: string, ms: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

export function GifPicker({ onPick, onClose }: { onPick: (gif: FavoriteGif) => void; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('search');
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query.trim(), 300);
  const [favorites, setFavorites] = useState<FavoriteGif[]>(() => loadFavorites());
  const [custom, setCustom] = useState('');
  const search = useQuery({ queryKey: ['gifs', debounced], queryFn: () => fetchGifs(debounced), staleTime: 60_000, enabled: tab === 'search' });

  const isFavorite = (url: string) => favorites.some((f) => f.url === url);
  const toggleFavorite = (gif: FavoriteGif) => {
    const next = isFavorite(gif.url) ? favorites.filter((f) => f.url !== gif.url) : [gif, ...favorites];
    setFavorites(next);
    saveFavorites(next);
  };

  const grid = (items: FavoriteGif[], emptyText: string) =>
    items.length === 0 ? (
      <p className="px-2 py-6 text-center text-xs text-muted">{emptyText}</p>
    ) : (
      <ul className="grid grid-cols-3 gap-1.5">
        {items.map((gif) => {
          const fav = isFavorite(gif.url);
          return (
            <li key={gif.url} className="group relative">
              <button type="button" className="block aspect-square w-full overflow-hidden rounded-lg bg-fill focus-visible:ring-2 focus-visible:ring-accent" onClick={() => onPick(gif)} title="Enviar GIF">
                <img src={gif.preview} alt="" className="h-full w-full object-cover" loading="lazy" />
              </button>
              <button
                type="button"
                className={`absolute top-1 right-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white transition ${fav ? 'text-danger opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'}`}
                onClick={() => toggleFavorite(gif)}
                aria-label={fav ? 'Quitar de favoritos' : 'Guardar en favoritos'}
                aria-pressed={fav}
              >
                <Heart size={13} fill={fav ? 'currentColor' : 'none'} />
              </button>
            </li>
          );
        })}
      </ul>
    );

  return (
    <div className="flex max-h-[min(60vh,420px)] flex-col gap-2" role="dialog" aria-label="GIFs">
      <div className="flex items-center gap-2">
        <Segmented options={TABS} value={tab} onChange={setTab} label="GIFs" />
        <button type="button" className="btn btn-icon ml-auto h-8 w-8" onClick={onClose} aria-label="Cerrar GIFs">
          <X size={14} />
        </button>
      </div>
      {tab === 'search' ? (
        <>
          <label className="field flex h-9 items-center gap-2 px-3">
            <Search size={14} className="shrink-0 text-muted" />
            <input className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar GIF" aria-label="Buscar GIF" autoFocus />
          </label>
          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto pr-1">
            {search.isPending && <p className="px-2 py-6 text-center text-xs text-muted">Buscando…</p>}
            {search.isError && <p className="px-2 py-6 text-center text-xs text-danger">No se pudieron cargar los GIFs.</p>}
            {search.data && !search.data.configured && (
              <div className="flex flex-col gap-2 px-2 py-4 text-xs text-muted">
                <p>La búsqueda de GIFs no está configurada en el servidor (falta la clave de Tenor).</p>
                <p>Puedes pegar el enlace de un GIF o imagen para enviarlo y guardarlo en favoritos.</p>
                <form
                  className="flex gap-1.5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const url = custom.trim();
                    if (!url) return;
                    onPick({ url, preview: url });
                    setCustom('');
                  }}
                >
                  <input className="field h-9 flex-1 text-xs" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="https://…gif" aria-label="Enlace del GIF" />
                  <button type="submit" className="btn h-9 px-3 text-xs" disabled={!custom.trim()}>
                    Enviar
                  </button>
                </form>
              </div>
            )}
            {search.data?.configured && grid(search.data.results, debounced ? 'Sin resultados.' : 'Escribe algo para buscar.')}
          </div>
        </>
      ) : (
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto pr-1">{grid(favorites, 'Aún no tienes GIFs favoritos. Guarda los que más uses con el corazón.')}</div>
      )}
    </div>
  );
}
