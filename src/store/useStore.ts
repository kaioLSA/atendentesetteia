import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Agent,
  ChatMessage,
  CompanyContext,
  OfficeDocument,
} from '../types';
import { writeSharedMemory } from '../services/sharedMemory';
import { generateAgentReply } from '../services/agents/agentEngine';
import { ROLE_DEFAULTS } from '../services/agents/rolePrompts';

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
        set((s) => ({
          activeAgentId: id,
          busyAgents: id ? Array.from(new Set([...s.busyAgents, id])) : [],
        })),

      addAgent: (a) =>
        set((s) => ({
          agents: [
            ...s.agents,
            { ...a, desk: s.agents.length } as Agent,
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

        // 4. mentioned agents (not primary, not active tab) leave their desk
        set((s) => ({
          busyAgents: s.busyAgents.filter(
            (id) => id === s.activeAgentId
          ),
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
