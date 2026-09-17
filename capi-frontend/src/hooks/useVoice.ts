import { useEffect, useMemo, useState } from 'react';
import type { GameClient } from '../client/GameClient';
import { VoiceMesh, type VoiceState } from '../lib/voice';

export interface VoiceApi {
  state: VoiceState;
  enable: () => Promise<void>;
  disable: () => void;
  toggleMute: () => void;
  setPeerMuted: (id: string, muted: boolean) => void;
  setPeerVolume: (id: string, volume: number) => void;
  setOutputVolume: (volume: number) => void;
  setInputDevice: (deviceId: string | null) => Promise<void>;
}

export function useVoice(client: GameClient): VoiceApi | null {
  const mesh = useMemo(() => (client.myPlayerId ? new VoiceMesh(client, client.myPlayerId) : null), [client]);
  const [state, setState] = useState<VoiceState | null>(() => mesh?.getState() ?? null);

  useEffect(() => {
    if (!mesh) return;
    setState(mesh.getState());
    const unsubscribe = mesh.subscribe(setState);
    return () => {
      unsubscribe();
      mesh.dispose();
    };
  }, [mesh]);

  return useMemo(() => {
    if (!mesh || !state) return null;
    return {
      state,
      enable: () => mesh.enable(),
      disable: () => mesh.disable(),
      toggleMute: () => mesh.setMuted(!mesh.getState().muted),
      setPeerMuted: (id, muted) => mesh.setPeerMuted(id, muted),
      setPeerVolume: (id, volume) => mesh.setPeerVolume(id, volume),
      setOutputVolume: (volume) => mesh.setOutputVolume(volume),
      setInputDevice: (deviceId) => mesh.setInputDevice(deviceId),
    };
  }, [mesh, state]);
}
