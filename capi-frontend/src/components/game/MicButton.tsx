import { Loader2, Mic, MicOff } from 'lucide-react';
import { useGame } from './context';

export function MicButton() {
  const { voice, openDialog } = useGame();
  if (!voice || !voice.state.supported) return null;
  const { enabled, muted, connecting, speaking, error } = voice.state;
  const title = connecting ? 'Conectando el micrófono…' : !enabled ? 'Activar chat de voz' : muted ? 'Micrófono silenciado · clic para hablar' : 'Hablando · clic para silenciar';
  const onClick = () => {
    if (connecting) return;
    if (!enabled) return void voice.enable();
    voice.toggleMute();
  };
  const tone = !enabled ? 'text-muted' : muted ? 'bg-danger/20 text-danger' : 'bg-ok/15 text-ok';
  return (
    <button
      type="button"
      className={`btn btn-icon relative h-9 w-9 transition ${tone} ${speaking && enabled && !muted ? 'shadow-[0_0_0_2px_var(--color-ok)]' : ''}`}
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault();
        openDialog({ kind: 'settings', tab: 'audio' });
      }}
      title={`${title}${error ? ` · ${error}` : ''}`}
      aria-label={title}
      aria-pressed={enabled && !muted}
    >
      {connecting ? <Loader2 size={16} className="animate-spin" /> : enabled && !muted ? <Mic size={16} /> : <MicOff size={16} />}
    </button>
  );
}
