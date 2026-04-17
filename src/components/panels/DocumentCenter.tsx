import { FileText, Trash2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useStore } from '../../store/useStore';
import { useState } from 'react';
import type { OfficeDocument } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function DocumentCenter({ open, onClose }: Props) {
  const documents = useStore((s) => s.documents);
  const removeDocument = useStore((s) => s.removeDocument);
  const [selected, setSelected] = useState<OfficeDocument | null>(null);

  return (
    <Modal
      open={open}
      onClose={() => {
        setSelected(null);
        onClose();
      }}
      title="Documents & Summaries"
      icon={<FileText size={14} />}
      width="max-w-4xl"
    >
      {documents.length === 0 ? (
        <div className="py-12 text-center text-slate-500">
          <p className="font-mono text-xs uppercase tracking-wider">
            No documents yet
          </p>
          <p className="text-[11px] mt-2">
            Ask an agent to draft a proposal, summary or plan — it will land
            here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 h-full">
          <div className="flex flex-col gap-2 overflow-auto pr-2">
            {documents.map((d) => (
              <div
                key={d.id}
                className={`text-left panel px-3 py-2 hover:border-accent-purple/60 flex items-start justify-between gap-2 ${
                  selected?.id === d.id ? 'border-accent-purple/70' : ''
                }`}
              >
                <button
                  onClick={() => setSelected(d)}
                  className="flex-1 text-left min-w-0"
                >
                  <p className="text-sm text-slate-100 font-medium truncate">
                    {d.title}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                    <span>{d.authorEmoji}</span>
                    <span>{d.authorName}</span>
                    <span className="text-accent-violet/60">· {d.date}</span>
                  </p>
                </button>
                <button
                  onClick={() => {
                    removeDocument(d.id);
                    if (selected?.id === d.id) setSelected(null);
                  }}
                  className="text-slate-500 hover:text-red-400 p-1"
                  title="Delete"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>

          <div className="panel p-3 overflow-auto min-h-[260px]">
            {selected ? (
              <article className="space-y-2">
                <h3 className="text-sm font-semibold text-accent-violet font-mono uppercase tracking-wider">
                  {selected.title}
                </h3>
                <p className="text-xs text-slate-400">
                  by {selected.authorName} · {selected.date}
                </p>
                <p className="text-sm text-slate-200 mt-2 whitespace-pre-wrap">
                  {selected.content}
                </p>
              </article>
            ) : (
              <p className="text-xs text-slate-500 font-mono">
                Select a document to preview.
              </p>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
