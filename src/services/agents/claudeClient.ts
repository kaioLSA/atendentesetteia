import Anthropic from '@anthropic-ai/sdk';
import type { Agent, ChatMessage, CompanyContext, HireProposal } from '../../types';
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

export interface AttachedFile {
  fileId: string;
  mediaType: string;
  name: string;
}

export interface CallOptions {
  agent: Agent;
  history: ChatMessage[];
  userText: string;
  company: CompanyContext;
  /** Other agents in the office (used for @mention awareness) */
  teammates: Agent[];
  /** Optional memory summary injected into the system prompt */
  memory?: string;
  /** Files already uploaded to the Anthropic Files API */
  attachedFiles?: AttachedFile[];
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

  let system =
    buildSystemPrompt(
      opts.agent.role,
      opts.agent.name,
      opts.agent.title,
      opts.company,
      opts.agent.specialty,
    ) + teammateLine;

  // Inject persistent memory if available
  if (opts.memory && opts.memory.trim()) {
    system += `\n\n[MEMÓRIA]: ${opts.memory}`;
  }

  // Convert chat history into Anthropic message format.
  const messages: Anthropic.MessageParam[] = opts.history.map((m) => {
    if (m.authorId === 'user') {
      return { role: 'user' as const, content: m.text };
    }
    if (m.authorId === opts.agent.id) {
      return { role: 'assistant' as const, content: m.text };
    }
    return {
      role: 'user' as const,
      content: `[${m.authorName}]: ${m.text}`,
    };
  });

  // Build the final user message, attaching files if present
  if (opts.attachedFiles && opts.attachedFiles.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contentBlocks: any[] = [];

    for (const f of opts.attachedFiles) {
      if (f.mediaType.startsWith('image/')) {
        contentBlocks.push({
          type: 'image',
          source: { type: 'file', file_id: f.fileId },
        });
      } else {
        contentBlocks.push({
          type: 'document',
          source: { type: 'file', file_id: f.fileId },
          title: f.name,
        });
      }
    }

    contentBlocks.push({ type: 'text', text: opts.userText });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages.push({ role: 'user', content: contentBlocks as any });
  } else {
    messages.push({ role: 'user', content: opts.userText });
  }

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

/**
 * Ask the HR agent (via Claude) to generate a structured hire proposal.
 * Returns a parsed HireProposal or null if the API is unavailable / parse fails.
 */
export async function callHrForProposal(
  request: string,
  company: CompanyContext,
  existingAgents: Agent[],
): Promise<HireProposal | null> {
  const settings = loadSettings();
  if (!settings.apiKey) return null;

  const client = getClient(settings.apiKey);
  const takenNames = existingAgents.map((a) => a.name).join(', ');

  const system = `You are an HR Manager. Your only task is to produce a hire proposal as a JSON object.
Given a hire request, reply with ONLY a valid JSON object — no markdown fences, no explanation:
{
  "name": "Brazilian first name (must NOT be any of: ${takenNames})",
  "title": "Specific job title (e.g. 'Senior Frontend Developer')",
  "role": "engineer|designer|marketing|analyst|sales|secretary",
  "specialty": "One clear sentence describing exactly what this person focuses on",
  "color": "A hex color that visually represents the role (e.g. #34d399 for engineer)",
  "emoji": "One relevant emoji",
  "gender": "male|female",
  "skinTone": "light|medium|dark",
  "description": "2-3 warm sentences: background, personality trait, why they fit the team"
}
Company context: ${company.companyName || 'a startup'} — ${company.mission || 'building great products'}.`;

  try {
    const response = await client.messages.create({
      model: settings.model || DEFAULT_MODEL,
      max_tokens: 512,
      system,
      messages: [{ role: 'user', content: `Hire request: ${request}` }],
    });

    const raw = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();

    const match = raw.match(/\{[\s\S]+\}/);
    if (match) return JSON.parse(match[0]) as HireProposal;
  } catch {
    /* silent — caller shows a fallback */
  }
  return null;
}

/**
 * Summarise a conversation into a compact memory note (3-5 bullets, Portuguese).
 * Uses Haiku for speed and low cost.
 */
export async function summarizeConversationForMemory(
  agentName: string,
  history: ChatMessage[],
  existingMemory: string,
): Promise<string> {
  const settings = loadSettings();
  if (!settings.apiKey) return existingMemory;

  const client = getClient(settings.apiKey);

  const convo = history
    .map((m) => `${m.authorName}: ${m.text}`)
    .join('\n');

  const system = `Você é um assistente de memória. Extraia as informações mais relevantes da conversa abaixo e escreva um resumo compacto em formato de tópicos (3 a 5 bullets), em português pt-BR. Foque em: decisões tomadas, fatos importantes, contexto relevante para conversas futuras com ${agentName}. Se já houver uma memória anterior, mescle e atualize com as novas informações — elimine redundâncias. Responda APENAS com os bullets, sem introdução.`;

  const userContent = `${existingMemory ? `MEMÓRIA ANTERIOR:\n${existingMemory}\n\n` : ''}CONVERSA:\n${convo}`;

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 512,
      system,
      messages: [{ role: 'user', content: userContent }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    return text || existingMemory;
  } catch {
    return existingMemory;
  }
}

/**
 * Upload a File to the Anthropic Files API and return its file_id.
 */
export async function uploadFileToAnthropic(file: File): Promise<string> {
  const settings = loadSettings();
  if (!settings.apiKey) {
    throw new Error('No API key configured.');
  }

  const client = getClient(settings.apiKey);

  // @ts-expect-error — Files API is in beta; SDK types may not expose it yet
  const uploaded = await client.beta.files.upload({ file });
  return (uploaded as { id: string }).id;
}
