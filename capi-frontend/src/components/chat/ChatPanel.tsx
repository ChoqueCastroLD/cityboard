import { ChevronDown, ImagePlus, MessageCircle, Send } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ChatMessage, GameClient } from '../../client/GameClient';
import { useChat } from '../../hooks/useChat';
import { usePhone } from '../../hooks/useMediaQuery';
import { type FavoriteGif, parseChatText } from '../../lib/chatContent';
import { guarded } from '../../lib/toast';
import { Sheet } from '../ui/Sheet';
import { GifPicker } from './GifPicker';
import { Lightbox } from './Lightbox';

const OPEN_KEY = 'capi:chat-open';

function readOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) !== '0';
  } catch {
    return true;
  }
}

function time(at: number): string {
  return new Date(at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

function ChatImage({ url, onOpen }: { url: string; onOpen: (url: string) => void }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <a href={url} target="_blank" rel="noreferrer noopener" className="underline underline-offset-2 break-all">
        {url}
      </a>
    );
  }
  return (
    <button type="button" className="block max-w-full overflow-hidden rounded-xl bg-fill focus-visible:ring-2 focus-visible:ring-accent" onClick={() => onOpen(url)} title="Ver en grande">
      <img src={url} alt="" className="max-h-44 max-w-full object-cover" loading="lazy" onError={() => setFailed(true)} />
    </button>
  );
}

function Bubble({ message, mine, onImage }: { message: ChatMessage; mine: boolean; onImage: (url: string) => void }) {
  const parts = parseChatText(message.text);
  const onlyImage = parts.length === 1 && parts[0]?.kind === 'image';
  return (
    <li className={`flex max-w-[88%] flex-col gap-0.5 ${mine ? 'self-end items-end' : 'self-start items-start'}`}>
      {!mine && (
        <span className="flex items-center gap-1.5 px-1 text-[11px] text-muted">
          <span className="h-2 w-2 rounded-full" style={{ background: message.color }} />
          {message.name}
        </span>
      )}
      <div className={`${onlyImage ? '' : mine ? 'rounded-2xl rounded-br-md bg-accent px-3 py-1.5 text-white' : 'rounded-2xl rounded-bl-md bg-fill-2 px-3 py-1.5'} text-sm leading-snug break-words`} title={time(message.at)}>
        {parts.map((part, i) =>
          part.kind === 'text' ? (
            <span key={i}>{part.text}</span>
          ) : part.kind === 'link' ? (
            <a key={i} href={part.url} target="_blank" rel="noreferrer noopener" className="underline underline-offset-2 break-all">
              {part.url}
            </a>
          ) : (
            <ChatImage key={i} url={part.url} onOpen={onImage} />
          ),
        )}
      </div>
    </li>
  );
}

function Messages({ messages, myId, onImage }: { messages: ChatMessage[]; myId: string | null; onImage: (url: string) => void }) {
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const [behind, setBehind] = useState(false);
  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setBehind(!stick.current);
  };
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (stick.current) {
      el.scrollTop = el.scrollHeight;
      setBehind(false);
    } else setBehind(true);
  }, [messages]);
  return (
    <div className="relative min-h-0 flex-1">
      <div ref={scroller} onScroll={onScroll} className="scrollbar-thin h-full overflow-y-auto overscroll-contain px-3 py-2">
        {messages.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted">Aún no hay mensajes. Saluda a la mesa.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {messages.map((m) => (
              <Bubble key={m.id} message={m} mine={m.playerId === myId} onImage={onImage} />
            ))}
          </ul>
        )}
      </div>
      {behind && (
        <button
          type="button"
          className="btn absolute bottom-2 left-1/2 h-8 -translate-x-1/2 gap-1 px-3 text-xs shadow-lg"
          onClick={() => {
            const el = scroller.current;
            if (el) el.scrollTop = el.scrollHeight;
            stick.current = true;
            setBehind(false);
          }}
        >
          <ChevronDown size={13} /> Nuevos mensajes
        </button>
      )}
    </div>
  );
}

const FLOAT_MS = 30_000;
export const OPEN_CHAT_EVENT = 'capi:open-chat';
const FLOAT_LIMIT = 3;

function FloatingMessages({ messages, myId, tone }: { messages: ChatMessage[]; myId: string | null; tone: 'clean' | 'glass' }) {
  const [now, setNow] = useState(() => Date.now());
  const recent = messages.filter((m) => now - m.at < FLOAT_MS).slice(-FLOAT_LIMIT);
  useEffect(() => {
    if (recent.length === 0) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [recent.length]);
  return (
    <div className="pointer-events-none flex w-[min(20rem,calc(100vw-1.5rem))] flex-col items-start gap-1" aria-live="polite">
      <AnimatePresence initial={false}>
        {recent.map((m) => {
          const parts = parseChatText(m.text);
          return (
            <motion.div
              key={m.id}
              className={`max-w-full px-1 text-sm ${tone === 'glass' ? 'text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]' : 'text-ink'}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
            >
              <span className="mr-1.5 inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: m.playerId === myId ? 'var(--accent)' : m.color }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />
                {m.playerId === myId ? 'Tú' : m.name}
              </span>
              {parts.map((part, i) =>
                part.kind === 'image' ? (
                  <img key={i} src={part.url} alt="" className="mt-1 block max-h-24 rounded-lg object-cover" loading="lazy" />
                ) : (
                  <span key={i} className="break-words">
                    {part.kind === 'link' ? part.url : part.text}
                  </span>
                ),
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export function ChatDockButton({ client, className = '' }: { client: GameClient; className?: string }) {
  const { unread } = useChat(client, false);
  return (
    <button
      type="button"
      className={`btn btn-icon relative h-9 w-9 text-muted ${className}`}
      onClick={() => window.dispatchEvent(new CustomEvent(OPEN_CHAT_EVENT))}
      title="Chat en vivo"
      aria-label={`Chat en vivo${unread ? `, ${unread} sin leer` : ''}`}
    >
      <MessageCircle size={16} />
      {unread > 0 && <span className="absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">{unread > 99 ? '99+' : unread}</span>}
    </button>
  );
}

function Composer({ client, canWrite }: { client: GameClient; canWrite: boolean }) {
  const [text, setText] = useState('');
  const [gifs, setGifs] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const send = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    void guarded(client.sendChat(trimmed))
      .then(() => setText(''))
      .finally(() => {
        setBusy(false);
        input.current?.focus();
      });
  };
  const pickGif = (gif: FavoriteGif) => {
    setGifs(false);
    send(gif.url);
  };
  if (!canWrite) return <p className="border-t border-line px-3 py-2 text-center text-xs text-muted">Los espectadores solo pueden leer el chat.</p>;
  return (
    <div className="border-t border-line">
      {gifs && (
        <div className="border-b border-line p-2">
          <GifPicker onPick={pickGif} onClose={() => setGifs(false)} />
        </div>
      )}
      <form
        className="flex items-center gap-1.5 p-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <button type="button" className={`btn btn-icon h-9 w-9 shrink-0 ${gifs ? 'text-accent' : 'text-muted'}`} onClick={() => setGifs(!gifs)} aria-label="GIFs y stickers" aria-pressed={gifs} title="GIFs y stickers">
          <ImagePlus size={16} />
        </button>
        <input
          ref={input}
          className="field h-9 min-w-0 flex-1 text-sm"
          value={text}
          maxLength={500}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribe un mensaje o pega un enlace"
          aria-label="Mensaje"
          enterKeyHint="send"
        />
        <button type="submit" className="btn btn-primary btn-icon h-9 w-9 shrink-0" disabled={busy || !text.trim()} aria-label="Enviar" title="Enviar">
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}

export function ChatPanel({ client, canWrite, tone = 'clean', inline = false, raise = false }: { client: GameClient; canWrite: boolean; tone?: 'clean' | 'glass'; inline?: boolean; raise?: boolean }) {
  const phone = usePhone();
  const [open, setOpen] = useState(() => readOpen());
  const [sheet, setSheet] = useState(false);
  const visible = phone ? sheet : open;
  const { messages, unread } = useChat(client, visible);
  const [image, setImage] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(OPEN_KEY, open ? '1' : '0');
    } catch {
    }
  }, [open]);

  useEffect(() => {
    const openSheet = () => (phone ? setSheet(true) : setOpen(true));
    window.addEventListener(OPEN_CHAT_EVENT, openSheet);
    return () => window.removeEventListener(OPEN_CHAT_EVENT, openSheet);
  }, [phone]);

  const badge = unread > 0 && <span className="absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">{unread > 99 ? '99+' : unread}</span>;
  const surface = tone === 'glass' ? 'glass' : 'rounded-2xl bg-surface shadow-[0_12px_40px_rgba(0,0,0,0.16)] ring-1 ring-line';

  if (inline && !phone) {
    return (
      <section className="flex h-full min-h-[14rem] flex-col overflow-hidden rounded-2xl bg-fill" aria-label="Chat en vivo">
        <header className="flex items-center gap-2 border-b border-line px-3 py-2">
          <MessageCircle size={15} className="text-accent" />
          <span className="text-sm font-semibold">Chat en vivo</span>
          <span className="text-xs text-muted tabular-nums">{messages.length}</span>
        </header>
        <Messages messages={messages} myId={client.myPlayerId} onImage={setImage} />
        <Composer client={client} canWrite={canWrite} />
        <Lightbox url={image} onClose={() => setImage(null)} />
      </section>
    );
  }

  if (phone) {
    return (
      <>
        {!raise && (
          <button
            type="button"
            className={`${tone === 'glass' ? 'glass' : 'rounded-full bg-surface shadow-lg ring-1 ring-line'} fixed bottom-[calc(1rem+var(--safe-bottom))] left-[calc(0.75rem+var(--safe-left))] z-20 grid h-12 w-12 place-items-center rounded-full`}
            onClick={() => setSheet(true)}
            aria-label={`Chat en vivo${unread ? `, ${unread} sin leer` : ''}`}
          >
            <MessageCircle size={20} />
            {badge}
          </button>
        )}
        <Sheet open={sheet} title="Chat en vivo" onClose={() => setSheet(false)}>
          <div className="-mx-5 -mb-5 flex h-[60dvh] flex-col">
            <Messages messages={messages} myId={client.myPlayerId} onImage={setImage} />
            <Composer client={client} canWrite={canWrite} />
          </div>
        </Sheet>
        <Lightbox url={image} onClose={() => setImage(null)} />
      </>
    );
  }

  return (
    <div className="fixed bottom-[calc(0.75rem+var(--safe-bottom))] left-[calc(0.75rem+var(--safe-left))] z-20 flex flex-col items-start" aria-label="Chat en vivo">
      <AnimatePresence initial={false}>
        {open ? (
          <motion.section
            key="panel"
            className={`${surface} flex h-[min(24rem,45vh)] w-[min(22rem,calc(100vw-1.5rem))] flex-col overflow-hidden`}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.16 }}
          >
            <header className="flex items-center gap-2 border-b border-line px-3 py-2">
              <MessageCircle size={15} className="text-accent" />
              <span className="text-sm font-semibold">Chat en vivo</span>
              <span className="text-xs text-muted tabular-nums">{messages.length}</span>
              <button type="button" className="btn btn-icon ml-auto h-7 w-7" onClick={() => setOpen(false)} aria-label="Minimizar chat" title="Minimizar">
                <ChevronDown size={14} />
              </button>
            </header>
            <Messages messages={messages} myId={client.myPlayerId} onImage={setImage} />
            <Composer client={client} canWrite={canWrite} />
          </motion.section>
        ) : (
          <motion.div key="pill" className="flex flex-col items-start gap-1.5" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
            <FloatingMessages messages={messages} myId={client.myPlayerId} tone={tone} />
            <button
              type="button"
              className={`${tone === 'glass' ? 'glass' : 'rounded-full bg-surface shadow-lg ring-1 ring-line'} relative flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold`}
              onClick={() => setOpen(true)}
              aria-label={`Abrir chat en vivo${unread ? `, ${unread} sin leer` : ''}`}
            >
              <MessageCircle size={16} className="text-accent" /> Chat en vivo
              {badge}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <Lightbox url={image} onClose={() => setImage(null)} />
    </div>
  );
}
