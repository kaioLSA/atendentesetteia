import {
  Briefcase,
  UserPlus,
  Flag,
  FileText,
  FileBox,
  Settings,
  AlertCircle,
  Activity,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useEffect, useState } from 'react';
import { hasApiKey } from '../../services/agents/claudeClient';

interface Props {
  onOpenDocs: () => void;
  onOpenContext: () => void;
  onOpenAddAgent: () => void;
  onOpenSettings: () => void;
  onOpenNotes: () => void;
  onOpenLogs: () => void;
  logsOpen: boolean;
}

export function TopBar({
  onOpenDocs,
  onOpenContext,
  onOpenAddAgent,
  onOpenSettings,
  onOpenNotes,
  onOpenLogs,
  logsOpen,
}: Props) {
  const agents = useStore((s) => s.agents);
  const logsCount = useStore((s) => s.logs.length);
  const activeAgentId = useStore((s) => s.activeAgentId);
  const setActiveAgent = useStore((s) => s.setActiveAgent);

  const [keyOk, setKeyOk] = useState(hasApiKey());
  // Refresh key indicator when settings modal closes
  useEffect(() => {
    const handler = () => setKeyOk(hasApiKey());
    window.addEventListener('storage', handler);
    const id = window.setInterval(handler, 1500);
    return () => {
      window.removeEventListener('storage', handler);
      window.clearInterval(id);
    };
  }, []);

  return (
    <header className="h-12 px-3 flex items-center gap-2 border-b border-accent-purple/20 bg-bg-800/80 backdrop-blur z-30 relative">
      <div className="flex items-center gap-2 mr-3">
        <span className="text-accent-violet">▣</span>
        <span className="font-mono text-sm tracking-wider text-slate-100">
          Pixel Agents
        </span>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto">
        {agents.map((a) => {
          const active = a.id === activeAgentId;
          return (
            <button
              key={a.id}
              onClick={() => setActiveAgent(a.id)}
              className={`flex items-center gap-1 px-2 py-1 rounded-sm border text-xs font-mono whitespace-nowrap ${
                active
                  ? 'border-accent-purple text-white bg-accent-purple/15'
                  : 'border-accent-purple/30 text-slate-300 hover:border-accent-purple/60'
              }`}
              style={active ? { borderColor: a.color, color: '#fff' } : {}}
            >
              <Briefcase size={12} style={{ color: a.color }} />
              <span>{a.name}</span>
            </button>
          );
        })}

        <button
          onClick={onOpenAddAgent}
          className="ml-1 px-2 py-1 rounded-sm border border-accent-purple/40 text-accent-violet hover:bg-accent-purple/10"
          title="Hire agent"
        >
          <UserPlus size={12} />
        </button>

        <button
          onClick={onOpenContext}
          className="ml-1 px-2 py-1 rounded-sm border border-accent-green/40 text-accent-green hover:bg-accent-green/10"
          title="Company context"
        >
          <Flag size={12} />
        </button>
      </div>

      <div className="ml-auto flex items-center gap-1">
        {!keyOk && (
          <button
            onClick={onOpenSettings}
            className="px-2 py-1 rounded-sm border border-amber-400/50 text-amber-300 hover:bg-amber-400/10 flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider"
            title="Set your API key"
          >
            <AlertCircle size={12} /> No API key
          </button>
        )}
        <button
          onClick={onOpenDocs}
          className="px-2 py-1 rounded-sm border border-accent-purple/30 text-slate-300 hover:border-accent-purple"
          title="Documents"
        >
          <FileBox size={14} />
        </button>
        <button
          onClick={onOpenNotes}
          className="px-2 py-1 rounded-sm border border-accent-purple/30 text-slate-300 hover:border-accent-purple"
          title="Notes"
        >
          <FileText size={14} />
        </button>
        <span className="w-px h-5 bg-accent-purple/30 mx-1" />
        <button
          onClick={onOpenContext}
          className="px-2 py-1 rounded-sm border border-accent-purple/30 text-slate-300 hover:border-accent-purple"
          title="Company"
        >
          <Flag size={14} />
        </button>
        <button
          onClick={onOpenSettings}
          className="px-2 py-1 rounded-sm border border-accent-purple/30 text-slate-300 hover:border-accent-purple"
          title="Settings"
        >
          <Settings size={14} />
        </button>
        <button
          onClick={onOpenLogs}
          className={`relative px-2 py-1 rounded-sm border transition-colors ${
            logsOpen
              ? 'border-accent-violet text-accent-violet bg-accent-purple/15'
              : 'border-accent-purple/30 text-slate-300 hover:border-accent-purple'
          }`}
          title="Activity logs"
        >
          <Activity size={14} />
          {logsCount > 0 && (
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-accent-violet text-[8px] font-mono flex items-center justify-center text-white leading-none">
              {logsCount > 99 ? '!' : logsCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
