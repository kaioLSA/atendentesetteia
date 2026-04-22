import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { Agent, Gender } from '../../types';
import { CharacterSprite, type Facing } from './CharacterSprite';
import { useStore } from '../../store/useStore';

export type { Facing };

interface Props {
  agent: Agent;
  size: number;
  facing?: Facing;
  active?: boolean;
  walking?: boolean;
  sitting?: boolean;
  onClick?: () => void;
}

/**
 * Pixel avatar. Two completely separate render paths so framer-motion never
 * re-fires animations while the agent is seated:
 *  - sitting → plain <button>, 100 % static (the sprite internally animates
 *    the typing arms only)
 *  - walking / idle → <motion.button> with walk-bob
 */
export function AgentAvatar({
  agent,
  size,
  facing = 'down',
  walking,
  sitting,
  onClick,
}: Props) {
  const busyAgents = useStore((s) => s.busyAgents);
  const tasks = useStore((s) => s.tasks);
  const messages = useStore((s) => s.messages);

  // Memoize status to avoid heavy calculations on every move tick
  const { statusColor, statusLabel } = useMemo(() => {
    // Only check if they are thinking if they are already in busyAgents (perf optimization)
    const inBusy = busyAgents.includes(agent.id);
    let isThinking = false;
    if (inBusy) {
      // Check the relevant chat only (activeAgentId chat or mentioned)
      // For simplicity, we check all, but we can optimize further if needed.
      isThinking = Object.values(messages).some((msgs) =>
        msgs.some((m) => m.authorId === agent.id && m.pending)
      );
    }
    
    const isOccupied = tasks.some(
      (t) => t.assignedTo === agent.id && t.status === 'in_progress'
    );

    const color = isThinking
      ? '#eab308' // yellow thinking
      : isOccupied
      ? '#ef4444' // red busy
      : '#22c55e'; // green available

    const label = isThinking ? 'pensando' : isOccupied ? 'ocupado' : 'disponível';
    return { statusColor: color, statusLabel: label };
  }, [agent.id, busyAgents, tasks, messages]);

  const gender: Gender =
    agent.gender ?? (hashString(agent.id) % 2 === 0 ? 'male' : 'female');

  // Single render path to avoid remounting CharacterSprite when sitting state changes.
  // This prevents animation glitches and trembling.
  return (
    <motion.button
      type="button"
      onClick={onClick}
      // Disable bob animation when sitting
      animate={{ y: (walking && !sitting) ? [0, -1, 0] : 0 }}
      transition={{
        y: (walking && !sitting)
          ? { repeat: Infinity, duration: 0.52, ease: 'linear' }
          : { duration: 0.2 },
      }}
      className="relative outline-none cursor-pointer block p-0 border-0 bg-transparent"
      style={{ 
        width: size, 
        height: sitting ? size * 1.1 : size * 1.4,
        zIndex: 10
      }}
      title={`${agent.name} · ${agent.title}`}
    >
      {/* Status dot — positioned relative to the container */}
      <div
        className="absolute right-0 top-0 w-2.5 h-2.5 rounded-full border border-bg-900 shadow-lg z-20"
        style={{ background: statusColor }}
        title={statusLabel}
      />
      
      <CharacterSprite
        agentId={agent.id}
        gender={gender}
        facing={sitting ? 'up' : facing}
        walking={sitting ? false : Boolean(walking)}
        sitting={sitting}
        size={size}
        accent={agent.color}
        skinTone={agent.skinTone}
      />
    </motion.button>
  );
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}
