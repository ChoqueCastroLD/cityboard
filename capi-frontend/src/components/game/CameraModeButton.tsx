import { Hand, LocateFixed, Map } from 'lucide-react';
import type { CameraMode } from '../../three/types';

const ORDER: CameraMode[] = ['map', 'player', 'locked'];

const LABEL: Record<CameraMode, string> = {
  player: 'Cámara: mi ficha',
  map: 'Cámara: mapa (sigue el turno)',
  locked: 'Cámara: manual (no se mueve sola)',
};

const ICON: Record<CameraMode, React.ReactNode> = {
  player: <LocateFixed size={16} />,
  map: <Map size={16} />,
  locked: <Hand size={16} />,
};

export function CameraModeButton({ mode, onChange }: { mode: CameraMode; onChange: (mode: CameraMode) => void }) {
  const next = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length]!;
  return (
    <button type="button" onClick={() => onChange(next)} title={`${LABEL[mode]} · clic para cambiar`} aria-label={LABEL[mode]} className="btn btn-icon h-9 w-9">
      {ICON[mode]}
    </button>
  );
}
