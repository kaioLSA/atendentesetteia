import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BarChart2, MessageSquare, Users, CheckSquare, FileText } from 'lucide-react';
import { useStore } from '../../store/useStore';
import type { LogEventType } from '../../types';

/* ── Type colour map (mirrors LogsPanel TYPE_META) ─────────────────────────── */
const TYPE_COLOR: Record<LogEventType, string> = {
  hire:            '#4ade80',
  fire:            '#f87171',
  message_sent:    '#818cf8',
  agent_reply:     '#a78bfa',
  task_start:      '#facc15',
  task_done:       '#34d399',
  desk_visit:      '#38bdf8',
  company_update:  '#fb923c',
  document_add:    '#c084fc',
  document_remove: '#94a3b8',
  reset:           '#f87171',
};

/* ── Helpers ───────────────────────────────────────────────────────────────── */

function shortDay(ts: number): string {
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

/* ── Sub-components ─────────────────────────────────────────────────────────── */

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
}

function StatCard({ icon, label, value, color }: StatCardProps) {
  return (
    <div
      className="rounded-sm border border-accent-purple/20 p-2.5 flex flex-col gap-1"
      style={{ background: 'rgba(139,92,246,0.05)' }}
    >
      <div className="flex items-center gap-1.5" style={{ color }}>
        {icon}
        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
          {label}
        </span>
      </div>
      <span className="text-xl font-mono font-bold text-slate-100 leading-none">
        {value}
      </span>
    </div>
  );
}

/* ── Section heading ────────────────────────────────────────────────────────── */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-3 pt-3 pb-1.5">
      <div className="h-px flex-1 bg-accent-purple/20" />
      <span className="text-[10px] font-mono uppercase tracking-widest text-accent-violet/70 flex-shrink-0">
        {children}
      </span>
      <div className="h-px flex-1 bg-accent-purple/20" />
    </div>
  );
}

/* ── Horizontal bar chart (messages per agent) ──────────────────────────────── */

interface AgentBarChartProps {
  data: { agentId: string; agentName: string; agentEmoji: string; agentColor: string; count: number }[];
}

function AgentBarChart({ data }: AgentBarChartProps) {
  if (data.length === 0) {
    return (
      <p className="px-3 text-[11px] font-mono text-slate-600">
        Sem mensagens ainda.
      </p>
    );
  }

  const max = Math.max(...data.map((d) => d.count));

  return (
    <div className="px-3 flex flex-col gap-2">
      {data.map((d) => {
        const pct = max > 0 ? (d.count / max) * 100 : 0;
        return (
          <div key={d.agentId} className="flex items-center gap-2">
            {/* Label */}
            <div className="w-[90px] flex items-center gap-1 flex-shrink-0">
              <span className="text-base leading-none">{d.agentEmoji}</span>
              <span className="text-[10px] font-mono text-slate-400 truncate">
                {d.agentName}
              </span>
            </div>
            {/* Bar */}
            <div className="flex-1 h-3 rounded-sm overflow-hidden bg-accent-purple/10">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="h-full rounded-sm"
                style={{ background: d.agentColor, opacity: 0.85 }}
              />
            </div>
            {/* Count */}
            <span className="text-[10px] font-mono text-slate-500 w-5 text-right flex-shrink-0">
              {d.count}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── 24-hour activity bar chart ─────────────────────────────────────────────── */

interface HourlyChartProps {
  data: number[]; // 24 elements, index = hour
}

function HourlyChart({ data }: HourlyChartProps) {
  const max = Math.max(...data, 1);
  const BAR_MAX_H = 36; // px

  return (
    <div className="px-3">
      <div className="flex items-end gap-px h-10">
        {data.map((count, hour) => {
          const barH = max > 0 ? Math.max((count / max) * BAR_MAX_H, count > 0 ? 2 : 0) : 0;
          const isActive = count > 0;
          return (
            <div
              key={hour}
              title={`${hour.toString().padStart(2, '0')}h — ${count} evento${count !== 1 ? 's' : ''}`}
              className="flex-1 flex items-end cursor-default"
              style={{ height: BAR_MAX_H }}
            >
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: barH }}
                transition={{ duration: 0.4, delay: hour * 0.012, ease: 'easeOut' }}
                className="w-full rounded-t-sm"
                style={{
                  background: isActive
                    ? 'linear-gradient(to top, #8b5cf6, #a78bfa)'
                    : 'rgba(139,92,246,0.12)',
                  minHeight: isActive ? 2 : 0,
                }}
              />
            </div>
          );
        })}
      </div>
      {/* X-axis labels: 0, 6, 12, 18, 23 */}
      <div className="flex justify-between mt-1">
        {[0, 6, 12, 18, 23].map((h) => (
          <span key={h} className="text-[9px] font-mono text-slate-600">
            {h.toString().padStart(2, '0')}h
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── 7-day sparkline ────────────────────────────────────────────────────────── */

interface SparklineProps {
  data: { label: string; count: number }[]; // newest last
}

function Sparkline({ data }: SparklineProps) {
  if (data.every((d) => d.count === 0)) {
    return (
      <p className="px-3 text-[11px] font-mono text-slate-600">
        Sem atividade recente.
      </p>
    );
  }

  const max = Math.max(...data.map((d) => d.count), 1);
  const BAR_MAX_H = 40;
  const totalWidth = 294; // ~340 - 2*padding(3*4px) = available
  const barW = Math.floor((totalWidth - (data.length - 1) * 3) / data.length);

  return (
    <div className="px-3">
      <div className="flex items-end gap-0.5" style={{ height: BAR_MAX_H + 20 }}>
        {data.map((d, i) => {
          const barH = d.count > 0 ? Math.max((d.count / max) * BAR_MAX_H, 3) : 0;
          return (
            <div
              key={i}
              className="flex flex-col items-center gap-1 flex-1"
              title={`${d.label} — ${d.count} evento${d.count !== 1 ? 's' : ''}`}
            >
              <div
                className="flex items-end w-full"
                style={{ height: BAR_MAX_H }}
              >
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: barH }}
                  transition={{ duration: 0.45, delay: i * 0.06, ease: 'easeOut' }}
                  className="w-full rounded-t-sm"
                  style={{
                    background: d.count > 0
                      ? 'linear-gradient(to top, #6366f1, #8b5cf6)'
                      : 'rgba(139,92,246,0.1)',
                    width: barW,
                  }}
                />
              </div>
              <span className="text-[9px] font-mono text-slate-600 truncate w-full text-center">
                {d.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Event type breakdown ────────────────────────────────────────────────────── */

interface TypeBreakdownProps {
  data: { type: LogEventType; count: number }[];
}

function TypeBreakdown({ data }: TypeBreakdownProps) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.count), 1);

  const TYPE_LABEL: Partial<Record<LogEventType, string>> = {
    hire:            'Contratações',
    fire:            'Demissões',
    message_sent:    'Msgs enviadas',
    agent_reply:     'Respostas',
    task_start:      'Tarefas inicio',
    task_done:       'Tarefas feitas',
    desk_visit:      'Visitas à mesa',
    company_update:  'Config empresa',
    document_add:    'Docs adicion.',
    document_remove: 'Docs removidos',
    reset:           'Resets',
  };

  return (
    <div className="px-3 flex flex-col gap-1.5">
      {data.map(({ type, count }) => {
        const color = TYPE_COLOR[type];
        const pct = (count / max) * 100;
        return (
          <div key={type} className="flex items-center gap-2">
            <div
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: color, boxShadow: `0 0 4px ${color}80` }}
            />
            <span className="text-[10px] font-mono text-slate-400 w-[92px] flex-shrink-0 truncate">
              {TYPE_LABEL[type] ?? type}
            </span>
            <div className="flex-1 h-2 rounded-sm overflow-hidden bg-accent-purple/10">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="h-full rounded-sm"
                style={{ background: color, opacity: 0.75 }}
              />
            </div>
            <span className="text-[10px] font-mono text-slate-500 w-5 text-right flex-shrink-0">
              {count}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Main Panel ─────────────────────────────────────────────────────────────── */

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AnalyticsPanel({ open, onClose }: Props) {
  const logs      = useStore((s) => s.logs);
  const agents    = useStore((s) => s.agents);
  const tasks     = useStore((s) => s.tasks);
  const documents = useStore((s) => s.documents);

  /* ── Computed stats ────────────────────────────────────────────────────── */

  const stats = useMemo(() => {
    const totalMessages = logs.filter(
      (l) => l.type === 'message_sent' || l.type === 'agent_reply'
    ).length;

    const activeAgents = agents.length;

    const tasksDone = tasks.filter((t) => t.status === 'done').length;

    const docsCount = documents.length;

    return { totalMessages, activeAgents, tasksDone, docsCount };
  }, [logs, agents, tasks, documents]);

  /* ── Messages per agent ────────────────────────────────────────────────── */
  const agentMessages = useMemo(() => {
    const counts = new Map<
      string,
      { agentId: string; agentName: string; agentEmoji: string; agentColor: string; count: number }
    >();

    logs.forEach((l) => {
      if (l.type !== 'agent_reply' || !l.agentId) return;
      const key = l.agentId;
      const prev = counts.get(key);
      if (prev) {
        prev.count++;
      } else {
        counts.set(key, {
          agentId: l.agentId,
          agentName: l.agentName ?? l.agentId,
          agentEmoji: l.agentEmoji ?? '🤖',
          agentColor: l.agentColor ?? '#8b5cf6',
          count: 1,
        });
      }
    });

    return Array.from(counts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [logs]);

  /* ── Hourly distribution ───────────────────────────────────────────────── */
  const hourlyData = useMemo<number[]>(() => {
    const arr = Array.from({ length: 24 }, () => 0);
    logs.forEach((l) => {
      const h = new Date(l.timestamp).getHours();
      arr[h]++;
    });
    return arr;
  }, [logs]);

  /* ── 7-day activity ────────────────────────────────────────────────────── */
  const weekData = useMemo(() => {
    const days: { label: string; count: number }[] = [];
    const now = Date.now();
    for (let i = 6; i >= 0; i--) {
      const dayStart = now - i * 86_400_000;
      const dayEnd   = dayStart + 86_400_000;
      const count    = logs.filter((l) => l.timestamp >= dayStart && l.timestamp < dayEnd).length;
      days.push({ label: shortDay(dayStart), count });
    }
    return days;
  }, [logs]);

  /* ── Event type breakdown ──────────────────────────────────────────────── */
  const typeBreakdown = useMemo(() => {
    const counts = new Map<LogEventType, number>();
    logs.forEach((l) => {
      counts.set(l.type, (counts.get(l.type) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
  }, [logs]);

  /* ── Render ──────────────────────────────────────────────────────────────── */

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
              <BarChart2 size={14} className="text-accent-violet" />
              <span className="font-mono text-sm text-slate-100 tracking-wide">
                Analytics
              </span>
              {logs.length > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-accent-purple/20 text-accent-violet">
                  {logs.length} eventos
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

          {/* ── Scrollable body ── */}
          <div
            className="flex-1 overflow-y-auto"
            style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(139,92,246,0.3) transparent' }}
          >
            {/* ── Resumo ── */}
            <SectionTitle>Resumo</SectionTitle>
            <div className="px-3 grid grid-cols-2 gap-2">
              <StatCard
                icon={<MessageSquare size={12} />}
                label="Mensagens"
                value={stats.totalMessages}
                color="#818cf8"
              />
              <StatCard
                icon={<Users size={12} />}
                label="Agentes"
                value={stats.activeAgents}
                color="#4ade80"
              />
              <StatCard
                icon={<CheckSquare size={12} />}
                label="Tarefas feitas"
                value={stats.tasksDone}
                color="#34d399"
              />
              <StatCard
                icon={<FileText size={12} />}
                label="Documentos"
                value={stats.docsCount}
                color="#c084fc"
              />
            </div>

            {/* ── Mensagens por agente ── */}
            <SectionTitle>Mensagens por agente</SectionTitle>
            <AgentBarChart data={agentMessages} />

            {/* ── Atividade por hora ── */}
            <SectionTitle>Atividade por hora</SectionTitle>
            <HourlyChart data={hourlyData} />

            {/* ── Últimos 7 dias ── */}
            <SectionTitle>Últimos 7 dias</SectionTitle>
            <Sparkline data={weekData} />

            {/* ── Eventos por tipo ── */}
            <SectionTitle>Eventos por tipo</SectionTitle>
            {typeBreakdown.length > 0 ? (
              <TypeBreakdown data={typeBreakdown} />
            ) : (
              <p className="px-3 text-[11px] font-mono text-slate-600">
                Sem eventos registrados.
              </p>
            )}

            {/* Bottom padding */}
            <div className="h-4" />
          </div>

          {/* ── Footer ── */}
          <div className="px-3 py-1.5 border-t border-accent-purple/15 flex items-center justify-between flex-shrink-0">
            <span className="text-[10px] font-mono text-slate-500">
              {logs.length} evento{logs.length !== 1 ? 's' : ''} no log
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
