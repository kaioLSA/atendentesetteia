import { useEffect, useState } from 'react';
import { Settings as SettingsIcon, KeyRound, Trash2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import {
  AVAILABLE_MODELS,
  DEFAULT_MODEL,
  loadSettings,
  saveSettings,
} from '../../services/agents/claudeClient';
import { useStore } from '../../store/useStore';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: Props) {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [show, setShow] = useState(false);
  const resetAll = useStore((s) => s.resetAll);

  useEffect(() => {
    if (open) {
      const s = loadSettings();
      setApiKey(s.apiKey);
      setModel(s.model || DEFAULT_MODEL);
    }
  }, [open]);

  function save() {
    saveSettings({ apiKey: apiKey.trim(), model });
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Settings"
      icon={<SettingsIcon size={14} />}
      width="max-w-lg"
    >
      <div className="space-y-4">
        <div>
          <span className="block text-[10px] font-mono uppercase tracking-wider text-accent-violet/80 mb-1 flex items-center gap-1">
            <KeyRound size={10} /> Anthropic API Key
          </span>
          <div className="flex gap-2">
            <input
              type={show ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
              className="pixel-input flex-1 font-mono"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              onClick={() => setShow((s) => !s)}
              className="pixel-btn"
              type="button"
            >
              {show ? 'Hide' : 'Show'}
            </button>
          </div>
          <p className="text-[10px] text-slate-500 mt-1 leading-snug">
            Stored locally in your browser. Get a key at{' '}
            <span className="text-accent-violet">console.anthropic.com</span>.
            Calls go directly from this browser to the Anthropic API.
          </p>
        </div>

        <div>
          <span className="block text-[10px] font-mono uppercase tracking-wider text-accent-violet/80 mb-1">
            Model
          </span>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="pixel-input"
          >
            {AVAILABLE_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={save}
            className="flex-1 py-2 rounded-sm bg-gradient-to-b from-accent-purple to-accent-indigo text-white font-mono text-xs uppercase tracking-widest shadow-glow hover:brightness-110"
          >
            Save
          </button>
          <button
            onClick={() => {
              if (
                confirm(
                  'Reset everything (agents, chats, docs, company context)?'
                )
              ) {
                resetAll();
                onClose();
              }
            }}
            className="px-3 py-2 rounded-sm border border-red-500/40 text-red-400 hover:bg-red-500/10 text-xs font-mono uppercase tracking-widest flex items-center gap-1"
          >
            <Trash2 size={12} /> Reset
          </button>
        </div>
      </div>
    </Modal>
  );
}
