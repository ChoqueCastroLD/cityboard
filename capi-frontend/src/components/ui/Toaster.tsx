import { AlertCircle, Info } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { dismiss, useToasts } from '../../lib/toast';

export function Toaster() {
  const toasts = useToasts();
  return (
    <div className="pointer-events-none fixed top-3 left-1/2 z-50 flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            role="alert"
            onClick={() => dismiss(t.id)}
            className={`glass pointer-events-auto flex items-center gap-2 px-4 py-2.5 text-left text-sm ${
              t.kind === 'error' ? 'border-danger/50' : ''
            }`}
            initial={{ y: -12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -8, opacity: 0 }}
          >
            {t.kind === 'error' ? <AlertCircle size={16} className="shrink-0 text-danger" /> : <Info size={16} className="shrink-0" />}
            <span>{t.message}</span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
