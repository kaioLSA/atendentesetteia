import { useMemo, useRef, useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { Desk } from './Desk';
import { AgentAvatar } from './AgentAvatar';
import { useAgentMovement, type DeskSlot } from '../../hooks/useAgentLogic';

const COLS = 16;
const ROWS = 9;

/** Top-down 2D office: checker floor + desks + meeting room. */
export function Grid() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [cell, setCell] = useState(36);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      const s = Math.floor(Math.min(w / COLS, h / ROWS));
      setCell(Math.max(22, Math.min(60, s)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const agents = useStore((s) => s.agents);
  const activeAgentId = useStore((s) => s.activeAgentId);
  const setActiveAgent = useStore((s) => s.setActiveAgent);

  // Desk layout: 3 rows of desks (rows 1, 3, 5), 4 desks per row in left zone
  const deskSlots: DeskSlot[] = useMemo(() => {
    const list: DeskSlot[] = [];
    let id = 0;
    for (let r = 1; r <= 5; r += 2) {
      for (let c = 1; c <= 8; c += 2) {
        list.push({ id: id++, col: c, row: r });
      }
    }
    return list;
  }, []);

  // A cell is blocked if it overlaps a desk or the meeting room
  const blocked = useMemo(() => {
    const set = new Set<string>();
    deskSlots.forEach((d) => {
      set.add(`${d.col},${d.row}`);
      set.add(`${d.col + 1},${d.row}`);
    });
    // meeting room
    for (let r = 2; r < 6; r++) {
      for (let c = 11; c < 13; c++) set.add(`${c},${r}`);
    }
    return (col: number, row: number) => set.has(`${col},${row}`);
  }, [deskSlots]);

  const positions = useAgentMovement({
    cols: COLS,
    rows: ROWS,
    desks: deskSlots,
    blocked,
  });

  const floorCells = useMemo(
    () =>
      Array.from({ length: ROWS * COLS }, (_, i) => {
        const r = Math.floor(i / COLS);
        const c = i % COLS;
        return (r + c) % 2 === 0 ? 'bg-pixel-floor' : 'bg-pixel-floorAlt';
      }),
    []
  );

  return (
    <div
      ref={wrapperRef}
      className="relative w-full h-full flex items-center justify-center"
    >
      <div
        className="relative border border-accent-purple/20 shadow-glow"
        style={{
          width: cell * COLS,
          height: cell * ROWS,
          background: '#0c0e22',
        }}
      >
        {/* Floor checker */}
        <div
          className="grid absolute inset-0"
          style={{
            gridTemplateColumns: `repeat(${COLS}, ${cell}px)`,
            gridTemplateRows: `repeat(${ROWS}, ${cell}px)`,
          }}
        >
          {floorCells.map((cls, i) => (
            <div key={i} className={`${cls} border border-black/10`} />
          ))}
        </div>

        {/* Meeting room */}
        <div
          className="absolute bg-pixel-wood border border-black/40"
          style={{
            left: cell * 11,
            top: cell * 2,
            width: cell * 2,
            height: cell * 4,
            boxShadow: 'inset 0 0 0 2px rgba(0,0,0,0.3)',
          }}
        />
        <span
          className="absolute text-[9px] font-mono uppercase tracking-wider text-amber-300/70"
          style={{ left: cell * 11.1, top: cell * 1.55 }}
        >
          Meeting
        </span>

        {/* Desks */}
        {deskSlots.map((d) => (
          <div
            key={d.id}
            className="absolute"
            style={{
              left: d.col * cell,
              top: d.row * cell + cell * 0.2,
              width: cell * 2,
              height: cell,
            }}
          >
            <Desk cell={cell} />
          </div>
        ))}

        {/* Agents */}
        {agents.map((a) => {
          const pos = positions[a.id];
          if (!pos) return null;
          const size = cell * 0.95;
          return (
            <div
              key={a.id}
              className="absolute"
              style={{
                left: pos.x * cell - size / 2,
                top: pos.y * cell - size,
                width: size,
                height: size,
                transition: 'left 80ms linear, top 80ms linear',
                zIndex: Math.floor(pos.y * 10),
              }}
            >
              <AgentAvatar
                agent={a}
                size={size}
                facing={pos.facing}
                walking={pos.walking}
                active={a.id === activeAgentId}
                onClick={() => setActiveAgent(a.id)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
