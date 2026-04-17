import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { ReactNode } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  width?: string;
}

export function Modal({ open, onClose, title, icon, children, width = 'max-w-2xl' }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: 12, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 12, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 22 }}
            className={`panel w-full ${width} max-h-[80vh] overflow-hidden flex flex-col`}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="panel-header">
              <div className="flex items-center gap-2 text-accent-violet font-mono text-sm uppercase tracking-wider">
                {icon}
                {title}
              </div>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white p-1"
              >
                <X size={16} />
              </button>
            </header>
            <div className="flex-1 overflow-auto p-4">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
