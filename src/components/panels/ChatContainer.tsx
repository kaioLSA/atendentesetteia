import { useEffect, useMemo, useRef, useState } from 'react';
import { Send, Trash2, UserMinus, AtSign, Briefcase } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { ROLE_DEFAULTS } from '../../services/agents/rolePrompts';

export function ChatContainer() {
  const agents = useStore((s) => s.agents);
  const activeAgentId = useStore((s) => s.activeAgentId);
  const messages = useStore((s) => s.messages);
  const sendMessage = useStore((s) => s.sendMessage);
  const clearChat = useStore((s) => s.clearChat);
  const removeAgent = useStore((s) => s.removeAgent);

  const agent = useMemo(
    () => agents.find((a) => a.id === activeAgentId),
    [agents, activeAgentId]
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

  const candidates =
    mentionQuery !== null && agent
      ? agents.filter(
          (a) =>
            a.id !== agent.id &&
            (a.id.startsWith(mentionQuery) ||
              a.name.toLowerCase().startsWith(mentionQuery))
        )
      : [];

  function pickMention(handle: string) {
    setText((t) => t.replace(/@[\w-]*$/, `@${handle} `));
    inputRef.current?.focus();
  }

  function handleSend() {
    if (!text.trim() || !activeAgentId) return;
    void sendMessage(activeAgentId, text);
    setText('');
  }

  if (!agent) {
    return (
      <div className="absolute right-0 top-0 bottom-0 w-[340px] panel rounded-none border-l border-y-0 border-r-0 z-20 flex items-center justify-center text-center px-6">
        <div className="text-slate-500">
          <p className="font-mono text-xs uppercase tracking-wider">
            No agent selected
          </p>
          <p className="text-[11px] mt-2">
            Click an avatar in the office or hire one from the top bar.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute right-0 top-0 bottom-0 w-[340px] panel rounded-none border-l border-y-0 border-r-0 z-20 flex flex-col">
      {/* Header */}
      <header className="panel-header">
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
                if (confirm(`Fire ${agent.name}?`)) removeAgent(agent.id);
              }}
              className="text-slate-400 hover:text-red-400 p-1"
              title="Fire agent"
            >
              <UserMinus size={14} />
            </button>
          )}
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-auto px-3 py-4 space-y-3">
        {list.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 select-none">
            <div
              className="text-3xl mb-3"
              style={{ color: agent.color }}
            >
              {agent.emoji || ROLE_DEFAULTS[agent.role].emoji}
            </div>
            <p className="font-mono text-sm text-slate-300">
              Start a conversation with{' '}
              <span style={{ color: agent.color }}>{agent.name}</span>
            </p>
            <p className="text-xs mt-2 text-accent-violet/70">
              Role: {agent.role} · Type @ to mention another agent
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
                    <p className="whitespace-pre-wrap leading-snug">
                      {highlightMentions(m.text)}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      <div className="relative border-t border-accent-purple/20 p-2 flex items-center gap-2">
        {mentionQuery !== null && candidates.length > 0 && (
          <div className="absolute bottom-full left-2 right-2 mb-1 panel max-h-40 overflow-auto z-30">
            {candidates.map((c) => (
              <button
                key={c.id}
                onClick={() => pickMention(c.id)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent-purple/15 text-left"
              >
                <span style={{ color: c.color }}>{c.emoji}</span>
                <span className="font-mono text-xs text-slate-200">
                  @{c.id}
                </span>
                <span className="ml-auto text-[10px] text-accent-violet/70 uppercase">
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
