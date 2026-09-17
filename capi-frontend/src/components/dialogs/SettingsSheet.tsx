import { Headphones, Mic, MicOff, ScrollText, Volume2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { VoiceApi } from '../../hooks/useVoice';
import { useGame } from '../game/context';
import { Segmented } from '../ui/Segmented';
import { Sheet } from '../ui/Sheet';
import { Switch } from '../ui/Switch';
import { RulePresets } from './RulePresets';
import { RulesEditor } from './RulesEditor';

export type SettingsTab = 'rules' | 'audio';

const TABS = [
  { id: 'rules' as const, label: 'Reglas', Icon: ScrollText },
  { id: 'audio' as const, label: 'Audio', Icon: Headphones },
];

function RulesTab() {
  const { state, isHost, dispatch } = useGame();
  const inLobby = state.phase === 'lobby';
  const editable = isHost && inLobby;
  const hint = !inLobby ? 'Las reglas quedaron fijadas al iniciar la partida.' : isHost ? 'Se fijan al iniciar la partida.' : 'Solo el anfitrión define las reglas.';
  return (
    <>
      <p className="text-xs text-muted">{hint}</p>
      {inLobby && <RulePresets rules={state.rules} editable={editable} onApply={(rules) => void dispatch({ type: 'SET_RULES', rules })} />}
      <RulesEditor rules={state.rules} mode={state.mode} editable={editable} onChange={(rules) => void dispatch({ type: 'SET_RULES', rules })} />
    </>
  );
}

function Meter({ level, active }: { level: number; active: boolean }) {
  const width = `${Math.min(100, Math.round(level * 300))}%`;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-fill-2" aria-hidden>
      <div className={`h-full rounded-full transition-[width] duration-100 ${active ? 'bg-ok' : 'bg-muted'}`} style={{ width: active ? width : '0%' }} />
    </div>
  );
}

function AudioTab({ voice }: { voice: VoiceApi | null }) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const enabled = voice?.state.enabled ?? false;
  useEffect(() => {
    if (!voice?.state.supported) return;
    let alive = true;
    const refresh = () =>
      navigator.mediaDevices
        .enumerateDevices()
        .then((list) => alive && setDevices(list.filter((d) => d.kind === 'audioinput')))
        .catch(() => undefined);
    void refresh();
    navigator.mediaDevices.addEventListener('devicechange', refresh);
    return () => {
      alive = false;
      navigator.mediaDevices.removeEventListener('devicechange', refresh);
    };
  }, [voice?.state.supported, enabled]);

  if (!voice) return <p className="text-sm text-muted">Los espectadores no pueden usar el chat de voz.</p>;
  if (!voice.state.supported) return <p className="text-sm text-muted">Tu navegador no admite chat de voz.</p>;
  const { state } = voice;
  const labelled = devices.filter((d) => d.label);
  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-start justify-between gap-4 rounded-xl bg-fill p-3">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Mic size={15} className="text-accent" /> Chat de voz
          </span>
          <span className="text-xs text-muted">Habla con los demás jugadores conectados. Se conecta de navegador a navegador; el servidor solo presenta a los jugadores.</span>
          {state.error && <span className="text-xs text-danger">{state.error}</span>}
        </span>
        <Switch checked={state.enabled} disabled={state.connecting} label="Chat de voz" onChange={(on) => (on ? void voice.enable() : voice.disable())} />
      </label>

      <div className={`flex flex-col gap-3 ${state.enabled ? '' : 'opacity-60'}`}>
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm">
            {state.muted ? <MicOff size={15} className="text-danger" /> : <Mic size={15} className="text-muted" />} Micrófono
          </span>
          <button className={`btn h-9 px-3 text-xs ${state.muted ? 'btn-danger' : ''}`} disabled={!state.enabled} onClick={voice.toggleMute} aria-pressed={state.muted}>
            {state.muted ? 'Silenciado · activar' : 'Silenciar'}
          </button>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted">Nivel de tu micrófono</span>
          <Meter level={state.level} active={state.enabled && !state.muted} />
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-muted">Dispositivo de entrada</span>
          <select className="field h-10 text-sm" value={state.settings.inputDeviceId ?? ''} onChange={(e) => void voice.setInputDevice(e.target.value || null)} disabled={labelled.length === 0}>
            <option value="">Predeterminado del sistema</option>
            {labelled.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label}
              </option>
            ))}
          </select>
          {labelled.length === 0 && <span className="text-[11px] text-muted">Activa el chat de voz para ver tus micrófonos.</span>}
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="flex items-center justify-between text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <Volume2 size={13} /> Volumen de los demás
            </span>
            <span className="tabular-nums">{Math.round(state.settings.outputVolume * 100)} %</span>
          </span>
          <input type="range" className="w-full accent-accent" min={0} max={100} value={Math.round(state.settings.outputVolume * 100)} onChange={(e) => voice.setOutputVolume(Number(e.target.value) / 100)} aria-label="Volumen de los demás" />
        </label>
        <p className="text-[11px] text-muted">Puedes silenciar o ajustar el volumen de cada jugador desde su menú en la lista de jugadores.</p>
      </div>
    </div>
  );
}

export function SettingsSheet({ open, tab, onTab, onClose }: { open: boolean; tab: SettingsTab; onTab: (tab: SettingsTab) => void; onClose: () => void }) {
  const { voice } = useGame();
  return (
    <Sheet open={open} title="Ajustes" onClose={onClose} size="lg">
      <Segmented options={TABS} value={tab} onChange={onTab} label="Ajustes" className="self-start" />
      {tab === 'rules' ? <RulesTab /> : <AudioTab voice={voice} />}
    </Sheet>
  );
}
