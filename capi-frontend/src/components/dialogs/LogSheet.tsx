import { describeEvent, isVisibleEvent } from '../../lib/describe';
import { useGame } from '../game/context';
import { Sheet } from '../ui/Sheet';

export function LogSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { log, board, state } = useGame();
  return (
    <Sheet open={open} title="Registro" onClose={onClose}>
      {log.length === 0 && <p className="text-sm text-muted">Aún no ha pasado nada.</p>}
      {log
        .filter((entry) => isVisibleEvent(entry.event))
        .reverse()
        .map((entry) => (
          <p key={entry.id} className="text-sm text-muted first:text-ink">
            {describeEvent(entry.event, board, state)}
          </p>
        ))}
    </Sheet>
  );
}
