import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { Desk } from './Desk';
import { AgentAvatar } from './AgentAvatar';
import { useAgentMovement, type DeskSlot } from '../../hooks/useAgentLogic';

const COLS = 21;
const ROWS = 12;

// Vertical stone divider between work area and meeting room.
const DIVIDER_COL = 14;
// 4-cell opening in the divider (rows 4–7): one below and two above the
// original row-6 opening, giving a wide entrance into the meeting room.
const DIVIDER_OPENING_START = 4;
const DIVIDER_OPENING_END   = 7;
// Meeting room rectangle (bigger so the table + chairs fit comfortably).
const MEETING = { col: 15, row: 2, w: 5, h: 8 };

/** Top-down pixel office. Matches the reference: stone walls with pillars,
 *  4 desks per row × 3 rows, chairs under each desk, a boxed meeting room
 *  with table + chairs inside and a simple opening (no door). */
export function Grid() {
  const wrapperRef = useRef<HTMLDivElement>(null);

  // cell stays fixed (based on container size only) — zoom is applied via CSS
  // transform so agent positions never change during zoom (no transition glitch).
  const [cell, setCell] = useState(42);
  const [zoom, setZoom] = useState(0.6);
  const [pan, setPan]   = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);

  // ref bundle for drag tracking (avoids stale closures)
  const drag = useRef({ active: false, moved: false, sx: 0, sy: 0, px: 0, py: 0 });

  const [hoveredDesk, setHoveredDesk] = useState<number | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>();
  const enterDesk = (id: number) => { clearTimeout(hoverTimer.current); setHoveredDesk(id); };
  const leaveDesk = () => { hoverTimer.current = setTimeout(() => setHoveredDesk(null), 80); };

  // Resize → update base cell (no zoom applied here)
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      setCell(Math.max(20, Math.floor(Math.min(w / COLS, h / ROWS))));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Scroll-wheel → zoom only (cell stays the same → no agent glitch)
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom(z => Math.max(0.25, Math.min(2.5, z - e.deltaY * 0.0005)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Global mouse-move / mouse-up for panning
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!drag.current.active) return;
      const dx = e.clientX - drag.current.sx;
      const dy = e.clientY - drag.current.sy;
      if (Math.hypot(dx, dy) > 3) drag.current.moved = true;
      setPan({ x: drag.current.px + dx, y: drag.current.py + dy });
    };
    const onUp = () => {
      if (drag.current.active) {
        drag.current.active = false;
        setPanning(false);
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Left button only; don't hijack clicks on agents
    if (e.button !== 0) return;
    e.preventDefault();
    drag.current = { active: true, moved: false, sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y };
    setPanning(true);
  };

  // Suppress click on the grid after a drag so agents aren't accidentally selected
  const handleClick = (e: React.MouseEvent) => {
    if (drag.current.moved) {
      e.stopPropagation();
      drag.current.moved = false;
    }
  };

  const agents = useStore((s) => s.agents);
  const activeAgentId = useStore((s) => s.activeAgentId);
  const setActiveAgent = useStore((s) => s.setActiveAgent);
  const busyAgents = useStore((s) => s.busyAgents);
  const thinkingAgents = useStore((s) => s.thinkingAgents);
  const calledAgents = useStore((s) => s.calledAgents);
  const sitAtDesk = useStore((s) => s.sitAtDesk);
  // Physically seated agents — drives the monitor's green "working" screen.
  // Physically seated agents — drives the monitor's green "working" screen.
  const seatedAgents = useStore((s) => s.seatedAgents);
  const currentFloor = useStore((s) => s.currentFloor);
  const triggerSquadBuilder = useStore((s) => s.triggerSquadBuilder);

  // 3 rows × 4 desks, evenly spaced. Rows [2, 5, 8] give corridors at
  // rows 1, 4, 7, 10 — one open row between every desk+chair pair.
  const deskSlots: DeskSlot[] = useMemo(() => {
    const list: DeskSlot[] = [];
    let id = 0;
    for (const r of [2, 5, 8]) {
      for (const c of [2, 5, 8, 11]) {
        list.push({ id: id++, col: c, row: r });
      }
    }
    return list;
  }, []);

  const { blocked, wanderBlocked, meetingBlocked } = useMemo(() => {
    const hard = new Set<string>(); // walls + desks  (movement collision)
    const soft = new Set<string>(); // also chairs     (wander pathfinding only)
    const meeting = new Set<string>(); // meeting room interior

    // Outer walls
    for (let c = 0; c < COLS; c++) {
      hard.add(`${c},0`);
      hard.add(`${c},${ROWS - 1}`);
    }
    for (let r = 0; r < ROWS; r++) {
      hard.add(`0,${r}`);
      hard.add(`${COLS - 1},${r}`);
    }

    deskSlots.forEach((d) => {
      // Desk surface — 2 cells wide
      hard.add(`${d.col},${d.row}`);
      hard.add(`${d.col + 1},${d.row}`);
      // Chair cell directly below the desk — only blocks wandering, not
      // the busy-agent desk approach (they sit in the chair).
      soft.add(`${d.col},${d.row + 1}`);
    });

    // Divider wall — skip the 4-cell opening (rows DIVIDER_OPENING_START–END)
    for (let r = 1; r < ROWS - 1; r++) {
      if (r >= DIVIDER_OPENING_START && r <= DIVIDER_OPENING_END) continue;
      hard.add(`${DIVIDER_COL},${r}`);
    }

    // Meeting room interior
    for (let r = MEETING.row; r < MEETING.row + MEETING.h; r++) {
      for (let c = MEETING.col; c < MEETING.col + MEETING.w; c++) {
        meeting.add(`${c},${r}`);
      }
    }

    const blockedFn = (col: number, row: number) => hard.has(`${col},${row}`);
    const wanderFn  = (col: number, row: number) =>
      hard.has(`${col},${row}`) || soft.has(`${col},${row}`);
    const meetingFn = (col: number, row: number) => meeting.has(`${col},${row}`);

    return { blocked: blockedFn, wanderBlocked: wanderFn, meetingBlocked: meetingFn };
  }, [deskSlots]);

  const positions = useAgentMovement({
    cols: COLS,
    rows: ROWS,
    desks: deskSlots,
    blocked,
    wanderBlocked,
    meetingBlocked,
  });

  return (
    <div
      ref={wrapperRef}
      className="relative w-full h-full flex items-center justify-center overflow-hidden"
      style={{ cursor: panning ? 'grabbing' : zoom > 0.85 ? 'grab' : 'default' }}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    >
      <div
        className="relative border border-black/70 shadow-2xl"
        style={{
          width: cell * COLS,
          height: cell * ROWS,
          background: '#0c0e22',
          imageRendering: 'pixelated',
          // Zoom via CSS scale (cell unchanged → no agent position glitch).
          // Pan is stored in screen-px; divide by zoom to enter the scaled space.
          transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
          transformOrigin: 'center center',
        }}
      >
        <FloorTiles cell={cell} cols={COLS} rows={ROWS} />
        <StoneWalls
          cell={cell}
          cols={COLS}
          rows={ROWS}
          dividerCol={DIVIDER_COL}
          openingStart={DIVIDER_OPENING_START}
          openingEnd={DIVIDER_OPENING_END}
        />

        {/* Meeting room label */}
        <span
          className="absolute text-[9px] font-mono uppercase tracking-wider text-slate-400/70 select-none pointer-events-none"
          style={{
            left: cell * MEETING.col + 4,
            top: cell * MEETING.row - cell * 0.55,
          }}
        >
          Meeting
        </span>

        {/* ── Meeting room: vertical table + 6 chairs each side ──
            Layout (left → right): entrance | 2-cell gap | 6 chairs | table | 6 chairs | wall
            Chairs are tightly spaced and centred vertically.
            Right chairs are flush against the outer right wall.              */}
        <MeetingTable
          cell={cell}
          col={MEETING.col + 2.3}
          row={MEETING.row + 1.6}
          w={1.9}
          h={4.8}
        />

        {/* Left chairs (6) — ~2 cells from the entrance wall */}
        {[2.0, 2.8, 3.6, 4.4, 5.2, 6.0].map((offset, i) => (
          <Chair
            key={`ml-${i}`}
            cell={cell}
            col={MEETING.col + 2}
            row={MEETING.row + offset}
          />
        ))}

        {/* Right chairs (6) — against the right wall */}
        {[2.0, 2.8, 3.6, 4.4, 5.2, 6.0].map((offset, i) => (
          <Chair
            key={`mr-${i}`}
            cell={cell}
            col={MEETING.col + MEETING.w - 0.5}
            row={MEETING.row + offset}
          />
        ))}

        {/* ── Desk zones: chair + desk surface, both clickable ── */}
        {deskSlots.map((d) => {
          const owner     = agents.find((a) => a.desk === d.id && (a.floor ?? 0) === currentFloor);
          // Monitor only goes green once the agent is physically seated —
          // not as soon as a task is assigned.
          const isWorking = owner != null && seatedAgents.includes(owner.id);
          const isHovered = hoveredDesk === d.id && owner != null;
          const hoverGlow = isHovered
            ? '0 0 0 2px rgba(255,255,255,0.85), 0 0 10px rgba(255,255,255,0.2)'
            : undefined;
          const handleClick = owner
            ? (e: React.MouseEvent) => { 
                e.stopPropagation(); 
                if (owner.id === 'ceo') {
                  triggerSquadBuilder();
                } else {
                  sitAtDesk(owner.id); 
                }
              }
            : undefined;

          return (
            <React.Fragment key={d.id}>
              {/* Chair */}
              <div
                className="absolute"
                style={{ zIndex: (d.row + 1) * 10 - 1 }}
              >
                <Chair
                  cell={cell}
                  col={d.col + 0.5}
                  row={d.row + 1.15}
                  label={owner ? `Chamar ${owner.name}` : undefined}
                  highlighted={isHovered}
                  onClick={handleClick}
                  onMouseEnter={owner ? () => enterDesk(d.id) : undefined}
                  onMouseLeave={owner ? leaveDesk : undefined}
                />
              </div>
              {/* Desk surface */}
              <div
                className="absolute"
                style={{
                  left: d.col * cell,
                  top:  d.row * cell + cell * 0.2,
                  width:  cell * 2,
                  height: cell,
                  zIndex: (d.row + 1) * 10,
                  boxShadow: hoverGlow,
                  borderRadius: 2,
                  transition: 'box-shadow 0.15s',
                  cursor: owner ? 'pointer' : 'default',
                }}
                onClick={handleClick}
                onMouseEnter={owner ? () => enterDesk(d.id) : undefined}
                onMouseLeave={owner ? leaveDesk : undefined}
              >
                <Desk cell={cell} working={isWorking} />
              </div>
            </React.Fragment>
          );
        })}

        {/* Agents */}
        {agents.filter(a => (a.floor ?? 0) === currentFloor).map((a) => {
          const pos = positions[a.id];
          if (!pos) return null;
          const size = cell * 0.9;
          const isSitting = !pos.walking && pos.facing === 'up';

          return (
            <div
              key={a.id}
              className="absolute"
              style={{
                left: pos.x * cell - size / 2,
                top: pos.y * cell - size * (isSitting ? 1.05 : 1.2),
                width: size,
                // When sitting the sprite is clipped to head+torso only
                // (~15/20 of full height). Shrink container to match so
                // the empty space below does not eat chair click events.
                height: isSitting ? size * 1.1 : size * 1.4,
                // No transition when sitting — prevents the CSS animation from
                // re-firing every 60 ms and causing a trembling effect.
                transition: isSitting ? 'none' : 'left 80ms linear, top 80ms linear',
                zIndex: Math.floor(pos.y * 10),
                pointerEvents: 'auto',
              }}
            >
              {thinkingAgents.includes(a.id) && <ThinkingBubble cell={cell} />}
              <AgentAvatar
                agent={a}
                size={size}
                facing={pos.facing}
                walking={pos.walking}
                sitting={isSitting}
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

/* -------------------------------------------------------------------------- */
/* Meeting table                                                               */
/* -------------------------------------------------------------------------- */

function MeetingTable({
  cell,
  col,
  row,
  w,
  h,
}: {
  cell: number;
  col: number;
  row: number;
  w: number;
  h: number;
}) {
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: col * cell,
        top: row * cell,
        width: w * cell,
        height: h * cell,
        background:
          'linear-gradient(180deg, #b07a45 0%, #8b5a2b 60%, #6e4520 100%)',
        border: '1px solid rgba(0,0,0,0.75)',
        boxShadow:
          'inset 0 -2px 0 rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15)',
        borderRadius: 2,
      }}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Chair                                                                       */
/* -------------------------------------------------------------------------- */

function Chair({
  cell,
  col,
  row,
  onClick,
  label,
  highlighted,
  onMouseEnter,
  onMouseLeave,
}: {
  cell: number;
  col: number;
  row: number;
  onClick?: (e: React.MouseEvent) => void;
  label?: string;
  highlighted?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const w = cell * 0.55;
  const h = cell * 0.5;
  return (
    <div
      className="absolute"
      style={{
        left: col * cell - w / 2,
        top:  row * cell,
        width: w,
        height: h,
        pointerEvents: onClick ? 'auto' : 'none',
        cursor:    onClick ? 'pointer' : 'default',
        boxShadow: highlighted ? '0 0 0 2px rgba(255,255,255,0.85)' : undefined,
        borderRadius: 1,
        transition: 'box-shadow 0.15s',
      }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      title={label}
    >
      {/* backrest */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          top: 0,
          width: w * 0.8,
          height: h * 0.45,
          background: '#2a3258',
          border: '1px solid rgba(0,0,0,0.6)',
          borderRadius: 1,
        }}
      />
      {/* seat */}
      <div
        className="absolute left-0 right-0"
        style={{
          bottom: 0,
          height: h * 0.55,
          background: '#1e2444',
          border: '1px solid rgba(0,0,0,0.6)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)',
          borderRadius: 1,
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Thinking bubble (shown above agent while Claude is replying)                */
/* -------------------------------------------------------------------------- */

function ThinkingBubble({ cell }: { cell: number }) {
  const dotSize = Math.max(3, Math.floor(cell * 0.13));
  return (
    <div
      className="absolute pointer-events-none select-none"
      style={{
        bottom: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        marginBottom: 2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1,
      }}
    >
      {/* Bubble body — paddingTop must be > bounce height to avoid overflow */}
      <div
        style={{
          background: 'rgba(255,255,255,0.93)',
          border: '1px solid rgba(0,0,0,0.18)',
          borderRadius: dotSize * 1.5,
          paddingTop: dotSize * 1.6,
          paddingBottom: dotSize * 0.6,
          paddingLeft: dotSize * 1.2,
          paddingRight: dotSize * 1.2,
          display: 'flex',
          gap: dotSize * 0.7,
          alignItems: 'flex-end',
          boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: dotSize,
              height: dotSize,
              borderRadius: '50%',
              background: '#555',
              display: 'inline-block',
              animation: 'thinkDot 1.1s ease-in-out infinite',
              animationDelay: `${i * 0.18}s`,
            }}
          />
        ))}
      </div>
      {/* Small tail */}
      <div
        style={{
          width: 0,
          height: 0,
          borderLeft: `${dotSize * 0.7}px solid transparent`,
          borderRight: `${dotSize * 0.7}px solid transparent`,
          borderTop: `${dotSize * 0.9}px solid rgba(255,255,255,0.93)`,
          marginTop: -1,
        }}
      />
      <style>{`
        @keyframes thinkDot {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30%            { transform: translateY(-${dotSize * 0.9}px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Floor                                                                       */
/* -------------------------------------------------------------------------- */

function FloorTiles({
  cell,
  cols,
  rows,
}: {
  cell: number;
  cols: number;
  rows: number;
}) {
  return (
    <div
      className="grid absolute"
      style={{
        left: cell,
        top: cell,
        width: cell * (cols - 2),
        height: cell * (rows - 2),
        gridTemplateColumns: `repeat(${cols - 2}, ${cell}px)`,
        gridTemplateRows: `repeat(${rows - 2}, ${cell}px)`,
      }}
    >
      {Array.from({ length: (rows - 2) * (cols - 2) }, (_, i) => {
        const r = Math.floor(i / (cols - 2));
        const c = i % (cols - 2);
        const dark = (r + c) % 2 === 0;
        return (
          <div
            key={i}
            style={{
              background: dark ? '#1b203f' : '#161a36',
              boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.2)',
            }}
          />
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Stone brick walls with periodic pillars                                     */
/* -------------------------------------------------------------------------- */

function StoneWalls({
  cell,
  cols,
  rows,
  dividerCol,
  openingStart,
  openingEnd,
}: {
  cell: number;
  cols: number;
  rows: number;
  dividerCol: number;
  openingStart: number;
  openingEnd: number;
}) {
  const brick = (row: number) => ({
    background: '#2a2f4e',
    boxShadow:
      'inset -2px -2px 0 rgba(0,0,0,0.55), inset 2px 2px 0 rgba(130,140,190,0.22)',
    backgroundImage: `
      linear-gradient(90deg, rgba(0,0,0,0.55) 1px, transparent 1px),
      linear-gradient(180deg, rgba(0,0,0,0.55) 1px, transparent 1px)
    `,
    backgroundSize: `${cell / 2}px ${cell / 2}px`,
    backgroundPosition: row % 2 === 0 ? '0 0' : `${cell / 4}px 0`,
  });

  const pillar = () => ({
    background: '#1f2340',
    boxShadow:
      'inset -2px 0 0 rgba(0,0,0,0.6), inset 2px 0 0 rgba(150,160,210,0.25)',
  });

  const tiles: JSX.Element[] = [];

  for (let c = 0; c < cols; c++) {
    const isPillar = c % 4 === 0;
    tiles.push(
      <div
        key={`top-${c}`}
        className="absolute"
        style={{
          left: c * cell,
          top: 0,
          width: cell,
          height: cell,
          ...(isPillar ? pillar() : brick(0)),
        }}
      />
    );
    tiles.push(
      <div
        key={`bot-${c}`}
        className="absolute"
        style={{
          left: c * cell,
          top: (rows - 1) * cell,
          width: cell,
          height: cell,
          ...(isPillar ? pillar() : brick(rows - 1)),
        }}
      />
    );
  }

  for (let r = 1; r < rows - 1; r++) {
    const isPillar = r % 3 === 0;
    tiles.push(
      <div
        key={`left-${r}`}
        className="absolute"
        style={{
          left: 0,
          top: r * cell,
          width: cell,
          height: cell,
          ...(isPillar ? pillar() : brick(r)),
        }}
      />
    );
    tiles.push(
      <div
        key={`right-${r}`}
        className="absolute"
        style={{
          left: (cols - 1) * cell,
          top: r * cell,
          width: cell,
          height: cell,
          ...(isPillar ? pillar() : brick(r)),
        }}
      />
    );
  }

  // Divider — 4-cell opening from openingStart to openingEnd
  for (let r = 1; r < rows - 1; r++) {
    if (r >= openingStart && r <= openingEnd) continue;
    tiles.push(
      <div
        key={`div-${r}`}
        className="absolute"
        style={{
          left: dividerCol * cell,
          top: r * cell,
          width: cell,
          height: cell,
          ...brick(r),
        }}
      />
    );
  }

  return <>{tiles}</>;
}
