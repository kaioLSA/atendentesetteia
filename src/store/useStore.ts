import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Agent,
<<<<<<< HEAD
=======
  AgentRole,
>>>>>>> 0c7a388 (Atualização feita em outro PC)
  ChatMessage,
  CompanyContext,
  OfficeDocument,
} from '../types';
import { writeSharedMemory } from '../services/sharedMemory';
import { generateAgentReply } from '../services/agents/agentEngine';
import { ROLE_DEFAULTS } from '../services/agents/rolePrompts';

<<<<<<< HEAD
=======
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

>>>>>>> 0c7a388 (Atualização feita em outro PC)
interface StoreState {
  company: CompanyContext;
  agents: Agent[];
  activeAgentId: string | null;
  messages: Record<string, ChatMessage[]>;
  documents: OfficeDocument[];
  /** Agents currently in the chat tab — they walk to their desk */
  busyAgents: string[];

  setCompany: (c: CompanyContext) => void;
  setActiveAgent: (id: string | null) => void;
  addAgent: (a: Omit<Agent, 'desk'>) => void;
  removeAgent: (id: string) => void;
  sendMessage: (agentId: string, text: string) => Promise<void>;
  clearChat: (agentId: string) => void;
  addDocument: (doc: OfficeDocument) => void;
  removeDocument: (id: string) => void;
  resetAll: () => void;
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
};

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      company: emptyCompany,
      agents: [ceo],
      activeAgentId: 'ceo',
      messages: {},
      documents: [],
      busyAgents: [],

      setCompany: (c) => {
        set({ company: c });
        writeSharedMemory('context.json', c);
      },

      setActiveAgent: (id) =>
<<<<<<< HEAD
        set((s) => ({
          activeAgentId: id,
          busyAgents: id ? Array.from(new Set([...s.busyAgents, id])) : [],
=======
        set(() => ({
          // Opening a chat no longer makes the agent "busy" — they keep
          // wandering until you actually send a message (a real task).
          activeAgentId: id,
>>>>>>> 0c7a388 (Atualização feita em outro PC)
        })),

      addAgent: (a) =>
        set((s) => ({
          agents: [
            ...s.agents,
<<<<<<< HEAD
            { ...a, desk: s.agents.length } as Agent,
=======
            {
              ...a,
              desk: s.agents.length,
              gender:
                (a as Agent).gender ??
                (Math.random() < 0.5 ? 'male' : 'female'),
            } as Agent,
>>>>>>> 0c7a388 (Atualização feita em outro PC)
          ],
        })),

      removeAgent: (id) =>
        set((s) => {
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

      addDocument: (doc) =>
        set((s) => ({ documents: [doc, ...s.documents] })),

      removeDocument: (id) =>
        set((s) => ({ documents: s.documents.filter((d) => d.id !== id) })),

      resetAll: () => {
        set({
          company: emptyCompany,
          agents: [ceo],
          activeAgentId: 'ceo',
          messages: {},
          documents: [],
          busyAgents: [],
        });
        writeSharedMemory('context.json', emptyCompany);
      },

      sendMessage: async (agentId, text) => {
        const trimmed = text.trim();
        if (!trimmed) return;

        const mentions = Array.from(trimmed.matchAll(/@([\w-]+)/g)).map((m) =>
          m[1].toLowerCase()
        );

        // 1. push user message
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

<<<<<<< HEAD
=======
        // 1b. If the user is asking the CEO to hire someone, spin up a
        // specialized Claude agent BEFORE the CEO replies so the CEO can
        // address the new teammate in its answer.
        if (agentId === 'ceo') {
          const hire = parseHireIntent(trimmed);
          if (hire) {
            const existing = get().agents;
            const name = pickUniqueName(existing, hire.requestedName);
            const defaults = ROLE_DEFAULTS[hire.role];
            const id = makeAgentId(name, existing);
            const newAgent: Agent = {
              id,
              name,
              role: hire.role,
              title: defaults.titleSuggestion,
              color: defaults.color,
              emoji: defaults.emoji,
              desk: existing.length,
              gender: Math.random() < 0.5 ? 'male' : 'female',
            };
            set((s) => ({ agents: [...s.agents, newAgent] }));

            // Announce the hire inside the CEO's chat so the user sees it.
            const systemMsg: ChatMessage = {
              id: crypto.randomUUID(),
              agentId,
              authorId: 'ceo',
              authorName: 'CEO',
              text: `✨ Contratado! **${name}** (${defaults.titleSuggestion}) acabou de se juntar ao time. Agora você pode conversar com @${id} na barra lateral — é um agente Claude especializado em ${hire.role}.`,
              timestamp: Date.now(),
            };
            set((s) => ({
              messages: {
                ...s.messages,
                [agentId]: [...(s.messages[agentId] ?? []), systemMsg],
              },
            }));
          }
        }

>>>>>>> 0c7a388 (Atualização feita em outro PC)
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

        // mark all respondents busy (they walk to their desks)
        set((s) => ({
          busyAgents: Array.from(
            new Set([...s.busyAgents, ...respondents.map((r) => r.id)])
          ),
        }));

        // 3. fire each reply (typing placeholder + real call)
        await Promise.all(
          respondents.map(async (agent, i) => {
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

            const reply = await generateAgentReply({
              agent,
              history,
              userText: trimmed,
              company: get().company,
              teammates: get().agents.filter((a) => a.id !== agent.id),
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
          })
        );

<<<<<<< HEAD
        // 4. mentioned agents (not primary, not active tab) leave their desk
        set((s) => ({
          busyAgents: s.busyAgents.filter(
            (id) => id === s.activeAgentId
          ),
=======
        // 4. everyone leaves their desk once the reply is done — they go back
        // to wandering around the room.
        const respondentIds = new Set(respondents.map((r) => r.id));
        set((s) => ({
          busyAgents: s.busyAgents.filter((id) => !respondentIds.has(id)),
>>>>>>> 0c7a388 (Atualização feita em outro PC)
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
      }),
    }
  )
);
