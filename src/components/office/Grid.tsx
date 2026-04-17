import { useMemo, useRef, useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { Desk } from './Desk';
import { AgentAvatar } from './AgentAvatar';
import { useAgentMovement, type DeskSlot } from '../../hooks/useAgentLogic';

<<<<<<< HEAD
const COLS = 16;
const ROWS = 9;

/** Top-down 2D office: checker floor + desks + meeting room. */
=======
const COLS = 21;
const ROWS = 12;

// Vertical stone divider between work area and meeting room.
const DIVIDER_COL = 14;
// One-cell opening (no door) in the divider — agents can walk through.
const DIVIDER_OPENING_ROW = 6;
// Meeting room rectangle (bigger so the table + chairs fit comfortably).
const MEETING = { col: 15, row: 2, w: 5, h: 8 };

/** Top-down pixel office. Matches the reference: stone walls with pillars,
 *  4 desks per row × 3 rows, chairs under each desk, a boxed meeting room
 *  with table + chairs inside and a simple opening (no door). */
>>>>>>> 0c7a388 (Atualização feita em outro PC)
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
<<<<<<< HEAD
      setCell(Math.max(22, Math.min(60, s)));
=======
      setCell(Math.max(22, Math.min(52, s)));
>>>>>>> 0c7a388 (Atualização feita em outro PC)
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const agents = useStore((s) => s.agents);
  const activeAgentId = useStore((s) => s.activeAgentId);
  const setActiveAgent = useStore((s) => s.setActiveAgent);

<<<<<<< HEAD
  // Desk layout: 3 rows of desks (rows 1, 3, 5), 4 desks per row in left zone
  const deskSlots: DeskSlot[] = useMemo(() => {
    const list: DeskSlot[] = [];
    let id = 0;
    for (let r = 1; r <= 5; r += 2) {
      for (let c = 1; c <= 8; c += 2) {
=======
  // 3 rows × 4 desks. Gap between left wall (col 0) and the first desk.
  const deskSlots: DeskSlot[] = useMemo(() => {
    const list: DeskSlot[] = [];
    let id = 0;
    for (const r of [2, 6, 9]) {
      for (const c of [2, 5, 8, 11]) {
>>>>>>> 0c7a388 (Atualização feita em outro PC)
        list.push({ id: id++, col: c, row: r });
      }
    }
    return list;
  }, []);

<<<<<<< HEAD
  // A cell is blocked if it overlaps a desk or the meeting room
  const blocked = useMemo(() => {
    const set = new Set<string>();
=======
  const blocked = useMemo(() => {
    const set = new Set<string>();

    // Outer walls
    for (let c = 0; c < COLS; c++) {
      set.add(`${c},0`);
      set.add(`${c},${ROWS - 1}`);
    }
    for (let r = 0; r < ROWS; r++) {
      set.add(`0,${r}`);
      set.add(`${COLS - 1},${r}`);
    }

    // Desks (2 cells wide) + the chair cell right below them (agents need
    // to approach from elsewhere so they don't step into the chair)
>>>>>>> 0c7a388 (Atualização feita em outro PC)
    deskSlots.forEach((d) => {
      set.add(`${d.col},${d.row}`);
      set.add(`${d.col + 1},${d.row}`);
    });
<<<<<<< HEAD
    // meeting room
    for (let r = 2; r < 6; r++) {
      for (let c = 11; c < 13; c++) set.add(`${c},${r}`);
    }
=======

    // Divider wall with an opening at DIVIDER_OPENING_ROW
    for (let r = 1; r < ROWS - 1; r++) {
      if (r === DIVIDER_OPENING_ROW) continue;
      set.add(`${DIVIDER_COL},${r}`);
    }

    // Meeting room interior (don't wander in)
    for (let r = MEETING.row; r < MEETING.row + MEETING.h; r++) {
      for (let c = MEETING.col; c < MEETING.col + MEETING.w; c++) {
        set.add(`${c},${r}`);
      }
    }

>>>>>>> 0c7a388 (Atualização feita em outro PC)
    return (col: number, row: number) => set.has(`${col},${row}`);
  }, [deskSlots]);

  const positions = useAgentMovement({
    cols: COLS,
    rows: ROWS,
    desks: deskSlots,
    blocked,
  });

<<<<<<< HEAD
  const floorCells = useMemo(
    () =>
      Array.from({ length: ROWS * COLS }, (_, i) => {
        const r = Math.floor(i / COLS);
        const c = i % COLS;
        return (r + c) % 2 === 0 ? 'bg-pixel-floor' : 'bg-pixel-floorAlt';
      }),
    []
  );

=======
>>>>>>> 0c7a388 (Atualização feita em outro PC)
  return (
    <div
      ref={wrapperRef}
      className="relative w-full h-full flex items-center justify-center"
    >
      <div
<<<<<<< HEAD
        className="relative border border-accent-purple/20 shadow-glow"
=======
        className="relative border border-black/70 shadow-2xl"
>>>>>>> 0c7a388 (Atualização feita em outro PC)
        style={{
          width: cell * COLS,
          height: cell * ROWS,
          background: '#0c0e22',
<<<<<<< HEAD
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
=======
          imageRendering: 'pixelated',
        }}
      >
        <FloorTiles cell={cell} cols={COLS} rows={ROWS} />
        <StoneWalls
          cell={cell}
          cols={COLS}
          rows={ROWS}
          dividerCol={DIVIDER_COL}
          openingRow={DIVIDER_OPENING_ROW}
        />

        {/* Meeting room wooden floor */}
        <div
          className="absolute"
          style={{
            left: cell * MEETING.col,
            top: cell * MEETING.row,
            width: cell * MEETING.w,
            height: cell * MEETING.h,
            background:
              'linear-gradient(180deg, #8a5a2a 0%, #704620 60%, #5a3718 100%)',
            boxShadow:
              'inset 0 0 0 2px rgba(0,0,0,0.65), inset 0 0 0 4px rgba(80,45,20,0.4), inset 0 0 26px rgba(0,0,0,0.4)',
            border: '1px solid rgba(0,0,0,0.7)',
          }}
        />
        <span
          className="absolute text-[9px] font-mono uppercase tracking-wider text-amber-200/80 select-none pointer-events-none"
          style={{
            left: cell * MEETING.col + 4,
            top: cell * MEETING.row - cell * 0.55,
          }}
>>>>>>> 0c7a388 (Atualização feita em outro PC)
        >
          Meeting
        </span>

<<<<<<< HEAD
        {/* Desks */}
=======
        {/* Meeting table (centered) */}
        <MeetingTable
          cell={cell}
          col={MEETING.col + 1.2}
          row={MEETING.row + 2.2}
          w={MEETING.w - 2.4}
          h={MEETING.h - 4.4}
        />

        {/* Chairs around the meeting table */}
        <Chair cell={cell} col={MEETING.col + 1.5} row={MEETING.row + 1.2} />
        <Chair cell={cell} col={MEETING.col + 3.5} row={MEETING.row + 1.2} />
        <Chair cell={cell} col={MEETING.col + 1.5} row={MEETING.row + 6.6} />
        <Chair cell={cell} col={MEETING.col + 3.5} row={MEETING.row + 6.6} />
        <Chair cell={cell} col={MEETING.col + 0.4} row={MEETING.row + 3.5} />
        <Chair cell={cell} col={MEETING.col + 4.6} row={MEETING.row + 3.5} />

        {/* Desk chairs (one per desk) — drawn with z-index so characters
            properly appear in front when below, behind when above */}
        {deskSlots.map((d) => (
          <div
            key={`chair-${d.id}`}
            className="absolute"
            style={{ zIndex: (d.row + 1) * 10 - 1 }}
          >
            <Chair cell={cell} col={d.col + 0.5} row={d.row + 1.15} />
          </div>
        ))}

        {/* Desks — zIndex ties them to their row so an agent walking BELOW
            the desk is drawn in front, and one ABOVE is drawn behind. */}
>>>>>>> 0c7a388 (Atualização feita em outro PC)
        {deskSlots.map((d) => (
          <div
            key={d.id}
            className="absolute"
            style={{
              left: d.col * cell,
              top: d.row * cell + cell * 0.2,
              width: cell * 2,
              height: cell,
<<<<<<< HEAD
=======
              zIndex: (d.row + 1) * 10,
>>>>>>> 0c7a388 (Atualização feita em outro PC)
            }}
          >
            <Desk cell={cell} />
          </div>
        ))}

        {/* Agents */}
        {agents.map((a) => {
          const pos = positions[a.id];
          if (!pos) return null;
<<<<<<< HEAD
          const size = cell * 0.95;
=======
          const size = cell * 0.9;
>>>>>>> 0c7a388 (Atualização feita em outro PC)
          return (
            <div
              key={a.id}
              className="absolute"
              style={{
                left: pos.x * cell - size / 2,
<<<<<<< HEAD
                top: pos.y * cell - size,
                width: size,
                height: size,
                transition: 'left 80ms linear, top 80ms linear',
                zIndex: Math.floor(pos.y * 10),
=======
                top: pos.y * cell - size * 1.2,
                width: size,
                height: size * 1.4,
                transition: 'left 80ms linear, top 80ms linear',
                zIndex: Math.floor(pos.y * 10),
                pointerEvents: 'auto',
>>>>>>> 0c7a388 (Atualização feita em outro PC)
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
<<<<<<< HEAD
=======

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

function Chair({ cell, col, row }: { cell: number; col: number; row: number }) {
  const w = cell * 0.55;
  const h = cell * 0.5;
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: col * cell - w / 2,
        top: row * cell,
        width: w,
        height: h,
      }}
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
  openingRow,
}: {
  cell: number;
  cols: number;
  rows: number;
  dividerCol: number;
  openingRow: number;
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

  // Divider (no door — just a 1-cell gap at openingRow)
  for (let r = 1; r < rows - 1; r++) {
    if (r === openingRow) continue;
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
>>>>>>> 0c7a388 (Atualização feita em outro PC)
