import { FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';

interface Props {
  open: boolean;
  onClose: () => void;
}

const KEY = 'pixel_agents:notes';

export function NotesModal({ open, onClose }: Props) {
  const [text, setText] = useState('');

  useEffect(() => {
    if (open) setText(localStorage.getItem(KEY) ?? '');
  }, [open]);

  function save() {
    localStorage.setItem(KEY, text);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Notes"
      icon={<FileText size={14} />}
      width="max-w-2xl"
    >
      <div className="space-y-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={14}
          placeholder="Drop ideas, sketches, prompts, anything..."
          className="pixel-input resize-none font-mono text-sm leading-relaxed"
        />
        <button
          onClick={save}
          className="w-full py-2 rounded-sm bg-gradient-to-b from-accent-purple to-accent-indigo text-white font-mono text-xs uppercase tracking-widest shadow-glow hover:brightness-110"
        >
          Save notes
        </button>
      </div>
    </Modal>
  );
}
