import { usePhone } from '../../hooks/useMediaQuery';
import { Sheet } from '../ui/Sheet';
import { PlayerMenu, type PlayerMenuProps } from './PlayerMenu';

export function PlayerMenuHost({ open, ...props }: PlayerMenuProps & { open: boolean }) {
  const phone = usePhone();
  if (phone) {
    return (
      <Sheet open={open} title={props.player.name} onClose={props.onClose}>
        <PlayerMenu {...props} variant="sheet" />
      </Sheet>
    );
  }
  return open ? <PlayerMenu {...props} /> : null;
}
