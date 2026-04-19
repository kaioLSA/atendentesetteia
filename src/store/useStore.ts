import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/* ── Desk-arrival signaling ─────────────────────────────────────────────────
   The movement hook calls markAgentAtDesk(id, true) the moment an agent
   reaches their desk chair. sendMessage awaits waitForDesk() before calling
   the Claude API so agents always reply AFTER sitting down.               */
const _atDeskNow  = new Set<string>();
const _deskWaiters = new Map<string, Array<() => void>>();

export function markAgentAtDesk(agentId: string, arrived: boolean) {
  if (arrived) {
    if (_atDeskNow.has(agentId)) return; // already signalled — avoid duplicate fires
    _atDeskNow.add(agentId);
    // Push into Zustand directly so every subscriber (Grid, Desk) re-renders.
    useStore.setState((s) => (
      s.seatedAgents.includes(agentId)
        ? s
        : { seatedAgents: [...s.seatedAgents, agentId] }
    ));
    const waiters = _deskWaiters.get(agentId) ?? [];
    _deskWaiters.delete(agentId);
    waiters.forEach((cb) => cb());
  } else {
    _atDeskNow.delete(agentId);
    useStore.setState((s) => ({
      seatedAgents: s.seatedAgents.filter((id) => id !== agentId),
    }));
  }
}

function waitForDesk(agentId: string, maxMs = 12_000): Promise<void> {
  if (_atDeskNow.has(agentId)) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const list = _deskWaiters.get(agentId) ?? [];
    list.push(resolve);
    _deskWaiters.set(agentId, list);
    setTimeout(resolve, maxMs); // safety valve — never block forever
  });
}

import type {
  Agent,
  AgentRole,
  ChatMessage,
  CompanyContext,
  HireProposal,
  LogEntry,
  LogEventType,
  OfficeDocument,
  Task,
  TaskStatus,
  TaskPriority,
} from '../types';

/* -------------------------------------------------------------------------- */
/* Log helper — builds a LogEntry and pushes it to the store.                  */
/* -------------------------------------------------------------------------- */
function mkLog(
  type: LogEventType,
  text: string,
  opts: {
    agentId?: string;
    agentName?: string;
    agentEmoji?: string;
    agentColor?: string;
    detail?: string;
  } = {}
): LogEntry {
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    type,
    text,
    ...opts,
  };
}

function pushLog(entry: LogEntry) {
  // Keep last 200 entries to avoid unbounded growth
  useStore.setState((s) => ({
    logs: [entry, ...s.logs].slice(0, 200),
  }));
}

import { writeSharedMemory } from '../services/sharedMemory';
import { generateAgentReply } from '../services/agents/agentEngine';
import {
  callHrForProposal,
  summarizeConversationForMemory,
  uploadFileToAnthropic,
  type AttachedFile,
} from '../services/agents/claudeClient';
import { ROLE_DEFAULTS } from '../services/agents/rolePrompts';
import {
  requestNotificationPermission,
  sendAgentReplyNotification,
} from '../services/notifications';

/* -------------------------------------------------------------------------- */
/* Hire-via-CEO: parse natural language requests like "contrate um dev"        */
/* -------------------------------------------------------------------------- */

/** Portuguese + English keywords mapped to agent roles. */
const ROLE_KEYWORDS: { match: RegExp; role: AgentRole }[] = [
  { match: /\b(dev|devs|desenvolvedor|desenvolvedora|programador|programadora|engenheiro|engenheira|engineer|software)\b/i, role: 'engineer' },
  { match: /\b(designer|design|ux|ui)\b/i, role: 'designer' },
  { match: /\b(marketing|marketeiro|growth|copywriter)\b/i, role: 'marketing' },
  { match: /\b(vendedor|vendedora|vendas|sales|sdr|closer)\b/i, role: 'sales' },
  { match: /\b(analista|analyst|dados|data)\b/i, role: 'analyst' },
  { match: /\b(secret[aá]ri[oa]|secretary|assistente|executive assistant)\b/i, role: 'secretary' },
  { match: /\b(diretor|diretora|director)\b/i, role: 'director' },
];

const HIRE_VERBS = /\b(contrat[aáeíe]|contratar|contrate|contratamos|hire|hiring|recruit|recrutar|contrata)\b/i;

const FIRST_NAMES = [
  'Sofia', 'Miguel', 'Laura', 'Bruno', 'Helena', 'Diego', 'Clara',
  'Rafael', 'Aline', 'Tiago', 'Beatriz', 'Leo', 'Paula', 'Caio',
  'Nina', 'Rodrigo', 'Marina', 'Felipe', 'Julia', 'Gabriel',
];

function parseHireIntent(text: string): { role: AgentRole; requestedName?: string } | null {
  if (!HIRE_VERBS.test(text)) return null;
  for (const { match, role } of ROLE_KEYWORDS) {
    if (match.test(text)) {
      // Try to pick up a proper name after "chamado/chamada/named"
      const nameMatch = text.match(/\b(?:chamad[oa]|nome|named|called)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ÿ]+)/);
      return { role, requestedName: nameMatch?.[1] };
    }
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function pickUniqueName(existing: Agent[], preferred?: string): string {
  if (preferred && !existing.find((a) => a.name.toLowerCase() === preferred.toLowerCase())) {
    return preferred;
  }
  for (const n of FIRST_NAMES) {
    if (!existing.find((a) => a.name.toLowerCase() === n.toLowerCase())) return n;
  }
  return `Agent${existing.length + 1}`;
}

function makeAgentId(name: string, existing: Agent[]): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'agent';
  let id = base;
  let n = 1;
  while (existing.find((a) => a.id === id)) {
    id = `${base}-${n++}`;
  }
  return id;
}

/** Extract @mention handles from a text string */
function extractMentions(text: string): string[] {
  return Array.from(text.matchAll(/@([\w-]+)/g)).map((m) => m[1].toLowerCase());
}

/** Track whether notification permission has already been requested this session */
let _notifPermissionRequested = false;

interface StoreState {
  company: CompanyContext;
  agents: Agent[];
  activeAgentId: string | null;
  messages: Record<string, ChatMessage[]>;
  documents: OfficeDocument[];
  tasks: Task[];
  /** Agents currently in the chat tab — they walk to their desk */
  busyAgents: string[];
  /** Hire proposal waiting for user confirmation (shows the hire modal) */
  pendingHire: HireProposal | null;
  calledAgents: string[];
  /** Agents that are physically seated at their desk RIGHT NOW.
   *  Driven by markAgentAtDesk(); used for monitor green screen. */
  seatedAgents: string[];
  /** Company-wide activity log (newest first). */
  logs: LogEntry[];

  // ── Feature 3: Persistent Agent Memory ─────────────────────────────────
  /** Per-agent memory summaries persisted to localStorage */
  agentMemory: Record<string, string>;

  // ── Feature 5: Daily Briefing ───────────────────────────────────────────
  dailyBriefingEnabled: boolean;
  dailyBriefingTime: string; // "HH:MM"
  lastBriefingDate: string;  // "YYYY-MM-DD"

  setCompany: (c: CompanyContext) => void;
  setActiveAgent: (id: string | null) => void;
  addAgent: (a: Omit<Agent, 'desk'>) => void;
  removeAgent: (id: string) => void;
  sendMessage: (agentId: string, text: string, files?: File[]) => Promise<void>;
  clearChat: (agentId: string) => void;
  addDocument: (doc: OfficeDocument) => void;
  removeDocument: (id: string) => void;
  createTask: (title: string, description: string, assignedTo: string, priority: TaskPriority) => void;
  updateTaskStatus: (taskId: string, status: TaskStatus) => void;
  deleteTask: (taskId: string) => void;
  resetAll: () => void;
  setPendingHire: (p: HireProposal | null) => void;
  confirmHire: (proposal: HireProposal) => void;
  /** Click-on-chair test: agent walks to desk, sits ~3 s, then wanders. */
  sitAtDesk: (agentId: string) => void;

  // Memory
  updateAgentMemory: (agentId: string, memory: string) => void;

  // Daily briefing
  setDailyBriefingEnabled: (v: boolean) => void;
  setDailyBriefingTime: (t: string) => void;
  setLastBriefingDate: (d: string) => void;
  sendDailyBriefing: () => Promise<void>;
}

const emptyCompany: CompanyContext = {
  companyName: '',
  mission: '',
  products: '',
  culture: '',
  notes: '',
};

const ceo: Agent = {
  id: 'ceo',
  name: 'CEO',
  role: 'director',
  title: 'Director',
  color: ROLE_DEFAULTS.director.color,
  emoji: ROLE_DEFAULTS.director.emoji,
  desk: 0,
  gender: 'male',
};

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      company: emptyCompany,
      agents: [ceo],
      activeAgentId: 'ceo',
      messages: {},
      documents: [],
      tasks: [],
      busyAgents: [],
      pendingHire: null,
      calledAgents: [],
      seatedAgents: [],
      logs: [],

      // Feature 3
      agentMemory: {},

      // Feature 5
      dailyBriefingEnabled: false,
      dailyBriefingTime: '09:00',
      lastBriefingDate: '',

      setCompany: (c) => {
        set({ company: c });
        writeSharedMemory('context.json', c);
        pushLog(mkLog('company_update',
          `🏢 Contexto da empresa atualizado${c.companyName ? ` — ${c.companyName}` : ''}`,
          { detail: c.mission || undefined }
        ));
      },

      setActiveAgent: (id) =>
        set(() => ({
          // Opening a chat no longer makes the agent "busy" — they keep
          // wandering until you actually send a message (a real task).
          activeAgentId: id,
        })),

      addAgent: (a) =>
        set((s) => {
          const agent = {
            ...a,
            desk: s.agents.length,
            gender:
              (a as Agent).gender ??
              (Math.random() < 0.5 ? 'male' : 'female'),
          } as Agent;
          pushLog(mkLog('hire', `${agent.emoji} ${agent.name} foi contratado(a) como ${agent.title}`, {
            agentId: agent.id, agentName: agent.name,
            agentEmoji: agent.emoji, agentColor: agent.color,
          }));
          return { agents: [...s.agents, agent] };
        }),

      removeAgent: (id) =>
        set((s) => {
          const leaving = s.agents.find((a) => a.id === id);
          if (leaving) {
            pushLog(mkLog('fire', `${leaving.emoji} ${leaving.name} saiu da empresa`, {
              agentId: leaving.id, agentName: leaving.name,
              agentEmoji: leaving.emoji, agentColor: leaving.color,
            }));
          }
          const next = s.agents.filter((a) => a.id !== id);
          const newMessages = { ...s.messages };
          delete newMessages[id];
          return {
            agents: next,
            activeAgentId:
              s.activeAgentId === id ? next[0]?.id ?? null : s.activeAgentId,
            messages: newMessages,
            busyAgents: s.busyAgents.filter((b) => b !== id),
          };
        }),

      clearChat: (agentId) =>
        set((s) => {
          const next = { ...s.messages };
          delete next[agentId];
          return { messages: next };
        }),

      addDocument: (doc) => {
        pushLog(mkLog('document_add', `📄 Documento "${doc.title}" adicionado por ${doc.authorName}`, {
          agentId: doc.authorId, agentName: doc.authorName, agentEmoji: doc.authorEmoji,
          detail: doc.title,
        }));
        set((s) => ({ documents: [doc, ...s.documents] }));
      },

      removeDocument: (id) =>
        set((s) => {
          const doc = s.documents.find((d) => d.id === id);
          if (doc) {
            pushLog(mkLog('document_remove', `🗑️ Documento "${doc.title}" removido`));
          }
          return { documents: s.documents.filter((d) => d.id !== id) };
        }),

      createTask: (title, description, assignedTo, priority) =>
        set((s) => {
          const now = Date.now();
          const task: Task = {
            id: crypto.randomUUID(),
            title,
            description,
            assignedTo,
            status: 'pending',
            priority,
            createdAt: now,
            updatedAt: now,
          };
          const agent = s.agents.find((a) => a.id === assignedTo);
          pushLog(mkLog('task_start', `📋 Tarefa "${title}" criada${agent ? ` para ${agent.emoji} ${agent.name}` : ''}`, {
            agentId: agent?.id, agentName: agent?.name,
            agentEmoji: agent?.emoji, agentColor: agent?.color,
            detail: description || undefined,
          }));
          return { tasks: [task, ...s.tasks] };
        }),

      updateTaskStatus: (taskId, status) =>
        set((s) => {
          const now = Date.now();
          const tasks = s.tasks.map((t) => {
            if (t.id !== taskId) return t;
            const updated: Task = {
              ...t,
              status,
              updatedAt: now,
              completedAt: status === 'done' ? now : t.completedAt,
            };
            const agent = s.agents.find((a) => a.id === t.assignedTo);
            if (status === 'done') {
              pushLog(mkLog('task_done', `✅ Tarefa "${t.title}" concluída${agent ? ` por ${agent.emoji} ${agent.name}` : ''}`, {
                agentId: agent?.id, agentName: agent?.name,
                agentEmoji: agent?.emoji, agentColor: agent?.color,
              }));
            } else if (status === 'in_progress') {
              pushLog(mkLog('task_start', `▶️ Tarefa "${t.title}" em progresso${agent ? ` — ${agent.emoji} ${agent.name}` : ''}`, {
                agentId: agent?.id, agentName: agent?.name,
                agentEmoji: agent?.emoji, agentColor: agent?.color,
              }));
            }
            return updated;
          });
          return { tasks };
        }),

      deleteTask: (taskId) =>
        set((s) => ({ tasks: s.tasks.filter((t) => t.id !== taskId) })),

      resetAll: () => {
        pushLog(mkLog('reset', '🔄 Escritório reiniciado — todos os dados foram apagados'));
        set({
          company: emptyCompany,
          agents: [ceo],
          activeAgentId: 'ceo',
          messages: {},
          documents: [],
          tasks: [],
          busyAgents: [],
          pendingHire: null,
          calledAgents: [],
          seatedAgents: [],
          logs: [mkLog('reset', '🔄 Escritório reiniciado')],
          agentMemory: {},
        });
        writeSharedMemory('context.json', emptyCompany);
      },

      setPendingHire: (p) => set({ pendingHire: p }),

      sitAtDesk: (agentId) => {
        if (
          get().busyAgents.includes(agentId) ||
          get().calledAgents.includes(agentId)
        ) return;
        const agent = get().agents.find((a) => a.id === agentId);
        if (agent) {
          pushLog(mkLog('desk_visit', `${agent.emoji} ${agent.name} foi chamado(a) para a mesa`, {
            agentId: agent.id, agentName: agent.name,
            agentEmoji: agent.emoji, agentColor: agent.color,
          }));
        }
        set((s) => ({ calledAgents: [...s.calledAgents, agentId] }));
        waitForDesk(agentId, 12_000)
          .then(() => new Promise<void>((r) => setTimeout(r, 3000)))
          .then(() => {
            set((s) => ({
              calledAgents: s.calledAgents.filter((id) => id !== agentId),
            }));
          });
      },

      confirmHire: (proposal) => {
        const existing = get().agents;
        const id = makeAgentId(proposal.name, existing);
        const newAgent: Agent = {
          id,
          name: proposal.name,
          role: proposal.role,
          title: proposal.title,
          color: proposal.color,
          emoji: proposal.emoji,
          desk: existing.length,
          gender: proposal.gender,
          skinTone: proposal.skinTone,
          specialty: proposal.specialty,
        };
        set((s) => ({ agents: [...s.agents, newAgent], pendingHire: null }));
        pushLog(mkLog('hire', `${proposal.emoji} ${proposal.name} contratado(a) como ${proposal.title} via RH`, {
          agentId: id, agentName: proposal.name,
          agentEmoji: proposal.emoji, agentColor: proposal.color,
          detail: proposal.specialty,
        }));

        // Announce in CEO chat
        const announcement: ChatMessage = {
          id: crypto.randomUUID(),
          agentId: 'ceo',
          authorId: 'ceo',
          authorName: 'CEO',
          text: `✨ **${proposal.name}** (${proposal.title}) acaba de se juntar ao time! ${proposal.description} Fale com @${id} para começar.`,
          timestamp: Date.now(),
        };
        set((s) => ({
          messages: {
            ...s.messages,
            ceo: [...(s.messages['ceo'] ?? []), announcement],
          },
        }));
      },

      // ── Feature 3: Memory ──────────────────────────────────────────────
      updateAgentMemory: (agentId, memory) =>
        set((s) => ({
          agentMemory: { ...s.agentMemory, [agentId]: memory },
        })),

      // ── Feature 5: Daily Briefing ───────────────────────────────────────
      setDailyBriefingEnabled: (v) => set({ dailyBriefingEnabled: v }),
      setDailyBriefingTime: (t) => set({ dailyBriefingTime: t }),
      setLastBriefingDate: (d) => set({ lastBriefingDate: d }),

      sendDailyBriefing: async () => {
        const state = get();
        const ceoAgent = state.agents.find((a) => a.id === 'ceo');
        if (!ceoAgent) return;

        const activeCount = state.agents.length;
        const taskCount = state.tasks.filter((t) => t.status !== 'done').length;

        const briefingText = await generateAgentReply({
          agent: ceoAgent,
          history: [],
          userText: `Escreva o briefing matinal da empresa. Contexto: ${activeCount} agente(s) ativo(s), ${taskCount} tarefas pendentes. Inclua: status da empresa, destaques do dia, mensagem motivacional para o time. Seja direto e natural como no WhatsApp corporativo.`,
          company: state.company,
          teammates: state.agents.filter((a) => a.id !== 'ceo'),
          memory: state.agentMemory['ceo'],
        });

        const briefingMsg: ChatMessage = {
          id: crypto.randomUUID(),
          agentId: 'ceo',
          authorId: 'ceo',
          authorName: 'CEO',
          text: briefingText,
          timestamp: Date.now(),
        };

        set((s) => ({
          messages: {
            ...s.messages,
            ceo: [...(s.messages['ceo'] ?? []), briefingMsg],
          },
        }));

        pushLog(mkLog('company_update',
          `📋 Briefing diário enviado pelo CEO`,
          { agentId: 'ceo', agentName: 'CEO', agentEmoji: ceoAgent.emoji, agentColor: ceoAgent.color }
        ));
      },

      // ── Feature 4 + 6: sendMessage with collaboration & file sharing ───
      sendMessage: async (agentId, text, files?: File[]) => {
        const trimmed = text.trim();
        if (!trimmed) return;

        // Feature 1: request notification permission on first message
        if (!_notifPermissionRequested) {
          _notifPermissionRequested = true;
          requestNotificationPermission();
        }

        // Feature 6: upload files before doing anything else
        let attachedFiles: AttachedFile[] = [];
        if (files && files.length > 0) {
          const uploads = await Promise.allSettled(
            files.map(async (f) => {
              const fileId = await uploadFileToAnthropic(f);
              return { fileId, mediaType: f.type || 'application/octet-stream', name: f.name } as AttachedFile;
            })
          );
          attachedFiles = uploads
            .filter((r): r is PromiseFulfilledResult<AttachedFile> => r.status === 'fulfilled')
            .map((r) => r.value);
        }

        const mentions = extractMentions(trimmed);

        // 1. push user message + log it
        const userMsg: ChatMessage = {
          id: crypto.randomUUID(),
          agentId,
          authorId: 'user',
          authorName: 'You',
          text: trimmed,
          timestamp: Date.now(),
          mentions,
        };
        set((s) => ({
          messages: {
            ...s.messages,
            [agentId]: [...(s.messages[agentId] ?? []), userMsg],
          },
        }));
        const targetAgent = get().agents.find((a) => a.id === agentId);
        if (targetAgent) {
          pushLog(mkLog('message_sent',
            `💬 Você enviou uma mensagem para ${targetAgent.emoji} ${targetAgent.name}`,
            {
              agentId: targetAgent.id, agentName: targetAgent.name,
              agentEmoji: targetAgent.emoji, agentColor: targetAgent.color,
              detail: trimmed.slice(0, 120),
            }
          ));
        }

        // 1b. Hire intent: CEO delegates to HR, HR generates a proposal that
        //     the user must confirm before the agent is actually created.
        if (agentId === 'ceo') {
          const hire = parseHireIntent(trimmed);
          if (hire) {
            const existing = get().agents;

            // Ensure the HR agent exists (create silently on first hire request)
            let hrAgent = existing.find((a) => a.role === 'hr');
            if (!hrAgent) {
              const hrDefaults = ROLE_DEFAULTS.hr;
              hrAgent = {
                id: 'hr',
                name: 'RH',
                role: 'hr',
                title: hrDefaults.titleSuggestion,
                color: hrDefaults.color,
                emoji: hrDefaults.emoji,
                desk: existing.length,
                gender: 'female',
                skinTone: 'medium',
              } as Agent;
              set((s) => ({ agents: [...s.agents, hrAgent!] }));
            }

            // Call HR (Claude) to generate a proposal — fires in background,
            // the CEO still replies in parallel (handled below in step 3).
            const company = get().company;
            const agentsAtTime = get().agents;
            callHrForProposal(trimmed, company, agentsAtTime).then((proposal) => {
              if (proposal) {
                set({ pendingHire: proposal });
              }
            });
          }
        }

        // 2. work out who replies (primary + mentioned)
        const all = get().agents;
        const primary = all.find((a) => a.id === agentId);
        if (!primary) return;

        const respondents: Agent[] = [primary];
        for (const handle of mentions) {
          const a = all.find(
            (x) => x.id === handle || x.name.toLowerCase() === handle
          );
          if (a && a.id !== primary.id && !respondents.includes(a)) {
            respondents.push(a);
          }
        }

        // mark all respondents busy (they walk to their desks) + log
        set((s) => ({
          busyAgents: Array.from(
            new Set([...s.busyAgents, ...respondents.map((r) => r.id)])
          ),
        }));
        respondents.forEach((r) => {
          pushLog(mkLog('task_start', `${r.emoji} ${r.name} está indo para a mesa trabalhar`, {
            agentId: r.id, agentName: r.name,
            agentEmoji: r.emoji, agentColor: r.color,
          }));
        });

        // 3. fire each reply — but only AFTER the agent reaches their desk and
        //    settles for 2 s (the thinking bubble shows the whole time).
        await Promise.all(
          respondents.map(async (agent, i) => {
            // Wait until the movement hook signals this agent is seated.
            await waitForDesk(agent.id);
            // 2-second pause so the user can see the agent sitting before typing.
            await new Promise((r) => setTimeout(r, 2000));

            const placeholderId = crypto.randomUUID();
            const placeholder: ChatMessage = {
              id: placeholderId,
              agentId,
              authorId: agent.id,
              authorName:
                agent.id === primary.id
                  ? agent.name
                  : `${agent.name} (mentioned)`,
              text: '...',
              timestamp: Date.now() + i,
              pending: true,
            };
            set((s) => ({
              messages: {
                ...s.messages,
                [agentId]: [...(s.messages[agentId] ?? []), placeholder],
              },
            }));

            const history = (get().messages[agentId] ?? []).filter(
              (m) => m.id !== placeholderId
            );

            // Feature 3: pass current memory
            const memory = get().agentMemory[agent.id];

            const reply = await generateAgentReply({
              agent,
              history,
              userText: trimmed,
              company: get().company,
              teammates: get().agents.filter((a) => a.id !== agent.id),
              memory,
              attachedFiles: attachedFiles.length > 0 ? attachedFiles : undefined,
            });

            set((s) => ({
              messages: {
                ...s.messages,
                [agentId]: (s.messages[agentId] ?? []).map((m) =>
                  m.id === placeholderId
                    ? { ...m, text: reply, pending: false, timestamp: Date.now() }
                    : m
                ),
              },
            }));

            // Feature 1: browser notification if window is blurred
            sendAgentReplyNotification(agent.name, agent.emoji, reply);

            // Log the completed reply
            pushLog(mkLog('agent_reply',
              `${agent.emoji} ${agent.name} respondeu sua mensagem`,
              {
                agentId: agent.id, agentName: agent.name,
                agentEmoji: agent.emoji, agentColor: agent.color,
                detail: reply.slice(0, 120),
              }
            ));

            // Feature 3: async memory summarisation (fire-and-forget)
            const historyForMemory = (get().messages[agentId] ?? []).filter(
              (m) => !m.pending
            );
            summarizeConversationForMemory(
              agent.name,
              historyForMemory,
              get().agentMemory[agent.id] ?? ''
            ).then((newMemory) => {
              if (newMemory) get().updateAgentMemory(agent.id, newMemory);
            });

            // Feature 4: collaboration — if reply mentions other agents, trigger them
            const replyMentions = extractMentions(reply);
            const respondentIds = new Set(respondents.map((r) => r.id));
            for (const handle of replyMentions) {
              if (handle === 'user') continue;
              const mentioned = get().agents.find(
                (x) => x.id === handle || x.name.toLowerCase() === handle
              );
              if (!mentioned || respondentIds.has(mentioned.id)) continue;

              // Trigger mentioned agent as collaboration (don't await — let it run async)
              triggerCollaboration(
                agentId,
                mentioned,
                `${trimmed}\n\n[${agent.name} mencionou você]: ${reply}`,
                get
              );
            }
          })
        );

        // 4. everyone leaves their desk once the reply is done
        const respondentIds = new Set(respondents.map((r) => r.id));
        respondents.forEach((r) => {
          pushLog(mkLog('task_done', `${r.emoji} ${r.name} terminou e voltou a caminhar`, {
            agentId: r.id, agentName: r.name,
            agentEmoji: r.emoji, agentColor: r.color,
          }));
        });
        set((s) => ({
          busyAgents: s.busyAgents.filter((id) => !respondentIds.has(id)),
        }));
      },
    }),
    {
      name: 'pixel_agents:store',
      partialize: (s) => ({
        company: s.company,
        agents: s.agents,
        documents: s.documents,
        messages: s.messages,
        tasks: s.tasks,
        agentMemory: s.agentMemory,
        dailyBriefingEnabled: s.dailyBriefingEnabled,
        dailyBriefingTime: s.dailyBriefingTime,
        lastBriefingDate: s.lastBriefingDate,
      }),
    }
  )
);

/* -------------------------------------------------------------------------- */
/* Feature 4: Agent Collaboration helper (outside the store so it can be      */
/* called without circular closures in the create() body).                    */
/* -------------------------------------------------------------------------- */
async function triggerCollaboration(
  chatAgentId: string,
  mentionedAgent: Agent,
  context: string,
  get: () => StoreState,
) {
  // Avoid double-triggering if already busy
  if (get().busyAgents.includes(mentionedAgent.id)) return;

  useStore.setState((s) => ({
    busyAgents: Array.from(new Set([...s.busyAgents, mentionedAgent.id])),
  }));

  pushLog(mkLog('task_start',
    `${mentionedAgent.emoji} ${mentionedAgent.name} foi mencionado e está colaborando`,
    {
      agentId: mentionedAgent.id, agentName: mentionedAgent.name,
      agentEmoji: mentionedAgent.emoji, agentColor: mentionedAgent.color,
    }
  ));

  await waitForDesk(mentionedAgent.id);
  await new Promise((r) => setTimeout(r, 1500));

  const placeholderId = crypto.randomUUID();
  const placeholder: ChatMessage = {
    id: placeholderId,
    agentId: chatAgentId,
    authorId: mentionedAgent.id,
    authorName: `${mentionedAgent.name} (colaboração)`,
    text: '...',
    timestamp: Date.now(),
    pending: true,
  };

  useStore.setState((s) => ({
    messages: {
      ...s.messages,
      [chatAgentId]: [...(s.messages[chatAgentId] ?? []), placeholder],
    },
  }));

  const history = (get().messages[chatAgentId] ?? []).filter(
    (m) => m.id !== placeholderId
  );
  const memory = get().agentMemory[mentionedAgent.id];

  const reply = await generateAgentReply({
    agent: mentionedAgent,
    history,
    userText: context,
    company: get().company,
    teammates: get().agents.filter((a) => a.id !== mentionedAgent.id),
    memory,
  });

  useStore.setState((s) => ({
    messages: {
      ...s.messages,
      [chatAgentId]: (s.messages[chatAgentId] ?? []).map((m) =>
        m.id === placeholderId
          ? { ...m, text: reply, pending: false, timestamp: Date.now() }
          : m
      ),
    },
    busyAgents: s.busyAgents.filter((id) => id !== mentionedAgent.id),
  }));

  sendAgentReplyNotification(mentionedAgent.name, mentionedAgent.emoji, reply);

  pushLog(mkLog('agent_reply',
    `${mentionedAgent.emoji} ${mentionedAgent.name} colaborou no chat`,
    {
      agentId: mentionedAgent.id, agentName: mentionedAgent.name,
      agentEmoji: mentionedAgent.emoji, agentColor: mentionedAgent.color,
      detail: reply.slice(0, 120),
    }
  ));

  // Update memory for collaborating agent too
  const historyForMemory = (get().messages[chatAgentId] ?? []).filter((m) => !m.pending);
  summarizeConversationForMemory(
    mentionedAgent.name,
    historyForMemory,
    get().agentMemory[mentionedAgent.id] ?? ''
  ).then((newMemory) => {
    if (newMemory) get().updateAgentMemory(mentionedAgent.id, newMemory);
  });
}
