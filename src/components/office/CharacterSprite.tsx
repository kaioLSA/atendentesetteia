import { useEffect, useMemo, useState } from 'react';
import type { Gender } from '../../types';

export type Facing = 'down' | 'up' | 'left' | 'right';

interface Props {
  gender: Gender;
  facing: Facing;
  walking: boolean;
  size: number;
  accent?: string;
}

/**
 * Pixel character rendered as an SVG — scalable and crisp at any zoom.
 * Inspired by public/boneco.jpg: bowl-cut hair, pale skin, dark vest over
 * maroon shirt, dark pants, small shoes. Male and female variants.
 */
export function CharacterSprite({
  gender,
  facing,
  walking,
  size,
  accent,
}: Props) {
  const W = 14;
  const H = 19;

  // 4-frame walk cycle: 0 stand, 1 left step, 2 stand, 3 right step
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!walking) {
      setFrame(0);
      return;
    }
    const id = window.setInterval(() => {
      setFrame((f) => (f + 1) % 4);
    }, 130);
    return () => window.clearInterval(id);
  }, [walking]);

  const palette = useMemo(() => buildPalette(gender, accent), [gender, accent]);

  const grid = useMemo(
    () => spriteFor(facing, palette, gender, frame),
    [facing, palette, gender, frame]
  );

  // Slight up/down bob while walking
  const bob = walking ? (frame % 2 === 0 ? 0 : -0.5) : 0;

  return (
    <svg
      viewBox={`0 0 ${W} ${H + 1}`}
      width={size}
      height={(size / W) * (H + 1)}
      shapeRendering="crispEdges"
      style={{ imageRendering: 'pixelated', display: 'block' }}
    >
      {/* Soft ground shadow */}
      <ellipse
        cx={W / 2}
        cy={H}
        rx={3.2}
        ry={0.55}
        fill="rgba(0,0,0,0.35)"
      />
      <g transform={`translate(0 ${bob})`}>
        {grid.map((row, y) =>
          row.map((color, x) =>
            color ? (
              <rect
                key={`${x}-${y}`}
                x={x}
                y={y}
                width={1}
                height={1}
                fill={color}
              />
            ) : null
          )
        )}
      </g>
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Palette                                                                     */
/* -------------------------------------------------------------------------- */

function buildPalette(gender: Gender, accent?: string) {
  return {
    hair: gender === 'female' ? '#5a3a28' : '#3a2418',
    hairHi: gender === 'female' ? '#7a5438' : '#5c3a24',
    skin: '#efd3b5',
    skinShade: '#b7876a',
    vest: '#181820',
    vestHi: '#2a2a35',
    shirt: '#6e2a2a',
    shirtHi: accent && isHexColor(accent) ? accent : '#9a3a3a',
    pants: '#1e2028',
    pantsHi: '#2a2c34',
    shoes: '#0a0a0a',
    eye: '#0c0c0c',
  };
}

function isHexColor(s: string) {
  return /^#[0-9a-fA-F]{3,6}$/.test(s);
}

/* -------------------------------------------------------------------------- */
/* Sprite grid (14 × 19)                                                       */
/* -------------------------------------------------------------------------- */

function spriteFor(
  facing: Facing,
  pal: Record<string, string>,
  gender: Gender,
  frame: number
): (string | 0)[][] {
  const H = pal.hair;
  const Hh = pal.hairHi;
  const S = pal.skin;
  const Sd = pal.skinShade;
  const V = pal.vest;
  const Vh = pal.vestHi;
  const Sh = pal.shirt;
  const Sh2 = pal.shirtHi;
  const P = pal.pants;
  const Ph = pal.pantsHi;
  const Bt = pal.shoes;
  const E = pal.eye;
  const _ = 0 as const;

  const stepLeft = frame === 1;
  const stepRight = frame === 3;

  // Leg + shoe rows for the 4-frame walk cycle
  const legsRow1: (string | 0)[] = stepLeft
    ? [_, _, _, _, P, Ph, P, _, P, P, _, _, _, _]
    : stepRight
    ? [_, _, _, _, P, P, _, P, Ph, P, _, _, _, _]
    : [_, _, _, _, P, Ph, P, P, Ph, P, _, _, _, _];

  const legsRow2: (string | 0)[] = stepLeft
    ? [_, _, _, P, P, P, _, _, _, P, P, _, _, _]
    : stepRight
    ? [_, _, _, P, P, _, _, _, P, P, P, _, _, _]
    : [_, _, _, _, P, P, _, _, P, P, _, _, _, _];

  const shoesRow: (string | 0)[] = stepLeft
    ? [_, _, _, Bt, Bt, _, _, _, _, _, Bt, Bt, _, _]
    : stepRight
    ? [_, _, _, Bt, Bt, _, _, _, _, _, Bt, Bt, _, _]
    : [_, _, _, _, Bt, Bt, _, _, Bt, Bt, _, _, _, _];

  if (facing === 'up') {
    // Back view
    const sideHair = gender === 'female';
    return [
      [_, _, _, _, _, H, H, H, H, _, _, _, _, _],
      [_, _, _, _, H, Hh, Hh, Hh, Hh, H, _, _, _, _],
      [_, _, _, H, H, Hh, H, H, Hh, H, H, _, _, _],
      [_, _, H, H, Hh, H, H, H, H, Hh, H, H, _, _],
      [_, H, H, Hh, H, H, H, H, H, H, Hh, H, H, _],
      [_, H, Hh, H, H, H, H, H, H, H, H, Hh, H, _],
      [_, _, H, H, H, H, H, H, H, H, H, H, _, _],
      [_, _, sideHair ? H : S, S, S, S, S, S, S, S, sideHair ? H : S, _, _, _],
      [_, _, _, S, S, S, S, S, S, S, _, _, _, _],
      [_, _, V, V, V, V, V, V, V, V, V, _, _, _],
      [_, S, V, Vh, V, Sh, Sh, V, Vh, V, V, S, _, _],
      [_, S, V, V, Sh, Sh, Sh, Sh, V, V, V, S, _, _],
      [_, _, V, V, Sh, Sh2, Sh2, Sh, V, V, _, _, _, _],
      [_, _, V, V, V, V, V, V, V, V, _, _, _, _],
      [_, _, _, V, V, V, V, V, V, _, _, _, _, _],
      legsRow1,
      legsRow2,
      shoesRow,
      [_, _, _, _, _, _, _, _, _, _, _, _, _, _],
    ];
  }

  if (facing === 'left') {
    return [
      [_, _, _, _, _, H, H, H, H, _, _, _, _, _],
      [_, _, _, _, H, Hh, Hh, Hh, Hh, H, _, _, _, _],
      [_, _, _, H, H, Hh, H, Hh, H, H, H, _, _, _],
      [_, _, H, H, Hh, H, H, H, Hh, S, H, _, _, _],
      [_, _, H, Hh, H, E, H, S, S, S, S, _, _, _],
      [_, _, H, H, H, S, S, S, S, S, _, _, _, _],
      [_, _, _, S, S, Sd, S, S, S, _, _, _, _, _],
      [_, _, _, _, S, S, S, S, _, _, _, _, _, _],
      [_, _, V, V, V, V, V, V, _, _, _, _, _, _],
      [_, _, V, Vh, Sh, Sh, V, V, _, _, _, _, _, _],
      [_, S, V, Sh, Sh2, Sh2, Sh, V, _, _, _, _, _, _],
      [_, S, V, Sh, Sh, Sh, Sh, V, _, _, _, _, _, _],
      [_, _, V, V, V, V, V, V, _, _, _, _, _, _],
      [_, _, _, V, V, V, V, _, _, _, _, _, _, _],
      [_, _, _, P, Ph, P, P, _, _, _, _, _, _, _],
      [_, _, _, P, P, Ph, P, _, _, _, _, _, _, _],
      [_, _, _, P, P, _, P, P, _, _, _, _, _, _],
      [_, _, _, Bt, Bt, _, Bt, Bt, _, _, _, _, _, _],
      [_, _, _, _, _, _, _, _, _, _, _, _, _, _],
    ];
  }

  if (facing === 'right') {
    return [
      [_, _, _, _, _, H, H, H, H, _, _, _, _, _],
      [_, _, _, _, H, Hh, Hh, Hh, Hh, H, _, _, _, _],
      [_, _, _, H, H, H, Hh, H, Hh, H, H, _, _, _],
      [_, _, _, H, S, Hh, H, H, H, Hh, H, H, _, _],
      [_, _, _, S, S, S, S, H, E, H, Hh, H, _, _],
      [_, _, _, _, S, S, S, S, S, H, H, H, _, _],
      [_, _, _, _, _, S, S, S, Sd, S, S, _, _, _],
      [_, _, _, _, _, _, S, S, S, S, _, _, _, _],
      [_, _, _, _, _, _, V, V, V, V, V, V, _, _],
      [_, _, _, _, _, _, V, V, Sh, Sh, Vh, V, _, _],
      [_, _, _, _, _, _, V, Sh, Sh2, Sh2, Sh, V, S, _],
      [_, _, _, _, _, _, V, Sh, Sh, Sh, Sh, V, S, _],
      [_, _, _, _, _, _, V, V, V, V, V, V, _, _],
      [_, _, _, _, _, _, _, V, V, V, V, _, _, _],
      [_, _, _, _, _, _, _, P, P, Ph, P, _, _, _],
      [_, _, _, _, _, _, _, P, Ph, P, P, _, _, _],
      [_, _, _, _, _, _, P, P, _, P, P, _, _, _],
      [_, _, _, _, _, _, Bt, Bt, _, Bt, Bt, _, _, _],
      [_, _, _, _, _, _, _, _, _, _, _, _, _, _],
    ];
  }

  // FRONT view — matches the boneco.jpg reference
  const femaleHair = gender === 'female';
  return [
    [_, _, _, _, _, H, H, H, H, _, _, _, _, _],
    [_, _, _, _, H, Hh, Hh, Hh, Hh, H, _, _, _, _],
    [_, _, _, H, H, Hh, H, H, Hh, H, H, _, _, _],
    [_, _, H, H, Hh, H, H, H, H, Hh, H, H, _, _],
    [_, H, H, Hh, S, S, S, S, S, S, Hh, H, H, _],
    [_, H, Hh, S, S, S, S, S, S, S, S, Hh, H, _],
    [_, _, H, S, E, S, S, S, S, E, S, H, _, _],
    [_, _, _, S, S, S, S, S, S, S, S, _, _, _],
    [_, _, femaleHair ? H : _, S, S, Sd, S, S, Sd, S, S, femaleHair ? H : _, _, _],
    [_, _, _, _, S, S, S, S, S, S, _, _, _, _],
    [_, _, _, V, V, V, V, V, V, V, _, _, _, _],
    [_, _, V, V, Vh, Sh, Sh, Sh, Sh, Vh, V, V, _, _],
    [_, S, V, Vh, Sh, Sh, Sh, Sh, Sh, Sh, V, Vh, S, _],
    [_, S, V, V, Sh, Sh2, Sh2, Sh2, Sh2, Sh, V, V, S, _],
    [_, _, V, V, Sh, Sh, Sh, Sh, Sh, Sh, V, V, _, _],
    [_, _, _, V, V, V, V, V, V, V, V, _, _, _],
    legsRow1,
    legsRow2,
    shoesRow,
  ];
}
