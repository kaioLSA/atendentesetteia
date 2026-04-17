export type AgentRole =
  | 'director'
  | 'marketing'
  | 'engineer'
  | 'analyst'
  | 'secretary'
  | 'designer'
  | 'sales';

export type Facing = 'down' | 'up' | 'left' | 'right';

<<<<<<< HEAD
=======
export type Gender = 'male' | 'female';

>>>>>>> 0c7a388 (Atualização feita em outro PC)
export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  title: string;
  color: string;
  emoji: string;
  /** Desk index (cell pos in office grid) */
  desk: number;
<<<<<<< HEAD
=======
  /** Visual gender of the pixel sprite */
  gender?: Gender;
>>>>>>> 0c7a388 (Atualização feita em outro PC)
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
