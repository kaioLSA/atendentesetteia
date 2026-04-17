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
<<<<<<< HEAD
 * - Active or busy agents walk to their assigned desk and stand at the chair.
 * - Idle agents wander randomly between free cells.
 * Returns a stable Record<agentId, AgentPos>.
=======
 * - Idle agents wander randomly in free cells — never onto a desk.
 * - When given a task (active or busy) they walk to their desk.
 * - Path checks ensure they never cross a desk tile.
>>>>>>> 0c7a388 (Atualização feita em outro PC)
 */
export function useAgentMovement({ cols, rows, desks, blocked }: Args) {
  const agents = useStore((s) => s.agents);
  const busy = useStore((s) => s.busyAgents);
<<<<<<< HEAD
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
=======

  const [positions, setPositions] = useState<Record<string, AgentPos>>({});
  const targets = useRef<
    Record<string, { x: number; y: number; atDesk: boolean } | null>
  >({});

  // Helper: sample points along a straight line and ensure no blocked cell
  function isPathClear(x0: number, y0: number, x1: number, y1: number): boolean {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(4, Math.ceil(dist * 6));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = Math.floor(x0 + (x1 - x0) * t);
      const y = Math.floor(y0 + (y1 - y0) * t);
      if (blocked(x, y)) return false;
    }
    return true;
  }

  // Initialize positions for any new agent — spawn in a free wandering cell.
  useEffect(() => {
    setPositions((prev) => {
      const next = { ...prev };
      agents.forEach((a) => {
        if (!next[a.id]) {
          let x = 2,
            y = 2;
          for (let tries = 0; tries < 30; tries++) {
            const cx = Math.floor(Math.random() * (cols - 2)) + 1;
            const cy = Math.floor(Math.random() * (rows - 2)) + 1;
            if (!blocked(cx, cy)) {
              x = cx + 0.5;
              y = cy + 0.5;
              break;
            }
          }
          next[a.id] = { x, y, facing: 'down', walking: false };
        }
      });
>>>>>>> 0c7a388 (Atualização feita em outro PC)
      Object.keys(next).forEach((id) => {
        if (!agents.find((a) => a.id === id)) delete next[id];
      });
      return next;
    });
<<<<<<< HEAD
  }, [agents, desks]);
=======
  }, [agents, desks, cols, rows, blocked]);
>>>>>>> 0c7a388 (Atualização feita em outro PC)

  // Decide a target for each agent every ~2.5s
  useEffect(() => {
    const id = window.setInterval(() => {
<<<<<<< HEAD
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
=======
      setPositions((curPositions) => {
        agents.forEach((a, i) => {
          const hasTask = busy.includes(a.id);
          const cur = curPositions[a.id];
          if (!cur) return;

          if (hasTask) {
            const slot = desks[i % desks.length];
            if (slot) {
              targets.current[a.id] = {
                x: slot.col + 0.5,
                y: slot.row + 1.4,
                atDesk: true,
              };
            }
          } else {
            // Pick a short, reachable wander target that doesn't cross a desk.
            for (let tries = 0; tries < 30; tries++) {
              // keep the step short so paths stay in the walkable corridor
              const dx = (Math.random() - 0.5) * 6;
              const dy = (Math.random() - 0.5) * 6;
              const tx = Math.max(1, Math.min(cols - 2, cur.x + dx));
              const ty = Math.max(1, Math.min(rows - 2, cur.y + dy));
              if (
                !blocked(Math.floor(tx), Math.floor(ty)) &&
                isPathClear(cur.x, cur.y, tx, ty)
              ) {
                targets.current[a.id] = { x: tx, y: ty, atDesk: false };
                break;
              }
            }
          }
        });
        return curPositions;
      });
    }, 2500);
    return () => window.clearInterval(id);
  }, [agents, busy, cols, rows, desks, blocked]);
>>>>>>> 0c7a388 (Atualização feita em outro PC)

  // Movement tick: 60ms step toward target
  useEffect(() => {
    const id = window.setInterval(() => {
      setPositions((prev) => {
        const next: Record<string, AgentPos> = { ...prev };
        for (const a of agents) {
          const cur = next[a.id];
          const tgt = targets.current[a.id];
<<<<<<< HEAD
          if (!cur || !tgt) continue;
=======
          if (!cur) continue;

          const hasTask = busy.includes(a.id);

          if (!tgt) {
            next[a.id] = { ...cur, walking: false, facing: 'down' };
            continue;
          }
>>>>>>> 0c7a388 (Atualização feita em outro PC)

          const dx = tgt.x - cur.x;
          const dy = tgt.y - cur.y;
          const dist = Math.hypot(dx, dy);

          if (dist < 0.05) {
<<<<<<< HEAD
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
=======
            next[a.id] = {
              ...cur,
              walking: false,
              facing: tgt.atDesk && hasTask ? 'up' : 'down',
>>>>>>> 0c7a388 (Atualização feita em outro PC)
            };
            continue;
          }

<<<<<<< HEAD
          const step = 0.08;
          const nx = cur.x + (dx / dist) * step;
          const ny = cur.y + (dy / dist) * step;
          let facing: Facing = cur.facing;
          if (Math.abs(dx) > Math.abs(dy)) {
            facing = dx > 0 ? 'right' : 'left';
          } else {
            facing = dy > 0 ? 'down' : 'up';
          }
=======
          const step = 0.06;
          const nx = cur.x + (dx / dist) * step;
          const ny = cur.y + (dy / dist) * step;

          // Safety: never step INTO a blocked cell
          if (blocked(Math.floor(nx), Math.floor(ny))) {
            // cancel the target; will re-pick on next tick
            targets.current[a.id] = null;
            next[a.id] = { ...cur, walking: false, facing: 'down' };
            continue;
          }

          let facing: Facing;
          if (hasTask) {
            if (Math.abs(dx) > Math.abs(dy)) {
              facing = dx > 0 ? 'right' : 'left';
            } else {
              facing = dy > 0 ? 'down' : 'up';
            }
          } else {
            // While wandering, always face forward so the user sees the face
            facing = 'down';
          }

>>>>>>> 0c7a388 (Atualização feita em outro PC)
          next[a.id] = { x: nx, y: ny, facing, walking: true };
        }
        return next;
      });
    }, 60);
    return () => window.clearInterval(id);
<<<<<<< HEAD
  }, [agents, desks]);
=======
  }, [agents, desks, busy, blocked]);
>>>>>>> 0c7a388 (Atualização feita em outro PC)

  return positions;
}
