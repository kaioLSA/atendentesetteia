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
  callAgent,
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
/* Hire-via-CEO: detect any hiring intent and delegate to RH                  */
/* -------------------------------------------------------------------------- */

/**
 * Returns true if the message contains a hiring intent in Portuguese or English.
 * We no longer restrict to predefined roles — any job description is valid.
 * The Claude HR agent figures out the details.
 */
const HIRE_VERBS = /\b(contrat[aáeíe]|contratar|contrate|contratamos|hire|hiring|recruit|recrutar|contrata|precisamos de|quero um|quero uma|adiciona um|adiciona uma|cria um|cria uma)\b/i;

function hasHireIntent(text: string): boolean {
  return HIRE_VERBS.test(text);
}

const FIRE_VERBS = /\b(demita|demit[io]|demitir|manda embora|mandar embora|fire|dismiss|remove|remover|delete|deletar|apagar|excluir|tire|tira|limpar|limpa)\b/i;

function hasFireIntent(text: string): boolean {
  return FIRE_VERBS.test(text);
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
  squads: import('../types').Squad[];
  activeAgentId: string | null;
  messages: Record<string, ChatMessage[]>;
  documents: OfficeDocument[];
  tasks: Task[];
  /** Agents currently in the chat tab — they walk to their desk */
  busyAgents: string[];
  thinkingAgents: string[];
  /** Hire proposal waiting for user confirmation (shows the hire modal) */
  pendingHire: HireProposal | null;
  calledAgents: string[];
  
  // ── Squad Builder ────────────────────────────────────────────────────────
  isSquadBuilderOpen: boolean;
  setSquadBuilderOpen: (o: boolean) => void;
  triggerSquadBuilder: () => void;
  executeSquadBuilder: (answers: import('../types').SquadBuilderAnswers) => Promise<void>;
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

  // ── Feature 12: Multi-floor / Rooms ────────────────────────────────────
  currentFloor: number;
  setFloor: (floor: number) => void;

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
  updateSquadName: (squadId: string, name: string) => void;
  moveAgentToFloor: (agentId: string, floor: number) => void;
  moveSquadToFloor: (squadId: string, floor: number) => void;

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
  floor: 0,
};

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      company: emptyCompany,
      agents: [ceo],
      squads: [],
      activeAgentId: 'ceo',
      messages: {},
      documents: [],
      tasks: [],
      busyAgents: [],
      pendingHire: null,
      calledAgents: [],
      isSquadBuilderOpen: false,
      seatedAgents: [],
      logs: [],
      thinkingAgents: [],

      // Feature 3
      agentMemory: {},

      // Feature 5
      dailyBriefingEnabled: false,
      dailyBriefingTime: '09:00',
      lastBriefingDate: '',

      // Feature 12
      currentFloor: 0,
      setFloor: (floor) => set({ currentFloor: floor }),

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
            floor: s.currentFloor,
          } as Agent;
          pushLog(mkLog('hire', `${agent.emoji} ${agent.name} foi contratado(a) como ${agent.title}`, {
            agentId: agent.id, agentName: agent.name,
            agentEmoji: agent.emoji, agentColor: agent.color,
            detail: agent.specialty ? `Especialidade: ${agent.specialty}` : undefined,
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
            calledAgents: s.calledAgents.filter((b) => b !== id),
            seatedAgents: s.seatedAgents.filter((b) => b !== id),
            squads: s.squads.map(sq => ({
              ...sq,
              agentIds: sq.agentIds.filter(aid => aid !== id)
            })).filter(sq => sq.agentIds.length > 0)
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
          let targetAgentId = '';
          const tasks = s.tasks.map((t) => {
            if (t.id !== taskId) return t;
            targetAgentId = t.assignedTo;
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
                detail: t.description || undefined,
              }));
            } else if (status === 'in_progress') {
              pushLog(mkLog('task_start', `▶️ Tarefa "${t.title}" em progresso${agent ? ` — ${agent.emoji} ${agent.name}` : ''}`, {
                agentId: agent?.id, agentName: agent?.name,
                agentEmoji: agent?.emoji, agentColor: agent?.color,
                detail: t.description || undefined,
              }));
            }
            return updated;
          });

          // Feature 4: Agent "takes" the task by becoming busy (walks to desk)
          let busyAgents = [...s.busyAgents];
          if (status === 'in_progress' && targetAgentId) {
            if (!busyAgents.includes(targetAgentId)) {
              busyAgents.push(targetAgentId);
            }
          } else if (status === 'done' && targetAgentId) {
            // Only remove from busyAgents if they have no other in_progress tasks
            const stillBusy = tasks.some(t => t.assignedTo === targetAgentId && t.status === 'in_progress');
            if (!stillBusy) {
              busyAgents = busyAgents.filter(id => id !== targetAgentId);
            }
          }

          return { tasks, busyAgents };
        }),

      deleteTask: (taskId) =>
        set((s) => ({ tasks: s.tasks.filter((t) => t.id !== taskId) })),

      resetAll: () => {
        pushLog(mkLog('reset', '🔄 Escritório reiniciado — todos os dados foram apagados'));
        set({
          company: emptyCompany,
          agents: [ceo],
          squads: [],
          activeAgentId: 'ceo',
          messages: {},
          documents: [],
          tasks: [],
          busyAgents: [],
          pendingHire: null,
          calledAgents: [],
          seatedAgents: [],
          thinkingAgents: [],
          logs: [mkLog('reset', '🔄 Escritório reiniciado')],
          agentMemory: {},
          currentFloor: 0,
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
          floor: get().currentFloor,
        };
        set((s) => ({ agents: [...s.agents, newAgent], pendingHire: null }));
        pushLog(mkLog('hire', `${proposal.emoji} ${proposal.name} contratado(a) como ${proposal.title} via RH`, {
          agentId: id, agentName: proposal.name,
          agentEmoji: proposal.emoji, agentColor: proposal.color,
          detail: `Especialidade: ${proposal.specialty}\n\nSobre: ${proposal.description}`,
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

      updateSquadName: (squadId, name) =>
        set((s) => ({
          squads: s.squads.map(sq => sq.id === squadId ? { ...sq, name } : sq)
        })),

      moveAgentToFloor: (agentId, floor) =>
        set((s) => ({
          agents: s.agents.map(a => a.id === agentId ? { ...a, floor } : a)
        })),

      moveSquadToFloor: (squadId, floor) => {
        const squad = get().squads.find(s => s.id === squadId);
        if (squad) {
          set((s) => ({
            agents: s.agents.map(a => squad.agentIds.includes(a.id) ? { ...a, floor } : a)
          }));
        }
      },

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

        set((s) => ({ thinkingAgents: [...s.thinkingAgents, 'ceo'] }));

        const briefingText = await generateAgentReply({
          agent: ceoAgent,
          history: [],
          userText: `Escreva o briefing matinal da empresa. Contexto: ${activeCount} agente(s) ativo(s), ${taskCount} tarefas pendentes. Inclua: status da empresa, destaques do dia, mensagem motivacional para o time. Seja direto e natural como no WhatsApp corporativo.`,
          company: state.company,
          teammates: state.agents.filter((a) => a.id !== 'ceo'),
          memory: state.agentMemory['ceo'],
        });

        set((s) => ({ thinkingAgents: s.thinkingAgents.filter(id => id !== 'ceo') }));

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

      setSquadBuilderOpen: (o) => set((s) => ({ 
        isSquadBuilderOpen: o,
        busyAgents: o ? s.busyAgents : s.busyAgents.filter(id => id !== 'ceo')
      })),

      triggerSquadBuilder: async () => {
        const state = get();
        if (state.busyAgents.includes('ceo')) return;
        
        // 1. Caminhar para a mesa
        set((s) => ({ busyAgents: Array.from(new Set([...s.busyAgents, 'ceo'])) }));
        
        // 2. Sentar
        await waitForDesk('ceo');
        
        // 3. Digitar por 1 segundo
        await new Promise((r) => setTimeout(r, 1000));
        
        // 4. Abrir modal — CEO CONTINUA BUSY (SITTING)
        set((s) => ({
          isSquadBuilderOpen: true,
        }));
      },

      executeSquadBuilder: async (answers) => {
        const { business, audience, platform } = answers;
        const addDoc = get().addDocument;
        const addAgt = get().addAgent;
        const ceoAgent = get().agents.find(a => a.id === 'ceo');
        
        if (!ceoAgent) return;
        
        // LOG inicio imediato
        pushLog(mkLog('task_start', `🚀 CEO começou a orquestrar o Squad de Conteúdo...`, {
          agentId: 'ceo', agentName: 'CEO', agentEmoji: ceoAgent.emoji, agentColor: ceoAgent.color
        }));

        // Abrir o log para o usuário ver o progresso
        set({ logs: [...get().logs] }); 

        // PASSO 1: Criar Estrutura PARA
        const dateStr = new Date().toISOString().split('T')[0];
        
        addDoc({
          id: `para-area-meunegocio-${Date.now()}`,
          title: 'areas/meu-negocio/README.md',
          authorId: 'ceo', authorName: 'CEO', authorEmoji: ceoAgent.emoji,
          date: dateStr,
          content: `# Resumo do Negócio\n\n**O que vendemos:** ${business}\n**Público-alvo:** ${audience}\n**Plataforma principal:** ${platform}`
        });

        addDoc({
          id: `para-resources-tomdevoz-${Date.now()}`,
          title: 'resources/referencias-conteudo/README.md',
          authorId: 'ceo', authorName: 'CEO', authorEmoji: ceoAgent.emoji,
          date: dateStr,
          content: `# Tom de Voz da Marca\n\nUm tom adequado para o público (${audience}) na plataforma (${platform}), focado em vender (${business}). O conteúdo deve ser direto, engajador e alinhado com as melhores práticas da plataforma.`
        });

        addDoc({
          id: `para-squads-conteudo-${Date.now()}`,
          title: 'squads/conteudo.md',
          authorId: 'ceo', authorName: 'CEO', authorEmoji: ceoAgent.emoji,
          date: dateStr,
          content: `# Squad de Conteúdo\n\n**Agente 1:** Pesquisador\n**Agente 2:** Redator\n**Agente 3:** Revisor\n\nFluxo: Pesquisador -> Redator -> Revisor -> Output Final.`
        });

        // PASSO 2: Contratar o Squad
        const suffix = (answers.name || 'squad').toLowerCase().replace(/\s+/g, '-');
        
        const liderId = `lider-${suffix}-${Date.now()}`;
        const lider: Agent = {
          id: liderId,
          name: 'Sofia',
          role: 'director',
          title: `Líder-${suffix}`,
          color: '#f59e0b', // amber
          emoji: '👑',
          desk: get().agents.length,
          gender: 'female',
          skinTone: 'medium',
          specialty: 'Orquestração de squad, gestão de prazos e qualidade final da entrega.',
          floor: get().currentFloor,
        };
        addAgt(lider);

        const pesquisadorId = `pesquisador-${suffix}-${Date.now()}`;
        const pesquisador: Agent = {
          id: pesquisadorId,
          name: 'Lucas',
          role: 'researcher',
          title: `Pesquisador-${suffix}`,
          color: '#3b82f6', // blue
          emoji: '🔍',
          desk: get().agents.length,
          gender: 'male',
          skinTone: 'light',
          specialty: 'Pesquisa de mercado e tendências para o nicho informado.',
          floor: get().currentFloor,
        };
        addAgt(pesquisador);

        const redatorId = `redator-${suffix}-${Date.now()}`;
        const redator: Agent = {
          id: redatorId,
          name: 'Mariana',
          role: 'marketing',
          title: `Redator-${suffix}`,
          color: '#ec4899', // pink
          emoji: '✍️',
          desk: get().agents.length,
          gender: 'female',
          skinTone: 'medium',
          specialty: 'Escrever posts focados no engajamento para a plataforma escolhida.',
          floor: get().currentFloor,
        };
        addAgt(redator);

        const revisorId = `revisor-${suffix}-${Date.now()}`;
        const revisor: Agent = {
          id: revisorId,
          name: 'Carlos',
          role: 'specialist',
          title: `Revisor-${suffix}`,
          color: '#8b5cf6', // violet
          emoji: '✅',
          desk: get().agents.length,
          gender: 'male',
          skinTone: 'dark',
          specialty: 'Revisar qualidade, clareza e alinhamento com o tom de voz da marca.',
          floor: get().currentFloor,
        };
        addAgt(revisor);

        // CRIAR SQUAD no Store
        const squadId = `squad-${Date.now()}`;
        const finalAgentIds = [lider.id, pesquisador.id, redator.id, revisor.id];
        
        set((s) => ({
          squads: [...s.squads.filter(sq => sq.id !== squadId), {
            id: squadId,
            name: answers.name || 'SQUAD DE CONTEÚDO',
            emoji: '🚀',
            agentIds: finalAgentIds
          }],
          activeAgentId: squadId 
        }));

        // PASSO 3: Executar o Squad (Cadeia de Prompts)
        try {
          // 3.0 Líder inicia a organização
          const planning = await callAgent({
            agent: lider,
            history: [],
            userText: `Novo projeto para ${answers.business}. Planeje as tarefas para o Pesquisador, Redator e Revisor.`,
            company,
            teammates: [pesquisador, redator, revisor]
          });

          // 3.2 Redator
          const posts = await callAgent({
            agent: redator,
            history: [],
            userText: `Com base nestes temas selecionados pelo pesquisador:\n${themes}\n\nEscreva 3 posts completos formatados para ${platform}, mantendo o tom de voz adequado para ${audience}.`,
            company,
            teammates: []
          });

          // 3.3 Revisor
          const finalOutput = await callAgent({
            agent: revisor,
            history: [],
            userText: `Revise os seguintes posts gerados pelo redator:\n${posts}\n\nMelhore a clareza, o gancho inicial e a call to action. Retorne APENAS a versão final dos 3 posts prontos para publicar.`,
            company,
            teammates: []
          });

          // PASSO 4: Salvar output final
          const resultId = `projects/${dateStr}-conteudo-semana.md`;
          addDoc({
            id: `para-project-${Date.now()}`,
            title: resultId,
            authorId: revisor.id, authorName: revisor.name, authorEmoji: revisor.emoji,
            date: dateStr,
            content: `# Posts da Semana\n\n${finalOutput}`
          });

          // PASSO 5: CEO Notifica no chat
          const announcement: ChatMessage = {
            id: crypto.randomUUID(),
            agentId: 'ceo',
            authorId: 'ceo',
            authorName: 'CEO',
            text: `✅ **Squad de Conteúdo Finalizado!**\n\n- O vault PARA foi criado.\n- O squad de 3 agentes foi contratado.\n- Os 3 posts foram gerados e revisados!\n\nConfira o arquivo \`${resultId}\` na aba de Documentos. Para o próximo passo, sugiro montarmos o **Squad de Vendas**!`,
            timestamp: Date.now(),
          };
          
          set((s) => ({
            messages: {
              ...s.messages,
              ceo: [...(s.messages['ceo'] ?? []), announcement],
            },
          }));

          // 3.4 CEO Log final
          pushLog(mkLog('task_complete', `✨ Squad de Conteúdo criado e primeira demanda finalizada!`, {
            agentId: 'ceo', agentName: 'CEO', agentEmoji: ceoAgent.emoji, agentColor: ceoAgent.color
          }));

        } catch (err) {
          console.error('Erro no SquadBuilder:', err);
        } finally {
          // LIBERAR O CEO apenas no final de tudo
          set((s) => ({ 
            busyAgents: s.busyAgents.filter((id) => id !== 'ceo'),
            isSquadBuilderOpen: false 
          }));
        }
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

        const targetSquad = get().squads.find((s) => s.id === agentId);
        const targetAgent = get().agents.find((a) => a.id === agentId);
        
        if (targetSquad) {
          pushLog(mkLog('message_sent',
            `💬 Você enviou uma mensagem para o squad 🚀 ${targetSquad.name}`,
            {
              agentId: targetSquad.id, agentName: targetSquad.name,
              detail: trimmed.slice(0, 120),
            }
          ));
        } else if (targetAgent) {
          pushLog(mkLog('message_sent',
            `💬 Você enviou uma mensagem para ${targetAgent.emoji} ${targetAgent.name}`,
            {
              agentId: targetAgent.id, agentName: targetAgent.name,
              agentEmoji: targetAgent.emoji, agentColor: targetAgent.color,
              detail: trimmed.slice(0, 120),
            }
          ));
        }

        // 2. work out who replies (primary + mentioned)
        const all = get().agents;
        const respondents: Agent[] = [];

        if (targetSquad) {
          // The Leader (first agent in the squad) is the spokesperson
          const leaderId = targetSquad.agentIds[0];
          const leader = all.find(x => x.id === leaderId);
          if (leader) respondents.push(leader);
          
          // Optionally, if other agents are EXPLICITLY mentioned, they can join
          for (const handle of mentions) {
            const a = all.find(x => x.id === handle || x.name.toLowerCase() === handle);
            if (a && targetSquad.agentIds.includes(a.id) && !respondents.includes(a)) {
              respondents.push(a);
            }
          }
        } else {
          const primary = all.find((a) => a.id === agentId);
          if (!primary) return;
          respondents.push(primary);
          
          // Only trigger mentioned agents IF we are NOT in the CEO chat.
          // In CEO chat, we only want the CEO to respond unless it's a squad chat.
          if (agentId !== 'ceo') {
            for (const handle of mentions) {
              const a = all.find(
                (x) => x.id === handle || x.name.toLowerCase() === handle
              );
              if (a && a.id !== primary.id && !respondents.includes(a)) {
                respondents.push(a);
              }
            }
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
                targetSquad 
                  ? agent.name
                  : (agent.id === agentId ? agent.name : `${agent.name} (mentioned)`),
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

            const filteredHistory = (get().messages[agentId] ?? []).filter(
              (m) => m.id !== placeholderId
            );

            const memory = get().agentMemory[agent.id];
            const company = get().company;
            const teammates = get().agents.filter((a) => a.id !== agent.id);

            let reply: string;

            if (agent.id === 'ceo') {
              const tools: any[] = [
                {
                  name: 'manage_documents',
                  description: 'Gerencia documentos da empresa (apagar, listar). Use action "delete_all" para apagar todos.',
                  input_schema: {
                    type: 'object',
                    properties: {
                      action: { type: 'string', enum: ['delete', 'delete_last', 'delete_all'], description: 'Ação a realizar' },
                      count: { type: 'number', description: 'Quantidade de documentos' }
                    },
                    required: ['action']
                  }
                },
                {
                  name: 'manage_floors',
                  description: 'Gerencia os andares do escritório.',
                  input_schema: {
                    type: 'object',
                    properties: {
                      action: { type: 'string', enum: ['switch', 'create'], description: 'Mudar ou criar andar' },
                      floor: { type: 'number', description: 'Número do andar' }
                    },
                    required: ['action', 'floor']
                  }
                },
                {
                  name: 'hire_agent',
                  description: 'Contrata um novo agente.',
                  input_schema: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      title: { type: 'string' }
                    },
                    required: ['name', 'title']
                  }
                },
                {
                  name: 'manage_system',
                  description: 'Gerencia logs.',
                  input_schema: {
                    type: 'object',
                    properties: {
                      action: { type: 'string', enum: ['clear_logs'] }
                    },
                    required: ['action']
                  }
                },
                {
                  name: 'manage_squads',
                  description: 'Gerencia os squads.',
                  input_schema: {
                    type: 'object',
                    properties: {
                      action: { type: 'string', enum: ['move_to_floor', 'rename'], description: 'Ação a realizar' },
                      squadId: { type: 'string', description: 'ID do squad' },
                      value: { type: 'string', description: 'Novo nome ou número do andar' }
                    },
                    required: ['action', 'squadId', 'value']
                  }
                },
                {
                  name: 'fire_agents',
                  description: 'Remove agentes.',
                  input_schema: {
                    type: 'object',
                    properties: {
                      agentIds: { type: 'array', items: { type: 'string' } }
                    },
                    required: ['agentIds']
                  }
                }
              ];

              set((s) => ({ thinkingAgents: [...s.thinkingAgents, agent.id] }));

              const rawReply = await callAgent({
                agent,
                history: filteredHistory,
                userText: `[CONTEXTO: O andar atual é o ANDAR ${get().currentFloor}.
DIFERENCIAÇÃO: 
1. DOCUMENTOS/ARQUIVOS: Entregáveis (ex: textos). Use "manage_documents".
2. LOGS/HISTÓRICO: Registros de atividade no rodapé. Use "manage_system" (action: "clear_logs").
Você é o CEO e tem autoridade SUPREMA. Nunca confunda os dois.]\n\n${trimmed}`,
                company,
                teammates,
                memory,
                attachedFiles: attachedFiles.length > 0 ? attachedFiles : undefined,
                tools
              });

              set((s) => ({ thinkingAgents: s.thinkingAgents.filter(id => id !== agent.id) }));

              try {
                const parsed = JSON.parse(rawReply);
                if (parsed.tool_calls) {
                  let toolFeedback = "";
                  for (const call of parsed.tool_calls) {
                    const input = call.input;
                    
                    if (call.name === 'manage_system' && input.action === 'clear_logs') {
                      set({ logs: [] });
                      toolFeedback = "Histórico de logs do sistema foi limpo com sucesso.";
                    }

                    if (call.name === 'hire_agent') {
                      callHrForProposal(`Contrate ${input.name} como ${input.title}`, get().company, get().agents).then((proposal) => {
                        if (proposal) set({ pendingHire: proposal });
                      });
                      toolFeedback = `Excelente escolha. Acabei de solicitar ao sistema a contratação de ${input.name} para o cargo de ${input.title}. O RH processará os detalhes agora.`;
                    }

                    if (call.name === 'manage_documents') {
                      if (input.action === 'delete_all') {
                        set({ documents: [] });
                        toolFeedback = "Limpeza completa realizada. Todos os documentos foram apagados.";
                      } else if (input.action === 'delete_last') {
                        const docs = get().documents;
                        const count = input.count || 1;
                        for(let i=0; i<count; i++) {
                          if (get().documents.length > 0) get().removeDocument(get().documents[0].id);
                        }
                        toolFeedback = `Removi os últimos ${count} documentos como solicitado.`;
                      }
                    }
                    if (call.name === 'manage_floors') {
                      get().setFloor(input.floor);
                      toolFeedback = `Andar alterado para o nível ${input.floor}.`;
                    }
                    if (call.name === 'manage_squads') {
                      if (input.action === 'move_to_floor') {
                        get().moveSquadToFloor(input.squadId, parseInt(input.value));
                        toolFeedback = "Squad movido com sucesso.";
                      } else {
                        get().updateSquadName(input.squadId, input.value);
                        toolFeedback = "Squad renomeado.";
                      }
                    }
                    if (call.name === 'fire_agents') {
                      const ids = input.agentIds;
                      const toRemove = ids.includes('all') ? get().agents.filter(a => a.id !== 'ceo') : get().agents.filter(a => ids.includes(a.id));
                      toRemove.forEach(a => get().removeAgent(a.id));
                      toolFeedback = "Funcionários desligados.";
                    }
                  }
                  reply = parsed.text || toolFeedback || "Comando executado, senhor.";
                } else {
                  reply = rawReply;
                }
              } catch (e) {
                reply = rawReply;
              }
            } else {
              const tools: any[] = [
                {
                  name: 'manage_documents',
                  description: 'Cria ou gerencia documentos. Use action "create" para salvar o trabalho final.',
                  input_schema: {
                    type: 'object',
                    properties: {
                      action: { type: 'string', enum: ['create'], description: 'Ação a realizar' },
                      title: { type: 'string', description: 'Título do documento (ex: post-linkedin.md)' },
                      content: { type: 'string', description: 'Conteúdo completo do documento em markdown' }
                    },
                    required: ['action', 'title', 'content']
                  }
                }
              ];

              set((s) => ({ thinkingAgents: [...s.thinkingAgents, agent.id] }));

              const rawReply = await callAgent({
                agent,
                history: filteredHistory,
                userText: targetSquad 
                  ? `### SQUAD PROTOCOL - MANDATÓRIO ###
O trabalho segue a ordem: Sofia -> Lucas -> Mariana -> Carlos -> Sofia.

ENTREGA FINAL: Se você for a Sofia e estiver finalizando o trabalho, você DEVE usar a ferramenta "manage_documents" (action: "create") para salvar o conteúdo final em um arquivo .md antes de responder ao usuário.

Mencione o PRÓXIMO ao terminar sua parte.

CONDIÇÃO ATUAL: Você está respondendo como ${agent.name}.
-----------------------------------------
${trimmed}`
                  : trimmed,
                company,
                teammates,
                memory,
                attachedFiles: attachedFiles.length > 0 ? attachedFiles : undefined,
                tools: targetSquad ? tools : undefined
              });

              set((s) => ({ thinkingAgents: s.thinkingAgents.filter(id => id !== agent.id) }));

              try {
                const parsed = JSON.parse(rawReply);
                if (parsed.tool_calls) {
                  let toolFeedback = "";
                  for (const call of parsed.tool_calls) {
                    const input = call.input;
                    if (call.name === 'manage_documents' && input.action === 'create') {
                      get().addDocument({
                        title: input.title,
                        content: input.content,
                        author: agent.name,
                        tags: ['squad', 'entrega']
                      });
                      toolFeedback = `[ARQUIVO GERADO: ${input.title}]`;
                    }
                  }
                  reply = (parsed.text || "") + "\n\n" + toolFeedback;
                } else {
                  reply = rawReply;
                }
              } catch (e) {
                reply = rawReply;
              }
            }

            set((s) => ({
              messages: {
                ...s.messages,
                [agentId]: (s.messages[agentId] ?? []).map((m) =>
                  m.id === placeholderId
                    ? { ...m, text: reply, pending: false, timestamp: Date.now() }
                    : m
                ),
              },
              busyAgents: s.busyAgents.filter((id) => id !== agent.id),
            }));

            // Browser notification
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

            // Feature 3: async memory summarisation
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
            for (const handle of replyMentions) {
              if (handle === 'user') continue;
              const mentioned = get().agents.find(
                (x) => x.id === handle || x.name.toLowerCase() === handle
              );
              if (!mentioned) continue;

              // Trigger mentioned agent as collaboration (don't await — let it run async)
              triggerCollaboration(
                agentId,
                mentioned,
                targetSquad 
                  ? `### SQUAD PROTOCOL - MANDATÓRIO ###
O trabalho segue a ordem: Sofia -> Lucas -> Mariana -> Carlos.
Você foi mencionado para continuar sua parte. Mencione o PRÓXIMO ao terminar.

[${agent.name} mencionou você]: ${reply}`
                  : `${trimmed}\n\n[${agent.name} mencionou você]: ${reply}`,
                get
              );
            }
          })
        );
      },
    }),
    {
      name: 'pixel_agents:store',
      partialize: (s) => ({
        company: s.company,
        agents: s.agents,
        squads: s.squads,
        documents: s.documents,
        messages: s.messages,
        tasks: s.tasks,
        agentMemory: s.agentMemory,
        dailyBriefingEnabled: s.dailyBriefingEnabled,
        dailyBriefingTime: s.dailyBriefingTime,
        lastBriefingDate: s.lastBriefingDate,
        currentFloor: s.currentFloor,
      }),
    }
  )
);

/* -------------------------------------------------------------------------- */
/* Feature 4: Agent Collaboration helper                                      */
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

  const reply = await callAgent({
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

  // Update memory
  const historyForMemory = (get().messages[chatAgentId] ?? []).filter((m) => !m.pending);
  summarizeConversationForMemory(
    mentionedAgent.name,
    historyForMemory,
    get().agentMemory[mentionedAgent.id] ?? ''
  ).then((newM) => {
    if (newM) get().updateAgentMemory(mentionedAgent.id, newM);
  });
}
