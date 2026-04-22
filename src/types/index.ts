export type AgentRole =
  | 'director'
  | 'hr'
  | 'marketing'
  | 'engineer'
  | 'analyst'
  | 'secretary'
  | 'designer'
  | 'sales'
  | 'specialist';

export type Facing = 'down' | 'up' | 'left' | 'right';

export type Gender = 'male' | 'female';

export type SkinTone = 'light' | 'medium' | 'dark';

export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  title: string;
  color: string;
  emoji: string;
  /** Desk index (cell pos in office grid) */
  desk: number;
  /** Visual gender of the pixel sprite */
  gender?: Gender;
  /** Skin tone for the generic sprite */
  skinTone?: SkinTone;
  /** Free-text description of what this agent specialises in */
  specialty?: string;
  /** Floor index (multi-floor support) */
  floor?: number;
}

/** Proposed hire returned by the HR agent before the user confirms */
export interface HireProposal {
  name: string;
  title: string;
  role: AgentRole;
  specialty: string;
  color: string;
  emoji: string;
  gender: Gender;
  skinTone: SkinTone;
  description: string;
}

export interface ChatMessage {
  id: string;
  agentId: string; // chat tab owner
  authorId: string; // 'user' or agent id
  authorName: string;
  text: string;
  timestamp: number;
  mentions?: string[];
  pending?: boolean;
}

export interface OfficeDocument {
  id: string;
  title: string;
  authorId: string;
  authorName: string;
  authorEmoji: string;
  date: string;
  content: string;
}

export interface CompanyContext {
  companyName: string;
  mission: string;
  products: string;
  culture: string;
  notes: string;
}

export type TaskStatus = 'pending' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'normal' | 'high';

export interface Task {
  id: string;
  title: string;
  description: string;
  assignedTo: string; // agentId
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  result?: string;
}

export type LogEventType =
  | 'hire'
  | 'fire'
  | 'message_sent'
  | 'agent_reply'
  | 'task_start'
  | 'task_done'
  | 'desk_visit'
  | 'company_update'
  | 'document_add'
  | 'document_remove'
  | 'reset';

export interface LogEntry {
  id: string;
  timestamp: number;
  type: LogEventType;
  /** Agent involved (if any) */
  agentId?: string;
  agentName?: string;
  agentEmoji?: string;
  agentColor?: string;
  /** Human-readable description */
  text: string;
  /** Optional extra detail (e.g. message preview) */
  detail?: string;
}

export interface SquadBuilderAnswers {
  name: string;
  business: string;
  audience: string;
  platform: string;
}

export interface Squad {
  id: string;
  name: string;
  emoji: string;
  agentIds: string[];
}
