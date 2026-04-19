import { useEffect, useRef, useState } from 'react';
import type { Facing } from '../types';
import { useStore, markAgentAtDesk } from '../store/useStore';

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
  /** Cells that are hard-blocked (walls + desks): used for movement collision. */
  blocked: (col: number, row: number) => boolean;
  /**
   * Cells blocked for *wandering* only (walls + desks + chairs).
   * Wandering agents won't target or path through these cells, but busy agents
   * heading to their desks are not affected (they may cross chair cells).
   */
  wanderBlocked: (col: number, row: number) => boolean;
}

/** How long (ms) an agent lingers at their desk after finishing a task. */
const LINGER_MS = 2000;

/** BFS shortest path on the hard-blocked grid. Returns intermediate waypoints
 *  (cell centres) plus the exact final position, or null if unreachable. */
function bfsPath(
  fromX: number, fromY: number,
  toX:   number, toY:   number,
  blockedFn: (c: number, r: number) => boolean,
  cols: number,
  rows: number,
): Array<{ x: number; y: number }> | null {
  const fC = Math.floor(fromX), fR = Math.floor(fromY);
  const tC = Math.floor(toX),   tR = Math.floor(toY);
  if (fC === tC && fR === tR) return [{ x: toX, y: toY }];

  const K = (c: number, r: number) => c * 100 + r;
  const visited = new Set<number>([K(fC, fR)]);
  const parent  = new Map<number, number>();
  const queue: [number, number][] = [[fC, fR]];
  const DIRS: [number, number][] = [[0, 1], [0, -1], [1, 0], [-1, 0]];

  let found = false;
  outer: while (queue.length) {
    const [c, r] = queue.shift()!;
    for (const [dc, dr] of DIRS) {
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      if (blockedFn(nc, nr)) continue;
      const nk = K(nc, nr);
      if (visited.has(nk)) continue;
      visited.add(nk);
      parent.set(nk, K(c, r));
      if (nc === tC && nr === tR) { found = true; break outer; }
      queue.push([nc, nr]);
    }
  }
  if (!found) return null;

  const path: Array<{ x: number; y: number }> = [];
  let k = K(tC, tR);
  const startK = K(fC, fR);
  while (parent.has(k) && k !== startK) {
    const p = parent.get(k)!;
    if (p !== startK) {
      const pc = Math.floor(p / 100), pr = p % 100;
      path.unshift({ x: pc + 0.5, y: pr + 0.5 });
    }
    k = p;
  }
  path.push({ x: toX, y: toY });
  return path;
}

/**
 * Drives positions for every agent.
 * - Idle agents wander randomly in free cells — never onto a desk.
 * - When given a task (busy) they walk to THEIR OWN desk (agent.desk index).
 * - After finishing they linger at the desk for LINGER_MS before wandering.
 * - Sprite always faces the direction of movement; faces screen (up) at desk.
 */
export function useAgentMovement({ cols, rows, desks, blocked, wanderBlocked }: Args) {
  const agents = useStore((s) => s.agents);
  const busy   = useStore((s) => s.busyAgents);
  const called = useStore((s) => s.calledAgents);

  const [positions, setPositions] = useState<Record<string, AgentPos>>({});
  const targets     = useRef<Record<string, { x: number; y: number; atDesk: boolean } | null>>({});
  const lingerUntil = useRef<Record<string, number>>({});
  const prevBusy    = useRef<Set<string>>(new Set());
  // Track which agents have already fired markAgentAtDesk(true) to avoid
  // spamming the callback every tick while they're seated.
  const wasAtDesk   = useRef<Set<string>>(new Set());
  const waypoints  = useRef<Record<string, Array<{ x: number; y: number }>>>({});

  // Helper: sample points along a straight line and ensure no blocked cell.
  // Starts from i=1 and also skips any sample that still lands in the agent's
  // own starting cell — agents seated at a desk (wander-blocked chair cell)
  // would otherwise fail every wander attempt and stay stuck forever.
  function isPathClear(x0: number, y0: number, x1: number, y1: number): boolean {
    const startC = Math.floor(x0), startR = Math.floor(y0);
    const dist  = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(4, Math.ceil(dist * 6));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = Math.floor(x0 + (x1 - x0) * t);
      const y = Math.floor(y0 + (y1 - y0) * t);
      if (x === startC && y === startR) continue; // still in own cell — skip
      if (wanderBlocked(x, y)) return false;
    }
    return true;
  }

  // Initialize positions for any new agent — spawn in a free wandering cell.
  useEffect(() => {
    setPositions((prev) => {
      const next = { ...prev };
      agents.forEach((a) => {
        if (!next[a.id]) {
          let x = 2, y = 2;
          for (let tries = 0; tries < 30; tries++) {
            const cx = Math.floor(Math.random() * (cols - 2)) + 1;
            const cy = Math.floor(Math.random() * (rows - 2)) + 1;
            if (!blocked(cx, cy)) { x = cx + 0.5; y = cy + 0.5; break; }
          }
          next[a.id] = { x, y, facing: 'down', walking: false };
        }
      });
      Object.keys(next).forEach((id) => {
        if (!agents.find((a) => a.id === id)) delete next[id];
      });
      return next;
    });
  }, [agents, desks, cols, rows, blocked]);

  // When an agent first becomes busy or called, immediately point them at their desk
  // so they don't wait up to 2.5 s for the regular interval to fire.
  useEffect(() => {
    const deskSet = new Set([...busy, ...called]);
    agents.forEach((a) => {
      if (!deskSet.has(a.id)) return;
      const slot = desks[a.desk % desks.length];
      if (slot) {
        targets.current[a.id]   = { x: slot.col + 0.5, y: slot.row + 1.4, atDesk: true };
        waypoints.current[a.id] = [];
      }
    });
  }, [busy, called]); // eslint-disable-line react-hooks/exhaustive-deps

  // Decide a target for each agent every ~2.5s
  useEffect(() => {
    const id = window.setInterval(() => {
      setPositions((curPositions) => {
        const currentBusySet = new Set(busy);

        // Detect agents that just finished a task → start their linger timer
        prevBusy.current.forEach((agentId) => {
          if (!currentBusySet.has(agentId)) {
            lingerUntil.current[agentId] = Date.now() + LINGER_MS;
          }
        });
        prevBusy.current = new Set(currentBusySet);

        agents.forEach((a) => {
          const hasTask = busy.includes(a.id) || called.includes(a.id);
          const cur     = curPositions[a.id];
          if (!cur) return;

          if (hasTask) {
            // Walk to THIS agent's own desk (by desk index, not array position)
            const slot = desks[a.desk % desks.length];
            if (slot) {
              targets.current[a.id] = {
                x: slot.col + 0.5,
                y: slot.row + 1.4,
                atDesk: true,
              };
            }
          } else if (Date.now() < (lingerUntil.current[a.id] ?? 0)) {
            // Still lingering at desk after finishing — keep current target
          } else {
            // Pick a short, reachable wander target
            for (let tries = 0; tries < 30; tries++) {
              const dx = (Math.random() - 0.5) * 6;
              const dy = (Math.random() - 0.5) * 6;
              const tx = Math.max(1, Math.min(cols - 2, cur.x + dx));
              const ty = Math.max(1, Math.min(rows - 2, cur.y + dy));
              if (
                !wanderBlocked(Math.floor(tx), Math.floor(ty)) &&
                isPathClear(cur.x, cur.y, tx, ty)
              ) {
                targets.current[a.id] = { x: tx, y: ty, atDesk: false };
                waypoints.current[a.id] = [];
                // Clear desk status so sendMessage can await next arrival
                if (wasAtDesk.current.has(a.id)) {
                  wasAtDesk.current.delete(a.id);
                  markAgentAtDesk(a.id, false);
                }
                break;
              }
            }
          }
        });
        return curPositions;
      });
    }, 2500);
    return () => window.clearInterval(id);
  }, [agents, busy, called, cols, rows, desks, blocked]);

  // Movement tick: 60 ms step toward target (with BFS obstacle avoidance).
  // CRITICAL: when NO agent changed this tick, we return the SAME `prev`
  // reference so React bails out of the re-render. This prevents framer-motion
  // from re-firing animations every tick, which was causing seated agents to
  // tremble.
  useEffect(() => {
    const id = window.setInterval(() => {
      setPositions((prev) => {
        let next: Record<string, AgentPos> = prev;
        let dirty = false;
        const mut = (id: string, pos: AgentPos) => {
          if (!dirty) { next = { ...prev }; dirty = true; }
          next[id] = pos;
        };

        for (const a of agents) {
          const cur = prev[a.id];
          const tgt = targets.current[a.id];
          if (!cur) continue;

          if (!tgt) {
            if (cur.walking) mut(a.id, { ...cur, walking: false });
            continue;
          }

          // Use first waypoint as the immediate destination when one exists.
          const wp = waypoints.current[a.id];
          const hasWp = wp && wp.length > 0;
          const eff   = hasWp ? wp[0] : tgt;

          const dx   = eff.x - cur.x;
          const dy   = eff.y - cur.y;
          const dist = Math.hypot(dx, dy);

          // Arrival threshold — lenient for intermediate waypoints.
          const threshold = hasWp ? 0.35 : 0.05;

          if (dist < threshold) {
            if (hasWp) {
              wp.shift(); // advance to next waypoint
              mut(a.id, { ...cur, walking: wp.length > 0 });
              continue;
            }

            // Reached final target — snap and settle.
            const alreadyThere = cur.x === tgt.x && cur.y === tgt.y && !cur.walking;
            if (!alreadyThere) {
              if (tgt.atDesk && !wasAtDesk.current.has(a.id)) {
                wasAtDesk.current.add(a.id);
                markAgentAtDesk(a.id, true);
              }
              mut(a.id, {
                x: tgt.x, y: tgt.y,
                walking: false,
                facing: tgt.atDesk ? 'up' : 'down',
              });
            }
            // already at target → don't touch, contributes nothing to re-render.
            continue;
          }

          const step = tgt.atDesk ? 0.15 : 0.06;
          const nx   = cur.x + (dx / dist) * step;
          const ny   = cur.y + (dy / dist) * step;

          if (blocked(Math.floor(nx), Math.floor(ny))) {
            if (tgt.atDesk && !hasWp) {
              // Blocked on the way to desk — find a path around.
              const path = bfsPath(cur.x, cur.y, tgt.x, tgt.y, blocked, cols, rows);
              if (path?.length) {
                waypoints.current[a.id] = path;
              } else {
                targets.current[a.id] = null;
              }
            } else if (!tgt.atDesk) {
              targets.current[a.id] = null;
            }
            if (cur.walking) mut(a.id, { ...cur, walking: false });
            continue;
          }

          let facing: Facing;
          if (tgt.atDesk) {
            facing = 'up';
          } else if (Math.abs(dx) > Math.abs(dy)) {
            facing = dx > 0 ? 'right' : 'left';
          } else {
            facing = dy > 0 ? 'down' : 'up';
          }

          mut(a.id, { x: nx, y: ny, facing, walking: true });
        }

        // Returning `prev` (when nothing changed) tells React to skip re-render.
        return next;
      });
    }, 60);
    return () => window.clearInterval(id);
  }, [agents, desks, busy, blocked]);

  return positions;
}
