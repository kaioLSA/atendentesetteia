import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Send, Trash2, UserMinus, AtSign, Briefcase, Users } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { ROLE_DEFAULTS } from '../../services/agents/rolePrompts';
import { TaskBar } from './TaskBar';

export function ChatContainer() {
  const agents = useStore((s) => s.agents);
  const squads = useStore((s) => s.squads);
  const activeAgentId = useStore((s) => s.activeAgentId);
  const messages = useStore((s) => s.messages);
  const sendMessage = useStore((s) => s.sendMessage);
  const clearChat = useStore((s) => s.clearChat);
  const removeAgent = useStore((s) => s.removeAgent);
  const updateSquadName = useStore((s) => s.updateSquadName);

  const agent = useMemo(
    () => agents.find((a) => a.id === activeAgentId),
    [agents, activeAgentId]
  );
  const squad = useMemo(
    () => squads.find((s) => s.id === activeAgentId),
    [squads, activeAgentId]
  );
  const list = activeAgentId ? messages[activeAgentId] ?? [] : [];

  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 9e9, behavior: 'smooth' });
  }, [list.length, activeAgentId]);

  // @mention autocomplete
  const mentionQuery = useMemo(() => {
    const m = text.match(/@([\w-]*)$/);
    return m ? m[1].toLowerCase() : null;
  }, [text]);

  const candidates = useMemo(() => {
    if (mentionQuery === null) return [];
    
    // Combine agents and squads for mention
    const agentCandidates = (squad
      ? agents.filter(a => (squad.agentIds.includes(a.id) || a.id === 'ceo') && a.id !== activeAgentId)
      : agents.filter(a => a.id !== activeAgentId)
    ).map(a => ({ id: a.id, name: a.name, emoji: a.emoji, title: a.title, color: a.color, type: 'agent' }));

    const squadCandidates = squads
      .filter(sq => sq.id !== activeAgentId)
      .map(sq => ({ id: sq.id, name: sq.name, emoji: sq.emoji || '🚀', title: 'Squad', color: '#22d3ee', type: 'squad' }));

    const all = [...agentCandidates, ...squadCandidates];
    
    return all.filter(c => 
      c.id.toLowerCase().startsWith(mentionQuery) ||
      c.name.toLowerCase().startsWith(mentionQuery)
    );
  }, [mentionQuery, agents, squads, squad, activeAgentId]);

  function pickMention(handle: string) {
    setText((t) => t.replace(/@[\w-]*$/, `@${handle} `));
    inputRef.current?.focus();
  }

  function handleSend() {
    if (!text.trim() || !activeAgentId) return;
    void sendMessage(activeAgentId, text);
    setText('');
  }

  if (!agent && !squad) {
    return (
      <div className="absolute right-0 top-0 bottom-0 w-[340px] panel rounded-none border-l border-y-0 border-r-0 z-20 flex items-center justify-center text-center px-6">
        <div className="text-slate-500">
          <p className="font-mono text-xs uppercase tracking-wider">
            Nenhuma conversa selecionada
          </p>
          <p className="text-[11px] mt-2">
            Selecione um agente ou esquadrão no topo para começar.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`absolute right-0 top-0 bottom-0 w-[340px] panel rounded-none border-l border-y-0 border-r-0 z-20 flex flex-col transition-all duration-500 ${
      squad ? 'border-accent-cyan/40 shadow-[-10px_0_30px_rgba(34,211,238,0.05)] bg-slate-900/90' : ''
    }`}>
      {/* Header */}
      <header className={`panel-header ${squad ? 'border-b border-accent-cyan/30 bg-accent-cyan/5' : ''}`}>
        {agent ? (
          <>
            <div className="flex items-center gap-2 min-w-0">
              <Briefcase size={14} style={{ color: agent.color }} />
              <span className="font-mono text-sm text-slate-100 truncate">
                {agent.name}
              </span>
              <span
                className="pixel-tag"
                style={{
                  borderColor: agent.color + '66',
                  color: agent.color,
                }}
              >
                {agent.title}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => clearChat(agent.id)}
                className="text-slate-400 hover:text-white p-1"
                title="Clear chat"
              >
                <Trash2 size={14} />
              </button>
              {agent.id !== 'ceo' && (
                <button
                  onClick={() => {
                    if (confirm(`Demitir ${agent.name}?`)) removeAgent(agent.id);
                  }}
                  className="text-slate-400 hover:text-red-400 p-1"
                  title="Fire agent"
                >
                  <UserMinus size={14} />
                </button>
              )}
            </div>
          </>
        ) : squad ? (
          <>
            <div className="flex items-center gap-2 min-w-0">
              <Users size={14} className="text-accent-cyan" />
              <button 
                onClick={() => {
                  const newName = prompt('Novo nome para o Squad:', squad.name);
                  if (newName && newName.trim()) updateSquadName(squad.id, newName.trim());
                }}
                className="font-mono text-sm text-slate-100 truncate hover:text-accent-cyan transition-colors"
                title="Clique para renomear"
              >
                {squad.name}
              </button>
              <span className="text-[9px] text-accent-cyan/60 uppercase font-mono tracking-tighter">
                {squad.agentIds.length} Membros
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => clearChat(squad.id)}
                className="text-slate-400 hover:text-white p-1"
                title="Clear chat"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </>
        ) : null}
      </header>

      {/* Squad Members Mini Bar */}
      {squad && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-cyan/5 border-b border-accent-cyan/10 overflow-x-auto no-scrollbar">
          {squad.agentIds.map(id => {
            const a = agents.find(x => x.id === id);
            if (!a) return null;
            return (
              <div 
                key={a.id} 
                className="flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-accent-cyan/20 bg-accent-cyan/10"
                title={a.title}
              >
                <span className="text-[10px]">{a.emoji}</span>
                <span className="text-[9px] font-mono text-accent-cyan tracking-tight">{a.name}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Messages */}
      <div 
        ref={scrollRef} 
        className={`flex-1 overflow-auto px-3 py-4 space-y-3 ${squad ? 'bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.03)_1px,transparent_1px)] bg-[size:16px_16px]' : ''}`}
      >
        {list.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 select-none">
            <div
              className="text-3xl mb-3"
              style={{ color: agent?.color || 'var(--accent-cyan)' }}
            >
              {agent ? (agent.emoji || ROLE_DEFAULTS[agent.role].emoji) : '🚀'}
            </div>
            <p className="font-mono text-sm text-slate-300">
              {agent ? (
                <>
                  Start a conversation with{' '}
                  <span style={{ color: agent.color }}>{agent.name}</span>
                </>
              ) : (
                <>Chat do Esquadrão {squad?.name}</>
              )}
            </p>
            <p className="text-xs mt-2 text-accent-violet/70">
              {agent ? `Role: ${agent.role} · Type @ to mention another agent` : 'As mensagens aqui são compartilhadas por todo o squad.'}
            </p>
          </div>
        ) : (
          list.map((m) => {
            const fromUser = m.authorId === 'user';
            return (
              <div
                key={m.id}
                className={`flex ${fromUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-sm border text-sm ${
                    fromUser
                      ? 'bg-accent-purple/15 border-accent-purple/40 text-slate-100'
                      : 'bg-bg-700/70 border-accent-purple/20 text-slate-200'
                  }`}
                >
                  <div className="text-[10px] font-mono uppercase tracking-wider text-accent-violet/70 mb-1">
                    {m.authorName}
                  </div>
                  {m.pending ? (
                    <p className="text-slate-400 italic animate-pulse">
                      thinking...
                    </p>
                  ) : (
                    <div className="markdown-container text-slate-200 leading-snug">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {m.text}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Taskbar */}
      {agent && <TaskBar agentId={agent.id} />}

      {/* Input */}
      <div className="relative border-t border-accent-purple/20 p-2 flex items-center gap-2">
        {mentionQuery !== null && candidates.length > 0 && (
          <div className="absolute bottom-full left-2 right-2 mb-1 panel max-h-40 overflow-auto z-30">
            {candidates.map((c) => (
              <button
                key={c.id}
                onClick={() => pickMention(c.id)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent-purple/15 text-left border-b border-white/5 last:border-0"
              >
                <span style={{ color: c.color }}>{c.emoji}</span>
                <div className="flex flex-col">
                  <span className="font-mono text-[11px] text-slate-100">
                    @{c.id}
                  </span>
                  <span className="text-[9px] text-slate-500 uppercase tracking-tighter">
                    {c.name}
                  </span>
                </div>
                <span className={`ml-auto text-[8px] px-1.5 py-0.5 rounded-full border ${
                  c.type === 'squad' ? 'border-accent-cyan/30 text-accent-cyan bg-accent-cyan/5' : 'border-accent-violet/30 text-accent-violet/70'
                } uppercase font-mono`}>
                  {c.title}
                </span>
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => setText((t) => t + '@')}
          className="text-slate-400 hover:text-white p-1"
          title="Mention agent"
        >
          <AtSign size={16} />
        </button>
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type your message... (@ to mention)"
          className="pixel-input flex-1"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim()}
          className="bg-gradient-to-b from-accent-purple to-accent-indigo p-2 rounded-sm shadow-glow text-white disabled:opacity-40"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}

function highlightMentions(text: string) {
  return text.split(/(@[\w-]+)/g).map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} className="text-accent-cyan font-mono">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}
