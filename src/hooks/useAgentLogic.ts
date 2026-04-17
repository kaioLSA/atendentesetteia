import { useEffect, useRef, useState } from 'react';
import type { Facing } from '../types';
import { useStore } from '../store/useStore';

export interface AgentPos {
  x: number; // grid col (float for smooth motion)
  y: number; // grid row
  facing: Facing;
  walking: boolean;
}

export interface DeskSlot {
  id: number;
  col: number;
  row: number;
}

interface Args {
  cols: number;
  rows: number;
  desks: DeskSlot[];
  /** Cells that should be considered blocked (desks, walls) when wandering */
  blocked: (col: number, row: number) => boolean;
}

/**
 * Drives positions for every agent.
 * - Active or busy agents walk to their assigned desk and stand at the chair.
 * - Idle agents wander randomly between free cells.
 * Returns a stable Record<agentId, AgentPos>.
 */
export function useAgentMovement({ cols, rows, desks, blocked }: Args) {
  const agents = useStore((s) => s.agents);
  const busy = useStore((s) => s.busyAgents);
  const active = useStore((s) => s.activeAgentId);

  const [positions, setPositions] = useState<Record<string, AgentPos>>({});
  const targets = useRef<Record<string, { x: number; y: number } | null>>({});

  // Initialize positions for any new agent
  useEffect(() => {
    setPositions((prev) => {
      const next = { ...prev };
      agents.forEach((a, i) => {
        if (!next[a.id]) {
          // start near their desk
          const slot = desks[i % desks.length];
          next[a.id] = {
            x: slot ? slot.col + 0.5 : 1,
            y: slot ? slot.row + 1.4 : 1,
            facing: 'down',
            walking: false,
          };
        }
      });
      // remove positions for agents that no longer exist
      Object.keys(next).forEach((id) => {
        if (!agents.find((a) => a.id === id)) delete next[id];
      });
      return next;
    });
  }, [agents, desks]);

  // Decide a target for each agent every ~2.5s
  useEffect(() => {
    const id = window.setInterval(() => {
      agents.forEach((a, i) => {
        const isBusy = busy.includes(a.id) || active === a.id;
        if (isBusy) {
          // Go to chair just below the desk
          const slot = desks[i % desks.length];
          if (slot) {
            targets.current[a.id] = {
              x: slot.col + 0.5,
              y: slot.row + 1.4,
            };
          }
        } else {
          // wander: pick a random free cell within bounds
          for (let tries = 0; tries < 12; tries++) {
            const x = Math.floor(Math.random() * (cols - 2)) + 1;
            const y = Math.floor(Math.random() * (rows - 2)) + 1;
            if (!blocked(x, y)) {
              targets.current[a.id] = { x: x + 0.5, y: y + 0.5 };
              break;
            }
          }
        }
      });
    }, 2500);
    return () => window.clearInterval(id);
  }, [agents, busy, active, cols, rows, desks, blocked]);

  // Movement tick: 60ms step toward target
  useEffect(() => {
    const id = window.setInterval(() => {
      setPositions((prev) => {
        const next: Record<string, AgentPos> = { ...prev };
        for (const a of agents) {
          const cur = next[a.id];
          const tgt = targets.current[a.id];
          if (!cur || !tgt) continue;

          const dx = tgt.x - cur.x;
          const dy = tgt.y - cur.y;
          const dist = Math.hypot(dx, dy);

          if (dist < 0.05) {
            // arrived: face down (or up if at desk so we see their back)
            const slot = desks[agents.indexOf(a) % desks.length];
            const atDesk =
              slot &&
              Math.abs(tgt.x - (slot.col + 0.5)) < 0.05 &&
              Math.abs(tgt.y - (slot.row + 1.4)) < 0.05;
            next[a.id] = {
              ...cur,
              walking: false,
              facing: atDesk ? 'up' : cur.facing,
            };
            continue;
          }

          const step = 0.08;
          const nx = cur.x + (dx / dist) * step;
          const ny = cur.y + (dy / dist) * step;
          let facing: Facing = cur.facing;
          if (Math.abs(dx) > Math.abs(dy)) {
            facing = dx > 0 ? 'right' : 'left';
          } else {
            facing = dy > 0 ? 'down' : 'up';
          }
          next[a.id] = { x: nx, y: ny, facing, walking: true };
        }
        return next;
      });
    }, 60);
    return () => window.clearInterval(id);
  }, [agents, desks]);

  return positions;
}
