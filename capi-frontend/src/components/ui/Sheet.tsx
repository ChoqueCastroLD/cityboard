import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { type ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  size?: 'md' | 'lg' | 'xl';
}

const SIZE = { md: 'sm:max-w-md', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' } as const;

export function Sheet({ open, title, onClose, children, size = 'md' }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onPointerDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            className={`glass flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-b-none pb-safe-bottom sm:rounded-b-[1.25rem] sm:pb-0 ${SIZE[size]}`}
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          >
            <div className="flex justify-center pt-2 sm:hidden" aria-hidden>
              <span className="h-1.5 w-10 rounded-full bg-white/30" />
            </div>
            <header className="flex items-center justify-between gap-3 px-5 pt-3 pb-2 sm:pt-4">
              <h2 className="text-base font-semibold">{title}</h2>
              <button className="btn btn-icon" onClick={onClose} aria-label="Cerrar">
                <X size={16} />
              </button>
            </header>
            <div className="scrollbar-thin flex flex-col gap-3 overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
