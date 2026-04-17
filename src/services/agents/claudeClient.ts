import Anthropic from '@anthropic-ai/sdk';
import type { Agent, ChatMessage, CompanyContext } from '../../types';
import { buildSystemPrompt } from './rolePrompts';

const STORAGE_KEY = 'pixel_agents:settings';
const MODEL_KEY = 'pixel_agents:model';

export const DEFAULT_MODEL = 'claude-sonnet-4-5';
export const AVAILABLE_MODELS = [
  { id: 'claude-opus-4-5', label: 'Claude Opus 4.5 (best)' },
  { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5 (balanced)' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 (fast)' },
];

export interface ClaudeSettings {
  apiKey: string;
  model: string;
}

export function loadSettings(): ClaudeSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as ClaudeSettings;
  } catch {
    /* ignore */
  }
  return { apiKey: '', model: localStorage.getItem(MODEL_KEY) ?? DEFAULT_MODEL };
}

export function saveSettings(s: ClaudeSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function hasApiKey(): boolean {
  return loadSettings().apiKey.trim().length > 0;
}

let _client: Anthropic | null = null;
let _clientKey = '';

function getClient(apiKey: string): Anthropic {
  if (!_client || _clientKey !== apiKey) {
    _client = new Anthropic({
      apiKey,
      dangerouslyAllowBrowser: true,
    });
    _clientKey = apiKey;
  }
  return _client;
}

export interface CallOptions {
  agent: Agent;
  history: ChatMessage[];
  userText: string;
  company: CompanyContext;
  /** Other agents in the office (used for @mention awareness) */
  teammates: Agent[];
}

/**
 * Call Claude as a specific agent. Returns the assistant's text reply.
 * Throws an Error with a friendly message if the API key is missing or
 * the request fails.
 */
export async function callAgent(opts: CallOptions): Promise<string> {
  const settings = loadSettings();
  if (!settings.apiKey) {
    throw new Error(
      'No API key configured. Open Settings and paste your Anthropic API key.'
    );
  }

  const client = getClient(settings.apiKey);

  const teammateLine = opts.teammates.length
    ? `\nTeammates available via @mention: ${opts.teammates
        .map((t) => `@${t.id} (${t.title})`)
        .join(', ')}.`
    : '';

  const system =
    buildSystemPrompt(
      opts.agent.role,
      opts.agent.name,
      opts.agent.title,
      opts.company
    ) + teammateLine;

  // Convert chat history into Anthropic message format.
  // Map every previous turn: user messages -> "user", any agent reply
  // (including from THIS agent) -> "assistant" or "user" w/ name prefix.
  const messages = opts.history.map((m) => {
    if (m.authorId === 'user') {
      return { role: 'user' as const, content: m.text };
    }
    if (m.authorId === opts.agent.id) {
      return { role: 'assistant' as const, content: m.text };
    }
    // Another agent spoke: feed it as user message with a label so the
    // current agent understands who said what.
    return {
      role: 'user' as const,
      content: `[${m.authorName}]: ${m.text}`,
    };
  });

  messages.push({ role: 'user', content: opts.userText });

  const response = await client.messages.create({
    model: settings.model || DEFAULT_MODEL,
    max_tokens: 1024,
    system,
    messages,
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();

  return text || '...';
}
