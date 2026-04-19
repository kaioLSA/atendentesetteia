import type { Agent, ChatMessage, CompanyContext } from '../../types';
import { callAgent, hasApiKey, type AttachedFile } from './claudeClient';

/**
 * Generate an agent reply.
 * Uses the Claude API. If no API key is set, returns a helpful stub
 * pointing the user to Settings.
 */
export async function generateAgentReply(params: {
  agent: Agent;
  history: ChatMessage[];
  userText: string;
  company: CompanyContext;
  teammates: Agent[];
  /** Persistent memory summary for this agent */
  memory?: string;
  /** Files already uploaded to the Anthropic Files API */
  attachedFiles?: AttachedFile[];
}): Promise<string> {
  if (!hasApiKey()) {
    return `_(${params.agent.name} is offline — open ⚙️ Settings and paste your Anthropic API key to bring me online.)_`;
  }
  try {
    return await callAgent(params);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return `_(API error: ${msg})_`;
  }
}
