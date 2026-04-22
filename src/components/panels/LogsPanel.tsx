import { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Activity, Filter } from 'lucide-react';
import { useStore } from '../../store/useStore';
import type { LogEventType, LogEntry } from '../../types';

/* ── Filter config ─────────────────────────────────────────────────────────── */
type FilterTab = 'all' | 'people' | 'messages' | 'docs';

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: 'all',      label: 'Tudo'       },
  { id: 'people',   label: 'Equipe'     },
  { id: 'messages', label: 'Mensagens'  },
  { id: 'docs',     label: 'Docs'       },
];

const TYPE_FILTER: Record<FilterTab, LogEventType[] | null> = {
  all:      null,
  people:   ['hire', 'fire', 'desk_visit', 'task_start', 'task_done', 'reset'],
  messages: ['message_sent', 'agent_reply'],
  docs:     ['document_add', 'document_remove', 'company_update'],
};

/* ── Type → colour / icon ───────────────────────────────────────────────────── */
const TYPE_META: Record<LogEventType, { dot: string; bg: string }> = {
  hire:           { dot: '#4ade80', bg: 'rgba(74,222,128,0.08)' },
  fire:           { dot: '#f87171', bg: 'rgba(248,113,113,0.08)' },
  message_sent:   { dot: '#818cf8', bg: 'rgba(129,140,248,0.08)' },
  agent_reply:    { dot: '#a78bfa', bg: 'rgba(167,139,250,0.08)' },
  task_start:     { dot: '#facc15', bg: 'rgba(250,204,21,0.06)'  },
  task_done:      { dot: '#34d399', bg: 'rgba(52,211,153,0.07)'  },
  desk_visit:     { dot: '#38bdf8', bg: 'rgba(56,189,248,0.07)'  },
  company_update: { dot: '#fb923c', bg: 'rgba(251,146,60,0.07)'  },
  document_add:   { dot: '#c084fc', bg: 'rgba(192,132,252,0.07)' },
  document_remove:{ dot: '#94a3b8', bg: 'rgba(148,163,184,0.06)' },
  reset:          { dot: '#f87171', bg: 'rgba(248,113,113,0.06)' },
};

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000)  return `${Math.max(1, Math.floor(diff / 1000))}s atrás`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}min atrás`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h atrás`;
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function LogRow({ entry }: { entry: LogEntry }) {
  const meta = TYPE_META[entry.type];
  const [expanded, setExpanded] = useState(false);
  const hasDetail = !!entry.detail;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.18 }}
      className={`flex flex-col gap-1 px-3 py-2 rounded transition-all cursor-pointer ${
        expanded ? 'ring-1 ring-accent-purple/30 shadow-xl' : 'hover:brightness-110'
      }`}
      style={{ 
        background: expanded ? 'rgba(20,20,40,0.98)' : meta.bg,
        marginBottom: expanded ? '8px' : '0px',
        marginTop: expanded ? '8px' : '0px',
      }}
      onClick={() => setExpanded((v) => !v)}
    >
      <div className="flex gap-2.5">
        {/* Colour dot */}
        <div className="flex-shrink-0 mt-1.5">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: meta.dot, boxShadow: `0 0 5px ${meta.dot}80` }}
          />
        </div>

        <div className="flex-1 min-w-0">
          {/* Main text + timestamp */}
          <div className="flex items-start justify-between gap-2">
            <p
              className={`text-xs text-slate-200 leading-snug ${expanded ? 'font-medium' : 'truncate'}`}
              style={{ color: entry.agentColor ? `color-mix(in srgb, ${entry.agentColor} 60%, #e2e8f0)` : undefined }}
            >
              {entry.text}
            </p>
            <span className="text-[10px] font-mono text-slate-500 whitespace-nowrap flex-shrink-0 mt-px">
              {relativeTime(entry.timestamp)}
            </span>
          </div>

          {/* Metadata revealed on expand */}
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-2 mt-2 mb-2">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-slate-400 bg-white/5 px-1 rounded border border-white/10">
                    {entry.type.replace('_', ' ')}
                  </span>
                  <span className="text-[9px] font-mono text-slate-600">
                    {new Date(entry.timestamp).toLocaleTimeString('pt-BR')}
                  </span>
                </div>

                {hasDetail && (
                  <div className="text-[11px] text-slate-300 mt-2 leading-relaxed font-mono bg-black/40 p-2.5 rounded border border-white/5 whitespace-pre-wrap break-words">
                    {entry.detail}
                  </div>
                )}
                
                {entry.agentId && (
                  <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-slate-500">Agente:</span>
                      <span className="text-[10px] font-mono text-slate-300">
                        {entry.agentEmoji} {entry.agentName}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-600 italic">
                      @{entry.agentId}
                    </span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Collapsed preview */}
          {!expanded && hasDetail && (
            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug font-mono line-clamp-1 opacity-60">
              {entry.detail}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function LogsPanel({ open, onClose }: Props) {
  const logs = useStore((s) => s.logs);
  const [filter, setFilter] = useState<FilterTab>('all');
  const listRef = useRef<HTMLDivElement>(null);
  const prevLen  = useRef(0);

  // Auto-scroll to top on new entry
  useEffect(() => {
    if (logs.length > prevLen.current && listRef.current) {
      listRef.current.scrollTop = 0;
    }
    prevLen.current = logs.length;
  }, [logs.length]);

  const allowed = TYPE_FILTER[filter];
  const visible: LogEntry[] = allowed
    ? logs.filter((l) => allowed.includes(l.type))
    : logs;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 30 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="absolute right-0 top-0 bottom-0 w-[340px] flex flex-col z-30 border-l border-accent-purple/20"
          style={{ background: 'rgba(10,10,24,0.99)' }}
        >
          {/* Header — matches ChatContainer header height */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-accent-purple/20 h-12 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-accent-violet" />
              <span className="font-mono text-sm text-slate-100 tracking-wide">Logs</span>
              {logs.length > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-accent-purple/20 text-accent-violet">
                  {logs.length}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-100 transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 px-2 py-1.5 border-b border-accent-purple/15">
            {FILTER_TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setFilter(t.id)}
                className={`px-2 py-0.5 rounded-sm text-[11px] font-mono transition-colors ${
                  filter === t.id
                    ? 'bg-accent-purple/25 text-accent-violet border border-accent-purple/40'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Log list */}
          <div
            ref={listRef}
            className="flex-1 overflow-y-auto py-1 px-1 flex flex-col gap-0.5"
            style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(139,92,246,0.3) transparent' }}
          >
            {visible.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500">
                <Filter size={24} className="opacity-30" />
                <p className="text-xs font-mono">Nenhuma atividade ainda</p>
              </div>
            ) : (
              visible.map((entry) => (
                <LogRow key={entry.id} entry={entry} />
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-3 py-1.5 border-t border-accent-purple/15 flex items-center justify-between">
            <span className="text-[10px] font-mono text-slate-500">
              {visible.length} evento{visible.length !== 1 ? 's' : ''}
            </span>
            <span className="text-[10px] font-mono text-slate-600">
              últimas 200 entradas
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
