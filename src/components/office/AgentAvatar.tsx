import { motion } from 'framer-motion';
import type { Agent, Gender } from '../../types';
import { CharacterSprite, type Facing } from './CharacterSprite';

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
  const gender: Gender =
    agent.gender ?? (hashString(agent.id) % 2 === 0 ? 'male' : 'female');

  // SITTING: no framer-motion at all — guarantees zero trembling.
  if (sitting) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="relative outline-none cursor-pointer block p-0 border-0 bg-transparent"
        style={{ width: size, height: size * 1.1 }}
        title={`${agent.name} · ${agent.title}`}
      >
        <CharacterSprite
          agentId={agent.id}
          gender={gender}
          facing="up"
          walking={false}
          sitting
          size={size}
          accent={agent.color}
          skinTone={agent.skinTone}
        />
      </button>
    );
  }

  // STANDING / WALKING: subtle body bob while walking.
  return (
    <motion.button
      type="button"
      onClick={onClick}
      animate={{ y: walking ? [0, -1, 0] : 0 }}
      transition={{
        y: walking
          ? { repeat: Infinity, duration: 0.52, ease: 'linear' }
          : { duration: 0.2 },
      }}
      className="relative outline-none cursor-pointer"
      style={{ width: size, height: size * 1.4 }}
      title={`${agent.name} · ${agent.title}`}
    >
      <CharacterSprite
        agentId={agent.id}
        gender={gender}
        facing={facing}
        walking={Boolean(walking)}
        sitting={false}
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
