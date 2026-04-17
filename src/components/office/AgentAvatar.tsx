import { motion } from 'framer-motion';
<<<<<<< HEAD
import { useMemo } from 'react';
import type { Agent } from '../../types';

export type Facing = 'down' | 'up' | 'left' | 'right';
=======
import type { Agent, Gender } from '../../types';
import { CharacterSprite, type Facing } from './CharacterSprite';

export type { Facing };
>>>>>>> 0c7a388 (Atualização feita em outro PC)

interface Props {
  agent: Agent;
  size: number;
  facing?: Facing;
  active?: boolean;
  walking?: boolean;
  onClick?: () => void;
}

/**
<<<<<<< HEAD
 * Pixel character drawn pixel-by-pixel with CSS box-shadow.
 * Matches the reference: white cap, peach skin, blue shirt, dark pants.
 * Faces 4 directions; walking adds a tiny bob/leg shuffle.
=======
 * Pixel avatar (SVG-based). Renders CharacterSprite and wires click + a
 * subtle bob while walking. No hover scale, no glow halo.
>>>>>>> 0c7a388 (Atualização feita em outro PC)
 */
export function AgentAvatar({
  agent,
  size,
  facing = 'down',
<<<<<<< HEAD
  active,
  walking,
  onClick,
}: Props) {
  // Each sprite is 8 wide x 9 tall pixels.
  const W = 8;
  const H = 9;
  const px = Math.max(2, Math.floor(size / W));

  const palette = useMemo(
    () => ({
      cap: agent.color, // accent color identifies the agent
      capShade: shade(agent.color, -30),
      skin: '#f3c79b',
      skinShade: '#c98e63',
      shirt: '#3b6fb0',
      shirtShade: '#1f3f6b',
      pants: '#1a1f3a',
      shoes: '#0a0c1c',
      eye: '#0c0c1c',
      hair: '#3a2a18',
      outline: 'rgba(0,0,0,0.55)',
    }),
    [agent.color]
  );

  const sprite = useMemo(
    () => spriteFor(facing, palette),
    [facing, palette]
  );

  // Build CSS box-shadow string for pixel art (single 1px element, many shadows)
  const shadow = useMemo(() => {
    const parts: string[] = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const col = sprite[y][x];
        if (!col) continue;
        parts.push(`${x * px}px ${y * px}px 0 0 ${col}`);
      }
    }
    return parts.join(',');
  }, [sprite, px]);
=======
  walking,
  onClick,
}: Props) {
  const gender: Gender =
    agent.gender ?? (hashString(agent.id) % 2 === 0 ? 'male' : 'female');
>>>>>>> 0c7a388 (Atualização feita em outro PC)

  return (
    <motion.button
      type="button"
      onClick={onClick}
<<<<<<< HEAD
      whileHover={{ scale: 1.12 }}
      animate={{ y: walking ? [0, -1, 0, -1, 0] : 0 }}
      transition={{
        y: walking
          ? { repeat: Infinity, duration: 0.45, ease: 'linear' }
          : { duration: 0.2 },
      }}
      className={`relative outline-none cursor-pointer pixelated ${
        active ? 'drop-shadow-[0_0_6px_rgba(167,139,250,0.95)]' : ''
      }`}
      style={{ width: W * px, height: H * px }}
      title={`${agent.name} · ${agent.title}`}
    >
      <span
        className="absolute top-0 left-0"
        style={{
          width: px,
          height: px,
          boxShadow: shadow,
        }}
      />
      {active && (
        <span
          className="absolute -top-2 left-1/2 -translate-x-1/2 text-[8px] font-mono text-accent-violet"
          style={{ fontSize: Math.max(8, px * 1.2) }}
        >
          ▾
        </span>
      )}
=======
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
        gender={gender}
        facing={facing}
        walking={Boolean(walking)}
        size={size}
        accent={agent.color}
      />
>>>>>>> 0c7a388 (Atualização feita em outro PC)
    </motion.button>
  );
}

<<<<<<< HEAD
/* -------------------------------------------------------------------------- */
/* Sprites                                                                     */
/* -------------------------------------------------------------------------- */

type Pal = ReturnType<typeof shade> extends string
  ? Record<string, string>
  : never;

/** 8x9 sprite. Colors picked from `pal`. `0` = transparent. */
function spriteFor(facing: Facing, pal: Record<string, string>): (string | 0)[][] {
  // Shorthand letters
  const C = pal.cap;
  const S = pal.skin;
  const Sd = pal.skinShade;
  const T = pal.shirt;
  const Td = pal.shirtShade;
  const P = pal.pants;
  const Sh = pal.shoes;
  const E = pal.eye;
  const O = pal.outline;
  const _ = 0 as const;

  if (facing === 'up') {
    // back view (matches the screenshot)
    return [
      [_, _, O, C, C, O, _, _],
      [_, O, C, C, C, C, O, _],
      [_, O, C, C, C, C, O, _],
      [_, _, O, S, S, O, _, _],
      [_, O, T, T, T, T, O, _],
      [_, O, T, T, T, T, O, _],
      [_, O, T, T, T, T, O, _],
      [_, _, P, P, P, P, _, _],
      [_, _, Sh, _, _, Sh, _, _],
    ];
  }

  if (facing === 'left') {
    return [
      [_, _, O, C, C, O, _, _],
      [_, O, C, C, C, C, O, _],
      [_, O, C, C, C, C, S, O],
      [_, _, O, E, S, S, S, O],
      [_, O, T, T, T, T, O, _],
      [_, O, T, T, T, T, O, _],
      [_, O, T, T, T, T, O, _],
      [_, _, P, P, P, P, _, _],
      [_, _, Sh, _, _, Sh, _, _],
    ];
  }

  if (facing === 'right') {
    return [
      [_, _, O, C, C, O, _, _],
      [_, O, C, C, C, C, O, _],
      [O, S, C, C, C, C, O, _],
      [O, S, S, S, E, O, _, _],
      [_, O, T, T, T, T, O, _],
      [_, O, T, T, T, T, O, _],
      [_, O, T, T, T, T, O, _],
      [_, _, P, P, P, P, _, _],
      [_, _, Sh, _, _, Sh, _, _],
    ];
  }

  // 'down' (front)
  return [
    [_, _, O, C, C, O, _, _],
    [_, O, C, C, C, C, O, _],
    [_, O, S, S, S, S, O, _],
    [_, O, S, E, E, S, O, _],
    [_, _, O, Sd, Sd, O, _, _],
    [_, O, T, T, T, T, O, _],
    [_, O, T, Td, Td, T, O, _],
    [_, _, P, P, P, P, _, _],
    [_, _, Sh, _, _, Sh, _, _],
  ];
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function shade(hex: string, amt: number): string {
  // Lighten/darken a hex color by `amt` percent (-100..100)
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const num = parseInt(c, 16);
  let r = (num >> 16) + Math.round((amt * 255) / 100);
  let g = ((num >> 8) & 0xff) + Math.round((amt * 255) / 100);
  let b = (num & 0xff) + Math.round((amt * 255) / 100);
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
=======
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
>>>>>>> 0c7a388 (Atualização feita em outro PC)
}
