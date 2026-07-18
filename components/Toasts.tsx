'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useToastStore } from '@/store/useToastStore';

const ESTILO = {
  success: 'border-success/50 bg-success/15 text-success',
  warning: 'border-warning/50 bg-warning/15 text-warning',
  error: 'border-danger/50 bg-danger/15 text-danger',
};

// Notificaciones flotantes no intrusivas (Fase 7); se autodescartan.
export default function Toasts() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className={`rounded-sm border px-4 py-2 text-sm font-medium backdrop-blur-md ${ESTILO[t.tone]}`}
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
