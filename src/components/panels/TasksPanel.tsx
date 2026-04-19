import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ClipboardList,
  Plus,
  Check,
  Trash2,
  ChevronRight,
  Inbox,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import type { Task, TaskStatus, TaskPriority } from '../../types';

/* ── Constants ─────────────────────────────────────────────────────────────── */

const TABS: { id: TaskStatus; label: string }[] = [
  { id: 'pending',     label: 'Pendente'    },
  { id: 'in_progress', label: 'Em Progresso' },
  { id: 'done',        label: 'Concluído'   },
];

const STATUS_NEXT: Record<TaskStatus, TaskStatus | null> = {
  pending:     'in_progress',
  in_progress: 'done',
  done:        null,
};

const PRIORITY_DOT: Record<TaskPriority, string> = {
  high:   '#f87171',
  normal: '#facc15',
  low:    '#64748b',
};

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  high:   'Alta',
  normal: 'Normal',
  low:    'Baixa',
};

const TAB_ACCENT: Record<TaskStatus, string> = {
  pending:     '#facc15',
  in_progress: '#818cf8',
  done:        '#34d399',
};

/* ── Helpers ───────────────────────────────────────────────────────────────── */

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000)    return `${Math.max(1, Math.floor(diff / 1_000))}s atrás`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}min atrás`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h atrás`;
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

/* ── Task Card ─────────────────────────────────────────────────────────────── */

interface CardProps {
  task: Task;
  agentEmoji: string;
  agentName: string;
  agentColor: string;
  onAdvance: (() => void) | null;
  onDelete: () => void;
}

function TaskCard({ task, agentEmoji, agentName, agentColor, onAdvance, onDelete }: CardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -14, scale: 0.97 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="rounded-sm border border-accent-purple/20 flex flex-col gap-1.5 p-2.5 group"
      style={{ background: 'rgba(139,92,246,0.05)' }}
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-slate-100 font-mono leading-snug font-medium flex-1 min-w-0">
          {task.title}
        </p>
        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {onAdvance && (
            <button
              onClick={onAdvance}
              title={task.status === 'in_progress' ? 'Concluir' : 'Iniciar'}
              className="w-5 h-5 flex items-center justify-center rounded-sm border transition-colors"
              style={{
                borderColor: TAB_ACCENT[task.status] + '80',
                color: TAB_ACCENT[task.status],
              }}
            >
              {task.status === 'in_progress' ? (
                <Check size={10} />
              ) : (
                <ChevronRight size={10} />
              )}
            </button>
          )}
          <button
            onClick={onDelete}
            title="Excluir tarefa"
            className="w-5 h-5 flex items-center justify-center rounded-sm border border-red-500/30 text-slate-500 hover:text-red-400 hover:border-red-400/60 transition-colors"
          >
            <Trash2 size={10} />
          </button>
        </div>
      </div>

      {/* Description */}
      {task.description && (
        <p className="text-[11px] text-slate-400 leading-snug line-clamp-1 font-mono">
          {task.description}
        </p>
      )}

      {/* Footer row */}
      <div className="flex items-center justify-between gap-2 mt-0.5">
        {/* Agent pill */}
        <div
          className="flex items-center gap-1 px-1.5 py-0.5 rounded-sm border text-[10px] font-mono"
          style={{
            borderColor: agentColor + '50',
            background: agentColor + '12',
            color: agentColor,
          }}
        >
          <span>{agentEmoji}</span>
          <span className="truncate max-w-[80px]">{agentName}</span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Priority dot */}
          <div className="flex items-center gap-1" title={`Prioridade: ${PRIORITY_LABEL[task.priority]}`}>
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: PRIORITY_DOT[task.priority],
                boxShadow: `0 0 4px ${PRIORITY_DOT[task.priority]}80`,
              }}
            />
            <span className="text-[10px] font-mono text-slate-500">
              {PRIORITY_LABEL[task.priority]}
            </span>
          </div>
          {/* Timestamp */}
          <span className="text-[10px] font-mono text-slate-600">
            {relativeTime(task.createdAt)}
          </span>
        </div>
      </div>

      {/* Done result */}
      {task.status === 'done' && task.completedAt && (
        <div className="flex items-center gap-1 pt-0.5">
          <Check size={9} className="text-accent-green flex-shrink-0" />
          <span className="text-[10px] font-mono text-accent-green/70">
            concluída {relativeTime(task.completedAt)}
          </span>
        </div>
      )}
    </motion.div>
  );
}

/* ── New Task Form ──────────────────────────────────────────────────────────── */

interface NewTaskFormProps {
  agents: ReturnType<typeof useStore.getState>['agents'];
  onCreate: (title: string, description: string, assignedTo: string, priority: TaskPriority) => void;
  onCancel: () => void;
}

function NewTaskForm({ agents, onCreate, onCancel }: NewTaskFormProps) {
  const [title, setTitle]       = useState('');
  const [desc, setDesc]         = useState('');
  const [assignTo, setAssignTo] = useState(agents[0]?.id ?? '');
  const [priority, setPriority] = useState<TaskPriority>('normal');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !assignTo) return;
    onCreate(title.trim(), desc.trim(), assignTo, priority);
  }

  const inputCls =
    'w-full bg-bg-700 border border-accent-purple/25 rounded-sm px-2 py-1.5 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-accent-purple/60 transition-colors';

  return (
    <motion.form
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.15 }}
      onSubmit={handleSubmit}
      className="mx-2 mb-2 rounded-sm border border-accent-purple/30 p-2.5 flex flex-col gap-2"
      style={{ background: 'rgba(139,92,246,0.07)' }}
    >
      <p className="text-[10px] font-mono uppercase tracking-wider text-accent-violet">
        Nova Tarefa
      </p>

      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título da tarefa..."
        className={inputCls}
        maxLength={80}
      />

      <textarea
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        placeholder="Descrição (opcional)..."
        rows={2}
        className={`${inputCls} resize-none`}
        maxLength={200}
      />

      {/* Agent selector */}
      <select
        value={assignTo}
        onChange={(e) => setAssignTo(e.target.value)}
        className={`${inputCls} appearance-none cursor-pointer`}
      >
        {agents.map((a) => (
          <option key={a.id} value={a.id}>
            {a.emoji} {a.name} — {a.title}
          </option>
        ))}
      </select>

      {/* Priority selector */}
      <div className="flex gap-1">
        {(['low', 'normal', 'high'] as TaskPriority[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPriority(p)}
            className={`flex-1 py-1 rounded-sm border text-[10px] font-mono uppercase tracking-wide transition-colors ${
              priority === p
                ? 'border-current'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
            style={priority === p ? { color: PRIORITY_DOT[p], borderColor: PRIORITY_DOT[p] + '80', background: PRIORITY_DOT[p] + '14' } : {}}
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle"
              style={{ background: PRIORITY_DOT[p] }}
            />
            {PRIORITY_LABEL[p]}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-0.5">
        <button
          type="submit"
          disabled={!title.trim() || !assignTo}
          className="flex-1 py-1.5 rounded-sm text-[11px] font-mono uppercase tracking-wider text-white transition-all disabled:opacity-40"
          style={{ background: 'linear-gradient(to bottom, #8b5cf6, #6366f1)' }}
        >
          Criar
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded-sm text-[11px] font-mono uppercase tracking-wider text-slate-400 hover:text-slate-200 border border-accent-purple/20 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </motion.form>
  );
}

/* ── Empty State ────────────────────────────────────────────────────────────── */

function EmptyColumn({ status }: { status: TaskStatus }) {
  const msgs: Record<TaskStatus, string> = {
    pending:     'Sem tarefas pendentes',
    in_progress: 'Nada em andamento',
    done:        'Nenhuma tarefa concluída',
  };
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-600 select-none">
      <Inbox size={22} className="opacity-40" />
      <p className="text-[11px] font-mono">{msgs[status]}</p>
    </div>
  );
}

/* ── Main Panel ─────────────────────────────────────────────────────────────── */

interface Props {
  open: boolean;
  onClose: () => void;
}

export function TasksPanel({ open, onClose }: Props) {
  const tasks          = useStore((s) => s.tasks);
  const agents         = useStore((s) => s.agents);
  const createTask     = useStore((s) => s.createTask);
  const updateTaskStatus = useStore((s) => s.updateTaskStatus);
  const deleteTask     = useStore((s) => s.deleteTask);

  const [activeTab, setActiveTab] = useState<TaskStatus>('pending');
  const [showForm, setShowForm]   = useState(false);

  const byStatus = useMemo<Record<TaskStatus, Task[]>>(() => ({
    pending:     tasks.filter((t) => t.status === 'pending'),
    in_progress: tasks.filter((t) => t.status === 'in_progress'),
    done:        tasks.filter((t) => t.status === 'done'),
  }), [tasks]);

  const agentMap = useMemo(
    () => new Map(agents.map((a) => [a.id, a])),
    [agents]
  );

  function handleCreate(title: string, description: string, assignedTo: string, priority: TaskPriority) {
    createTask(title, description, assignedTo, priority);
    setShowForm(false);
    setActiveTab('pending');
  }

  const visibleTasks = byStatus[activeTab];

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
          {/* ── Header ── */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-accent-purple/20 h-12 flex-shrink-0">
            <div className="flex items-center gap-2">
              <ClipboardList size={14} className="text-accent-violet" />
              <span className="font-mono text-sm text-slate-100 tracking-wide">
                Tarefas
              </span>
              {tasks.length > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-accent-purple/20 text-accent-violet">
                  {tasks.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowForm((v) => !v)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-sm border text-[11px] font-mono transition-colors ${
                  showForm
                    ? 'border-accent-purple/60 text-accent-violet bg-accent-purple/15'
                    : 'border-accent-purple/30 text-slate-400 hover:text-slate-100 hover:border-accent-purple/50'
                }`}
              >
                <Plus size={11} />
                Nova
              </button>
              <button
                onClick={onClose}
                className="ml-1 text-slate-400 hover:text-slate-100 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* ── Status tabs ── */}
          <div className="flex border-b border-accent-purple/15 flex-shrink-0">
            {TABS.map((tab) => {
              const count = byStatus[tab.id].length;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 py-1.5 text-[10px] font-mono uppercase tracking-wide transition-colors relative ${
                    isActive ? 'text-slate-100' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {tab.label}
                  {count > 0 && (
                    <span
                      className="ml-1 px-1 rounded-sm text-[9px]"
                      style={{
                        background: TAB_ACCENT[tab.id] + '22',
                        color: TAB_ACCENT[tab.id],
                      }}
                    >
                      {count}
                    </span>
                  )}
                  {isActive && (
                    <motion.div
                      layoutId="tasks-tab-indicator"
                      className="absolute bottom-0 left-0 right-0 h-px"
                      style={{ background: TAB_ACCENT[tab.id] }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* ── New task form ── */}
          <AnimatePresence>
            {showForm && (
              <NewTaskForm
                agents={agents}
                onCreate={handleCreate}
                onCancel={() => setShowForm(false)}
              />
            )}
          </AnimatePresence>

          {/* ── Task list ── */}
          <div
            className="flex-1 overflow-y-auto py-2 px-2 flex flex-col gap-1.5"
            style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(139,92,246,0.3) transparent' }}
          >
            <AnimatePresence mode="popLayout">
              {visibleTasks.length === 0 ? (
                <EmptyColumn key="empty" status={activeTab} />
              ) : (
                visibleTasks.map((task) => {
                  const agent = agentMap.get(task.assignedTo);
                  const nextStatus = STATUS_NEXT[task.status];
                  return (
                    <TaskCard
                      key={task.id}
                      task={task}
                      agentEmoji={agent?.emoji ?? '🤖'}
                      agentName={agent?.name ?? task.assignedTo}
                      agentColor={agent?.color ?? '#8b5cf6'}
                      onAdvance={nextStatus ? () => updateTaskStatus(task.id, nextStatus) : null}
                      onDelete={() => deleteTask(task.id)}
                    />
                  );
                })
              )}
            </AnimatePresence>
          </div>

          {/* ── Footer ── */}
          <div className="px-3 py-1.5 border-t border-accent-purple/15 flex items-center justify-between flex-shrink-0">
            <span className="text-[10px] font-mono text-slate-500">
              {byStatus.pending.length} pend · {byStatus.in_progress.length} prog · {byStatus.done.length} feito
            </span>
            <span className="text-[10px] font-mono text-slate-600">
              {tasks.length} total
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
