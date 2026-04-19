interface DeskProps {
  cell: number;
  monitor?: boolean;
  working?: boolean;
}

export function Desk({ cell, monitor = true, working = false }: DeskProps) {
  const w     = cell * 2;
  const deskH = cell * 0.62;
  const monCx = cell * 0.54;
  const monW  = cell * 0.72;
  const monH  = cell * 0.5;

  // Colour scheme switches between idle (blue) and working (green terminal).
  const screenBg     = working ? '#010f03' : '#050c1e';
  const screenBorder = working ? '#0d4020' : '#1a2545';
  const screenGlow   = working
    ? '0 0 6px rgba(0,200,80,0.55), inset 1px 1px 0 rgba(0,220,90,0.25)'
    : '0 0 6px rgba(60,120,255,0.45), inset 1px 1px 0 rgba(80,140,255,0.3)';
  const gradBg       = working
    ? 'linear-gradient(160deg, #021a08 0%, #010d04 60%, #000800 100%)'
    : 'linear-gradient(160deg, #0d2155 0%, #071430 60%, #030a1a 100%)';
  const taskbarColor = working ? 'rgba(0,200,80,0.6)' : 'rgba(60,140,255,0.5)';
  const lineHi       = working ? 'rgba(0,220,90,0.8)' : 'rgba(100,170,255,0.3)';
  const lineLo       = working ? 'rgba(0,180,60,0.5)' : 'rgba(100,170,255,0.2)';

  return (
    <div className="relative" style={{ width: w, height: cell }}>
      {/* Wooden desktop surface */}
      <div
        className="absolute left-0 top-0"
        style={{
          width: w, height: deskH,
          background: 'linear-gradient(180deg, #b07a45 0%, #8b5a2b 35%, #6e4520 100%)',
          border: '1px solid rgba(0,0,0,0.55)',
          boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.18)',
          imageRendering: 'pixelated',
        }}
      >
        {/* Wood grain */}
        <div
          className="absolute left-0 right-0"
          style={{ top: deskH * 0.48, height: 1, background: 'rgba(0,0,0,0.3)' }}
        />

        {monitor && (
          <>
            {/* Monitor screen */}
            <div
              className="absolute"
              style={{
                left: monCx - monW / 2, top: -monH,
                width: monW, height: monH,
                background: screenBg,
                border: `1.5px solid ${screenBorder}`,
                borderRadius: 2,
                boxShadow: screenGlow,
                transition: 'background 0.4s, box-shadow 0.4s',
              }}
            >
              <div style={{ position: 'absolute', inset: 2, background: gradBg, borderRadius: 1 }} />
              {/* Taskbar */}
              <div style={{ position: 'absolute', bottom: 2, left: 2, right: 2, height: 2, background: taskbarColor, borderRadius: 1 }} />
              {/* Content lines */}
              {working ? (
                // Terminal-style code lines
                <>
                  <div style={{ position: 'absolute', top: 3, left: 3, right: 3, height: 1, background: lineHi }} />
                  <div style={{ position: 'absolute', top: 6, left: 3, width: '70%', height: 1, background: lineLo }} />
                  <div style={{ position: 'absolute', top: 9, left: 3, width: '45%', height: 1, background: lineHi }} />
                  <div style={{ position: 'absolute', top: 12, left: 6, width: '55%', height: 1, background: lineLo }} />
                </>
              ) : (
                // Idle UI lines
                <>
                  <div style={{ position: 'absolute', top: 4, left: 3, right: 3, height: 1, background: lineHi }} />
                  <div style={{ position: 'absolute', top: 7, left: 3, width: '55%', height: 1, background: lineLo }} />
                </>
              )}
            </div>

            {/* Monitor stand neck */}
            <div className="absolute" style={{ left: monCx - cell * 0.06, top: -cell * 0.06, width: cell * 0.12, height: cell * 0.09, background: '#1a2030', borderRadius: '0 0 1px 1px' }} />
            {/* Stand base */}
            <div className="absolute" style={{ left: monCx - cell * 0.14, top: 0, width: cell * 0.28, height: cell * 0.055, background: '#1a2030', borderRadius: 1 }} />

            {/* Keyboard */}
            <div className="absolute" style={{ left: monCx - cell * 0.28, top: deskH * 0.18, width: cell * 0.55, height: cell * 0.14, background: '#1c2035', border: '1px solid #2a3055', borderRadius: 1, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)' }} />

            {/* PC tower */}
            <div className="absolute" style={{ right: cell * 0.12, top: -cell * 0.25, width: cell * 0.28, height: cell * 0.42, background: 'linear-gradient(180deg, #1a1e2e 0%, #111422 100%)', border: '1px solid #262b3e', borderRadius: 2, boxShadow: 'inset 1px 0 0 rgba(255,255,255,0.07)' }}>
              {/* Power LED — green when working, dim when idle */}
              <div style={{ position: 'absolute', top: 4, left: 3, width: 3, height: 3, borderRadius: '50%', background: working ? '#00ff88' : '#00e5a0', boxShadow: working ? '0 0 6px #00ff88' : '0 0 4px #00e5a0' }} />
              <div style={{ position: 'absolute', bottom: 6, left: 3, right: 3, height: 2, background: 'rgba(0,0,0,0.6)', borderRadius: 1 }} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
