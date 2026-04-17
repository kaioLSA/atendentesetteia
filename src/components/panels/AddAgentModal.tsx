import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useStore } from '../../store/useStore';
import { ROLE_DEFAULTS } from '../../services/agents/rolePrompts';
import type { AgentRole } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
}

const ROLES: { id: AgentRole; label: string; desc: string }[] = [
  { id: 'designer', label: 'Designer', desc: 'Brand, UI, visual systems' },
  { id: 'engineer', label: 'Engineer', desc: 'Architecture, code, shipping' },
  { id: 'marketing', label: 'Marketing', desc: 'Copy, growth, campaigns' },
  { id: 'sales', label: 'Sales', desc: 'Pitch, qualify, close' },
  { id: 'analyst', label: 'Analyst', desc: 'Metrics, insights, reports' },
  { id: 'secretary', label: 'Secretary', desc: 'Notes, agendas, minutes' },
  { id: 'director', label: 'Director', desc: 'Strategy & orchestration' },
];

export function AddAgentModal({ open, onClose }: Props) {
  const addAgent = useStore((s) => s.addAgent);
  const agents = useStore((s) => s.agents);

  const [role, setRole] = useState<AgentRole>('designer');
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');

  function reset() {
    setName('');
    setTitle('');
    setRole('designer');
  }

  function submit() {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const defaults = ROLE_DEFAULTS[role];
    const id = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    if (agents.find((a) => a.id === id)) {
      alert('An agent with that name already exists.');
      return;
    }
    addAgent({
      id,
      name: trimmedName,
      role,
      title: title.trim() || defaults.titleSuggestion,
      color: defaults.color,
      emoji: defaults.emoji,
    });
    reset();
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Hire Agent"
      icon={<UserPlus size={14} />}
      width="max-w-xl"
    >
      <div className="space-y-4">
        <div>
          <span className="block text-[10px] font-mono uppercase tracking-wider text-accent-violet/80 mb-2">
            Role (specialized Claude agent)
          </span>
          <div className="grid grid-cols-2 gap-2">
            {ROLES.map((r) => {
              const d = ROLE_DEFAULTS[r.id];
              const selected = r.id === role;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRole(r.id)}
                  className={`text-left panel px-3 py-2 transition ${
                    selected
                      ? 'border-accent-purple bg-accent-purple/10'
                      : 'hover:border-accent-purple/60'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span style={{ color: d.color }}>{d.emoji}</span>
                    <span className="font-mono text-sm text-slate-100">
                      {r.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">{r.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        <label className="block">
          <span className="block text-[10px] font-mono uppercase tracking-wider text-accent-violet/80 mb-1">
            Name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sofia"
            className="pixel-input"
            autoFocus
          />
        </label>

        <label className="block">
          <span className="block text-[10px] font-mono uppercase tracking-wider text-accent-violet/80 mb-1">
            Title (optional)
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={ROLE_DEFAULTS[role].titleSuggestion}
            className="pixel-input"
          />
        </label>

        <button
          onClick={submit}
          disabled={!name.trim()}
          className="w-full py-2 rounded-sm bg-gradient-to-b from-accent-purple to-accent-indigo text-white font-mono text-xs uppercase tracking-widest shadow-glow hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Hire {name.trim() || 'agent'}
        </button>
      </div>
    </Modal>
  );
}
