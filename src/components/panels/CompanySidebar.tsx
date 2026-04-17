import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Flag, X } from 'lucide-react';
import { useStore } from '../../store/useStore';
import type { CompanyContext } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CompanySidebar({ open, onClose }: Props) {
  const company = useStore((s) => s.company);
  const setCompany = useStore((s) => s.setCompany);
  const [draft, setDraft] = useState<CompanyContext>(company);

  useEffect(() => setDraft(company), [company, open]);

  if (!open) return null;

  return (
    <motion.aside
      initial={{ x: 380, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 380, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 220, damping: 24 }}
      className="absolute right-0 top-0 bottom-0 w-[340px] panel rounded-none border-l border-y-0 border-r-0 z-30 flex flex-col"
    >
      <header className="panel-header">
        <div className="flex items-center gap-2 text-accent-violet font-mono text-xs uppercase tracking-wider">
          <Flag size={14} />
          Company Context
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1"
        >
          <X size={14} />
        </button>
      </header>

      <p className="text-[11px] text-slate-500 px-3 py-2 border-b border-accent-purple/15">
        All agents will know this information automatically.
      </p>

      <div className="flex-1 overflow-auto px-3 py-3 space-y-3">
        <Field
          label="Company Name"
          value={draft.companyName}
          onChange={(v) => setDraft({ ...draft, companyName: v })}
        />
        <Field
          label="Mission / What we do"
          value={draft.mission}
          onChange={(v) => setDraft({ ...draft, mission: v })}
          textarea
        />
        <Field
          label="Products & Services"
          value={draft.products}
          onChange={(v) => setDraft({ ...draft, products: v })}
          textarea
        />
        <Field
          label="Culture & Values"
          value={draft.culture}
          onChange={(v) => setDraft({ ...draft, culture: v })}
          textarea
        />
        <Field
          label="Additional Notes"
          value={draft.notes}
          onChange={(v) => setDraft({ ...draft, notes: v })}
          textarea
        />
      </div>

      <div className="p-3 border-t border-accent-purple/20">
        <button
          onClick={() => {
            setCompany(draft);
            onClose();
          }}
          className="w-full py-3 rounded-sm bg-gradient-to-b from-accent-purple to-accent-indigo text-white font-mono text-xs uppercase tracking-widest shadow-glow hover:brightness-110"
        >
          Save & Apply to all agents
        </button>
      </div>
    </motion.aside>
  );
}

function Field({
  label,
  value,
  onChange,
  textarea = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  textarea?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] font-mono uppercase tracking-wider text-accent-violet/80 mb-1">
        {label}
      </span>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="pixel-input resize-none"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pixel-input"
        />
      )}
    </label>
  );
}
