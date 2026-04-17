interface DeskProps {
  /** Cell width in px */
  cell: number;
  /** Show monitor (default true) */
  monitor?: boolean;
}

/**
 * 2-cell wide wooden desk with a small dark monitor and seat below it.
 * Mirrors the reference screenshot: brown desk top + tiny blue monitor.
 */
export function Desk({ cell, monitor = true }: DeskProps) {
  const w = cell * 2;
  const deskH = cell * 0.6;

  return (
    <div className="relative" style={{ width: w, height: cell }}>
      {/* Desktop wooden surface */}
      <div
        className="absolute left-0 top-0"
        style={{
          width: w,
          height: deskH,
          background:
            'linear-gradient(180deg, #b07a45 0%, #8b5a2b 35%, #6e4520 100%)',
          border: '1px solid rgba(0,0,0,0.55)',
          boxShadow:
            'inset 0 -2px 0 rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.18)',
          imageRendering: 'pixelated',
        }}
      >
        {/* Wood plank stripes */}
        <div
          className="absolute left-0 right-0"
          style={{
            top: deskH * 0.45,
            height: 1,
            background: 'rgba(0,0,0,0.35)',
          }}
        />
        {/* Monitor */}
        {monitor && (
          <div
            className="absolute"
            style={{
              right: cell * 0.25,
              top: -cell * 0.18,
              width: cell * 0.55,
              height: cell * 0.4,
              background: '#0a0c1c',
              border: '1px solid #1a1f3a',
              boxShadow:
                'inset 1px 1px 0 rgba(70,120,200,0.55), inset -1px -1px 0 rgba(0,0,0,0.6)',
            }}
          >
            {/* Screen highlight */}
            <span
              className="absolute"
              style={{
                left: 1,
                top: 1,
                width: '40%',
                height: '40%',
                background: 'rgba(99, 180, 255, 0.45)',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
