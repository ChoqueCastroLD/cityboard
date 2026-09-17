import { Check, ChevronDown, Crown, LogIn, LogOut, Pencil, UserRound } from 'lucide-react';
import { useRef, useState } from 'react';
import { useAccount } from '../../hooks/useAccount';
import { useOutsideClose } from '../../hooks/useOutsideClose';
import { guarded } from '../../lib/toast';
import { Sheet } from '../ui/Sheet';

function RenameSheet({ open, onClose, current }: { open: boolean; onClose: () => void; current: string }) {
  const { rename } = useAccount();
  const [name, setName] = useState(current);
  const [busy, setBusy] = useState(false);
  const save = () => {
    const next = name.trim();
    if (!next) return;
    setBusy(true);
    void guarded(rename(next).then(onClose)).finally(() => setBusy(false));
  };
  return (
    <Sheet open={open} title="Cambiar nombre" onClose={onClose}>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <input className="field flex-1" maxLength={24} autoFocus value={name} onChange={(e) => setName(e.target.value)} aria-label="Nuevo nombre" />
        <button className="btn btn-primary h-11 px-4" type="submit" disabled={busy || !name.trim()}>
          <Check size={16} /> Guardar
        </button>
      </form>
    </Sheet>
  );
}

export function AccountChip({ onLogin, onCeo }: { onLogin: () => void; onCeo: () => void }) {
  const { user, premium, loading, logout } = useAccount();
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  useOutsideClose(wrapper, open, () => setOpen(false));

  if (loading) return <span className="pill h-10 w-28 animate-pulse" aria-hidden />;
  if (!user) {
    return (
      <button className="btn h-10 gap-2 px-4" onClick={onLogin}>
        <LogIn size={16} /> Entrar
      </button>
    );
  }

  return (
    <div className="relative" ref={wrapper}>
      <button
        type="button"
        className="btn h-10 max-w-[60vw] gap-2 px-3 sm:max-w-none"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className={`grid h-6 w-6 place-items-center rounded-full ${premium ? 'bg-amber-300 text-black' : 'bg-white/15'}`}>
          {premium ? <Crown size={13} /> : <UserRound size={13} />}
        </span>
        <span className="truncate text-sm font-medium">{user.name}</span>
        {premium && <span className="pill px-1.5 py-0 text-[10px] font-bold tracking-wide text-amber-300">CEO</span>}
        <ChevronDown size={14} className="text-muted" />
      </button>
      {open && (
        <div role="menu" className="glass absolute top-full right-0 z-40 mt-1.5 flex w-56 flex-col gap-0.5 p-1.5">
          <div className="truncate px-2.5 py-1.5 text-xs text-muted">{user.email}</div>
          <button role="menuitem" className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-white/10" onClick={() => (setOpen(false), setRenaming(true))}>
            <Pencil size={15} /> Cambiar nombre
          </button>
          <button role="menuitem" className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-white/10" onClick={() => (setOpen(false), onCeo())}>
            <Crown size={15} /> Suscripción CEO
          </button>
          <button role="menuitem" className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-danger hover:bg-white/10" onClick={() => (setOpen(false), void guarded(logout()))}>
            <LogOut size={15} /> Salir
          </button>
        </div>
      )}
      <RenameSheet open={renaming} onClose={() => setRenaming(false)} current={user.name} />
    </div>
  );
}
