import { useEffect, useMemo, useRef, useState } from 'react';
import type { Gender, SkinTone } from '../../types';

export type Facing = 'down' | 'up' | 'left' | 'right';

interface Props {
  agentId?: string;
  gender: Gender;
  facing: Facing;
  walking: boolean;
  sitting?: boolean;
  size: number;
  accent?: string;
  skinTone?: SkinTone;
}

/**
 * Pixel character renderer.
 *
 * The CEO is rendered from `public/boneco.jpg` by sampling its native pixel
 * grid (8-px per native pixel, 17×21 grid) and emitting one <rect> per cell
 * inside an SVG — i.e. the source image, vectorized. No interpretation, no
 * hand-drawn redesign.
 *
 * The white background is dropped (cells with near-white sampled color are
 * omitted), the ground shadow row is replaced by a dedicated <ellipse> so
 * the character is centered without extra padding, and a "back" grid is
 * derived from the front by repainting face-skin cells with the sampled hair
 * color so the silhouette, vest and legs are identical from behind.
 */
export function CharacterSprite({
  agentId,
  gender,
  facing,
  walking,
  sitting,
  size,
  accent,
  skinTone,
}: Props) {
  if (agentId === 'ceo') {
    return <CeoPixelSprite facing={facing} walking={walking} sitting={sitting} size={size} />;
  }
  return (
    <GenericSvgSprite
      gender={gender}
      facing={facing}
      walking={walking}
      sitting={sitting}
      size={size}
      accent={accent}
      skinTone={skinTone}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* CEO — vectorized from boneco.jpg at runtime                                 */
/* -------------------------------------------------------------------------- */

interface BonecoGrid {
  front: (string | null)[][]; // 2D of css colors (null = transparent)
  back: (string | null)[][];
  rows: number;
  cols: number;
  /** The row where the ground shadow starts (collapsed into an <ellipse>). */
  shadowRow: number;
  /** bounding box of the character (no white padding, no shadow). */
  bbox: { top: number; left: number; bottom: number; right: number };
}

// Cached once per tab — the image is only sampled once.
let bonecoCache: BonecoGrid | null = null;
let bonecoInflight: Promise<BonecoGrid | null> | null = null;

function loadBoneco(): Promise<BonecoGrid | null> {
  if (bonecoCache) return Promise.resolve(bonecoCache);
  if (bonecoInflight) return bonecoInflight;

  bonecoInflight = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = '/boneco.jpg';
    img.onload = () => {
      try {
        const grid = sampleBoneco(img);
        bonecoCache = grid;
        resolve(grid);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
  });

  return bonecoInflight;
}

function sampleBoneco(img: HTMLImageElement): BonecoGrid {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height).data;
  const W = c.width;
  const H = c.height;

  // 1) Find the non-white bounding box.
  let minX = W,
    minY = H,
    maxX = -1,
    maxY = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      if (!(r > 230 && g > 230 && b > 230)) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  // 2) Detect the native pixel size (median horizontal run through the middle).
  const midY = Math.floor((minY + maxY) / 2);
  const runs: number[] = [];
  let prevKey = -1;
  let runLen = 0;
  for (let x = minX; x <= maxX; x++) {
    const i = (midY * W + x) * 4;
    // Quantize by dropping lowest 5 bits for robustness against JPG noise.
    const key = ((data[i] >> 5) << 10) | ((data[i + 1] >> 5) << 5) | (data[i + 2] >> 5);
    if (key === prevKey) {
      runLen++;
    } else {
      if (runLen >= 3) runs.push(runLen);
      prevKey = key;
      runLen = 1;
    }
  }
  if (runLen >= 3) runs.push(runLen);
  runs.sort((a, b) => a - b);
  const PS = Math.max(4, runs[Math.floor(runs.length / 2)] || 8);

  const cols = Math.max(1, Math.round((maxX - minX + 1) / PS));
  const rows = Math.max(1, Math.round((maxY - minY + 1) / PS));

  // 3) For each cell, compute the DOMINANT non-white color inside an 8×8 block.
  //    Dominant = nearest to the mean of non-white pixels in the block.
  const front: (string | null)[][] = [];
  let shadowRow = rows;

  // First pass: compute the hair palette (we'll need the mean hair color for the back view).
  let hairR = 0,
    hairG = 0,
    hairB = 0,
    hairN = 0;

  for (let gy = 0; gy < rows; gy++) {
    const rowOut: (string | null)[] = [];
    let grayCount = 0;
    for (let gx = 0; gx < cols; gx++) {
      const x0 = minX + gx * PS;
      const y0 = minY + gy * PS;
      let r = 0,
        g = 0,
        b = 0,
        n = 0;
      // Inner 4×4 sample to avoid edge bleed at cell boundaries.
      const m = Math.max(1, Math.floor(PS / 4));
      for (let dy = m; dy < PS - m; dy++) {
        for (let dx = m; dx < PS - m; dx++) {
          const xi = x0 + dx;
          const yi = y0 + dy;
          if (xi < 0 || yi < 0 || xi >= W || yi >= H) continue;
          const i = (yi * W + xi) * 4;
          const rr = data[i],
            gg = data[i + 1],
            bb = data[i + 2];
          if (rr > 232 && gg > 232 && bb > 232) continue;
          r += rr;
          g += gg;
          b += bb;
          n++;
        }
      }
      if (n === 0) {
        rowOut.push(null);
        continue;
      }
      r = Math.round(r / n);
      g = Math.round(g / n);
      b = Math.round(b / n);

      // Treat gray rows near the bottom as shadow — skip from front, replaced by ellipse.
      const isGray =
        Math.abs(r - g) < 15 &&
        Math.abs(g - b) < 15 &&
        r > 140 &&
        r < 230;
      if (isGray) {
        grayCount++;
        rowOut.push(null);
      } else {
        rowOut.push(`rgb(${r},${g},${b})`);
        // Sample candidate hair pixels: dark warm browns.
        if (r < 110 && g < 90 && b < 85 && r >= g && g >= b - 3) {
          hairR += r;
          hairG += g;
          hairB += b;
          hairN++;
        }
      }
    }
    if (grayCount > cols / 2 && gy > rows / 2 && shadowRow === rows) {
      shadowRow = gy;
    }
    front.push(rowOut);
  }

  // Determine the mean hair color (falls back to a sensible default).
  const hairMean: [number, number, number] =
    hairN > 10
      ? [Math.round(hairR / hairN), Math.round(hairG / hairN), Math.round(hairB / hairN)]
      : [75, 58, 55];
  const hairHex = `rgb(${hairMean[0]},${hairMean[1]},${hairMean[2]})`;
  const hairShadeHex = `rgb(${Math.max(0, hairMean[0] - 20)},${Math.max(
    0,
    hairMean[1] - 16
  )},${Math.max(0, hairMean[2] - 14)})`;

  // 4) Build the BACK grid. Goal: the head region should read as the BACK OF
  //    A HEAD, not a dark-skinned face. The trick is to treat the whole head
  //    area as a single hair-colored silhouette (not just "replace skin
  //    pixels"), then paint a subtle center-parting highlight + darker rim
  //    so the volume reads at a glance.
  const back: (string | null)[][] = front.map((row) => row.slice());

  const parseRgb = (hex: string | null): [number, number, number] | null => {
    if (!hex) return null;
    const m = /rgb\((\d+),(\d+),(\d+)\)/.exec(hex);
    if (!m) return null;
    return [+m[1], +m[2], +m[3]];
  };

  const isSkin = (hex: string | null) => {
    const p = parseRgb(hex);
    if (!p) return false;
    const [r, g, b] = p;
    return r > 150 && g > 90 && b > 70 && r > g && g > b && r - b > 35;
  };
  const isVest = (hex: string | null) => {
    const p = parseRgb(hex);
    if (!p) return false;
    const [r, g, b] = p;
    return r < 65 && g < 65 && b < 65;
  };

  // Locate the face band (rows with any skin-colored cell).
  let faceTop = -1;
  let faceBottom = -1;
  for (let y = 0; y < rows; y++) {
    if (front[y].some((c) => isSkin(c))) {
      if (faceTop === -1) faceTop = y;
      faceBottom = y;
    }
  }

  // Shirt top = first row at or after faceBottom that has several dark cells
  // spanning horizontally (shoulders). Falls back to faceBottom + 1.
  let shirtTop = rows;
  const searchStart = faceBottom >= 0 ? faceBottom + 1 : 0;
  for (let y = searchStart; y < rows; y++) {
    let dark = 0;
    for (let x = 0; x < cols; x++) if (isVest(front[y][x])) dark++;
    if (dark >= 4) {
      shirtTop = y;
      break;
    }
  }
  if (shirtTop === rows && faceBottom >= 0) shirtTop = faceBottom + 1;

  // Paint a dedicated "back of head" palette.
  const backHair: [number, number, number] = [
    Math.max(0, Math.round(hairMean[0] * 0.85)),
    Math.max(0, Math.round(hairMean[1] * 0.85)),
    Math.max(0, Math.round(hairMean[2] * 0.85)),
  ];
  const backHairHex = `rgb(${backHair[0]},${backHair[1]},${backHair[2]})`;
  const backHairHi = `rgb(${Math.min(255, backHair[0] + 26)},${Math.min(
    255,
    backHair[1] + 20
  )},${Math.min(255, backHair[2] + 16)})`;
  const backHairRim = `rgb(${Math.max(0, backHair[0] - 18)},${Math.max(
    0,
    backHair[1] - 14
  )},${Math.max(0, backHair[2] - 12)})`;

  // (a) Fill EVERY opaque cell in the head region (rows < shirtTop) with the
  //     solid back-hair color. That wipes the face, eyes, mixed-edge tan
  //     pixels, and the original hair highlights so the whole head becomes
  //     one clean silhouette.
  for (let y = 0; y < shirtTop; y++) {
    for (let x = 0; x < cols; x++) {
      if (back[y][x]) back[y][x] = backHairHex;
    }
  }

  // (b) Head bounding box so we can place structure.
  let hL = cols;
  let hR = -1;
  let hT = shirtTop;
  let hB = -1;
  for (let y = 0; y < shirtTop; y++) {
    for (let x = 0; x < cols; x++) {
      if (back[y][x]) {
        if (x < hL) hL = x;
        if (x > hR) hR = x;
        if (y < hT) hT = y;
        if (y > hB) hB = y;
      }
    }
  }

  if (hR > hL && hB > hT) {
    const cx = Math.floor((hL + hR) / 2);

    // (c) Center parting: a 1-column highlight running down the middle of
    //     the head, skipping the very top (top of skull stays darker).
    for (let y = hT + 2; y <= hB - 1; y++) {
      if (back[y][cx] === backHairHex) back[y][cx] = backHairHi;
    }

    // (d) Rim shading on the left edge of the head — for every other row,
    //     paint the leftmost hair pixel with a darker tone so the head has
    //     a clear outline/volume instead of a flat disc.
    for (let y = hT + 1; y <= hB; y++) {
      for (let x = hL; x < cx; x++) {
        if (back[y][x] === backHairHex) {
          if (y % 2 === 0) back[y][x] = backHairRim;
          break;
        }
      }
      // Same on the right edge.
      for (let x = hR; x > cx; x--) {
        if (back[y][x] === backHairHex) {
          if (y % 2 === 1) back[y][x] = backHairRim;
          break;
        }
      }
    }

    // (e) Neck shadow: the row right before the shoulder, drop its brightness
    //     a touch so the head reads as separate from the torso.
    if (shirtTop > 0) {
      const neckY = shirtTop - 1;
      for (let x = hL; x <= hR; x++) {
        if (back[neckY][x] === backHairHex) back[neckY][x] = backHairRim;
      }
    }
  }

  const bbox = { top: 0, left: 0, bottom: shadowRow - 1, right: cols - 1 };

  return { front, back, rows, cols, shadowRow, bbox };
}

function useBoneco(): BonecoGrid | null {
  const [grid, setGrid] = useState<BonecoGrid | null>(bonecoCache);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    loadBoneco().then((g) => {
      if (alive.current) setGrid(g);
    });
    return () => {
      alive.current = false;
    };
  }, []);
  return grid;
}

function CeoPixelSprite({
  facing,
  walking,
  sitting,
  size,
}: {
  facing: Facing;
  walking: boolean;
  sitting?: boolean;
  size: number;
}) {
  const boneco = useBoneco();

  // Walk cycle frame
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!walking) {
      setFrame(0);
      return;
    }
    const id = window.setInterval(() => setFrame((f) => (f + 1) % 4), 110);
    return () => window.clearInterval(id);
  }, [walking]);

  // Typing arm animation when seated
  const [typingFrame, setTypingFrame] = useState(0);
  useEffect(() => {
    if (!sitting) { setTypingFrame(0); return; }
    const id = window.setInterval(() => setTypingFrame((f) => (f + 1) % 4), 190);
    return () => window.clearInterval(id);
  }, [sitting]);

  // IMPORTANT: all hooks must run before any early return (Rules of Hooks).
  // When sitting: always use back view, freeze all animation.
  const effectiveFacing = sitting ? 'up' : facing;
  const effectiveWalking = sitting ? false : walking;

  const baseGrid = boneco
    ? effectiveFacing === 'up'
      ? boneco.back
      : boneco.front
    : null;

  // Apply walking leg animation — only the two boot/foot rows directly
  // above the shadow shift. Row shadow-2 and shadow-1 move in opposite
  // directions to simulate each foot stepping forward and back.
  const grid = useMemo(() => {
    if (!baseGrid || !boneco) return null;
    if (!effectiveWalking) return baseGrid;

    const sRow = boneco.shadowRow;
    // Only the actual foot/boot rows (bottom 2 rows of the character).
    const footRow1 = sRow - 2; // e.g. calves / lower leg
    const footRow2 = sRow - 1; // boots / feet

    // Frame cycle: 0 = neutral, 1 = step-A, 2 = neutral, 3 = step-B
    // The two foot rows shift in OPPOSITE directions so one foot goes
    // forward while the other goes back — no arms touched at all.
    const shift1 = frame === 1 ? 2 : frame === 3 ? -2 : 0;
    const shift2 = frame === 1 ? -2 : frame === 3 ? 2 : 0;

    if (shift1 === 0 && shift2 === 0) return baseGrid;

    const shifted = baseGrid.map((r) => r.slice());

    const shiftRow = (y: number, amt: number) => {
      if (y < 0) return;
      const src = baseGrid[y];
      const out: (string | null)[] = new Array(src.length).fill(null);
      for (let x = 0; x < src.length; x++) {
        const nx = x + amt;
        if (nx >= 0 && nx < src.length) out[nx] = src[x];
      }
      shifted[y] = out;
    };

    shiftRow(footRow1, shift1);
    shiftRow(footRow2, shift2);

    return shifted;
  }, [baseGrid, walking, frame, boneco?.shadowRow]);

  // Arm columns for typing animation: scan torso rows to find outermost
  // filled pixels (arm edges). Must run before any early return (rules of hooks).
  const armInfo = useMemo(() => {
    if (!boneco) return { leftCol: -1, rightCol: -1, armRowSet: new Set<number>() };
    const cols = boneco.cols;
    const clipH = Math.max(1, boneco.shadowRow - 3);
    const torsoStart = Math.floor(clipH * 0.55);
    const armRowSet = new Set<number>();
    let leftCol = cols, rightCol = -1;
    for (let y = torsoStart; y < clipH; y++) {
      const row = boneco.back[y];
      if (!row) continue;
      let lx = cols, rx = -1;
      for (let x = 0; x < cols; x++) {
        if (row[x]) { if (x < lx) lx = x; if (x > rx) rx = x; }
      }
      // "Arm row" = pixels span wide (shoulder/arm level, not just head)
      if (lx < cols && rx >= 0 && (rx - lx) > cols * 0.55) {
        armRowSet.add(y);
        leftCol  = Math.min(leftCol, lx);
        rightCol = Math.max(rightCol, rx);
      }
    }
    return { leftCol, rightCol, armRowSet };
  }, [boneco]);

  if (!boneco || !grid) {
    // Minimal placeholder until sampling is done — nothing visible but takes space.
    return (
      <div style={{ width: size, height: size * 1.25 }} aria-hidden="true" />
    );
  }

  const mirror = effectiveFacing === 'left';
  const bob = effectiveWalking ? (frame % 2 === 0 ? 0 : -0.65) : 0;

  // When sitting, clip the bottom ~25% of the sprite (leg rows) so the
  // character looks seated behind the desk — only head + torso visible.
  const clipRows = sitting ? Math.max(1, boneco.shadowRow - 3) : boneco.shadowRow + 1;
  const viewW = boneco.cols;

  const leftArmUp  = sitting && typingFrame === 1;
  const rightArmUp = sitting && typingFrame === 3;
  const ARM_DY = -0.7;

  return (
    <svg
      viewBox={`0 0 ${viewW} ${clipRows}`}
      width={size}
      height={(size / viewW) * clipRows}
      shapeRendering="crispEdges"
      style={{
        imageRendering: 'pixelated',
        display: 'block',
        overflow: 'visible',
        transform: mirror ? 'scaleX(-1)' : undefined,
      }}
    >
      {/* Ground shadow — only when standing */}
      {!sitting && (
        <ellipse
          cx={viewW / 2}
          cy={boneco.shadowRow + 0.3}
          rx={Math.max(3, viewW * 0.28)}
          ry={0.55}
          fill="rgba(0,0,0,0.35)"
        />
      )}
      <g transform={`translate(0 ${bob})`}>
        {grid.map((row, y) => {
          if (y >= clipRows) return null;
          return row.map((color, x) => {
            if (!color) return null;
            // Typing arm animation: lift outermost arm pixels alternately
            const isArmRow  = armInfo.armRowSet.has(y);
            const isLeftArm  = isArmRow && x === armInfo.leftCol;
            const isRightArm = isArmRow && x === armInfo.rightCol;
            const dy = (isLeftArm && leftArmUp) ? ARM_DY
                     : (isRightArm && rightArmUp) ? ARM_DY
                     : 0;
            return (
              <rect
                key={`${x}-${y}`}
                x={x}
                y={y + dy}
                width={1.02}
                height={1.02}
                fill={color}
              />
            );
          });
        })}
      </g>
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Generic SVG sprite (all non-CEO agents)                                     */
/* -------------------------------------------------------------------------- */

function GenericSvgSprite({
  gender,
  facing,
  walking,
  sitting,
  size,
  accent,
  skinTone,
}: {
  gender: Gender;
  facing: Facing;
  walking: boolean;
  sitting?: boolean;
  size: number;
  accent?: string;
  skinTone?: SkinTone;
}) {
  const W = 14;
  const H = 19;

  // When sitting: freeze walk animation
  const activeWalking = sitting ? false : walking;

  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!activeWalking) {
      setFrame(0);
      return;
    }
    const id = window.setInterval(() => {
      setFrame((f) => (f + 1) % 4);
    }, 130);
    return () => window.clearInterval(id);
  }, [activeWalking]);

  // Typing arm animation: 4-phase cycle, alternates left/right arm pixel
  const [typingFrame, setTypingFrame] = useState(0);
  useEffect(() => {
    if (!sitting) { setTypingFrame(0); return; }
    const id = window.setInterval(() => setTypingFrame((f) => (f + 1) % 4), 190);
    return () => window.clearInterval(id);
  }, [sitting]);

  const palette = useMemo(() => buildPalette(gender, accent, skinTone), [gender, accent, skinTone]);
  const grid = useMemo(
    () => sitting
      ? sittingGridFor(palette, gender)
      : spriteFor(facing, palette, gender, frame),
    [sitting, facing, palette, gender, frame]
  );

  const bob = activeWalking ? (frame % 2 === 0 ? 0 : -0.5) : 0;

  // When sitting, clip the leg rows (15+) so the sprite looks like it's seated
  // behind the desk — only head + torso visible.
  const svgH = sitting ? 15 : H + 1;

  // Arm pixels in the sittingGridFor layout:
  //   col 1  = left arm, rows 10-11
  //   col 11 = right arm, rows 10-11
  // typingFrame 1 → left arm lifts,  typingFrame 3 → right arm lifts
  const ARM_DY     = -0.85;
  const leftArmUp  = sitting && typingFrame === 1;
  const rightArmUp = sitting && typingFrame === 3;

  return (
    <svg
      viewBox={`0 0 ${W} ${svgH}`}
      width={size}
      height={(size / W) * svgH}
      shapeRendering="crispEdges"
      style={{ imageRendering: 'pixelated', display: 'block' }}
    >
      {/* Ground shadow — only when standing/walking */}
      {!sitting && (
        <ellipse cx={W / 2} cy={H} rx={3.2} ry={0.55} fill="rgba(0,0,0,0.35)" />
      )}
      <g transform={`translate(0 ${bob})`}>
        {grid.map((row, y) => {
          if (sitting && y >= 15) return null; // clip legs
          return row.map((color, x) => {
            if (!color) return null;
            // Per-pixel y-offset for arm animation only
            const isLeftArm  = sitting && x === 1  && y >= 10 && y <= 11;
            const isRightArm = sitting && x === 11 && y >= 10 && y <= 11;
            const dy = (isLeftArm && leftArmUp) ? ARM_DY
                     : (isRightArm && rightArmUp) ? ARM_DY
                     : 0;
            return (
              <rect
                key={`${x}-${y}`}
                x={x}
                y={y + dy}
                width={1}
                height={1}
                fill={color as string}
              />
            );
          });
        })}
      </g>
    </svg>
  );
}

const SKIN_TONES: Record<SkinTone, { skin: string; skinShade: string }> = {
  light:  { skin: '#efd3b5', skinShade: '#b7876a' },
  medium: { skin: '#c8956c', skinShade: '#8b5c3a' },
  dark:   { skin: '#7d4e2d', skinShade: '#4a2c1a' },
};

// Hair colours matched to skin tone for natural variety
const HAIR_TONES: Record<SkinTone, { male: string; maleHi: string; female: string; femaleHi: string }> = {
  light:  { male: '#3a2418', maleHi: '#5c3a24', female: '#5a3a28', femaleHi: '#7a5438' },
  medium: { male: '#1a0e08', maleHi: '#2e1a10', female: '#2e1408', femaleHi: '#52280e' },
  dark:   { male: '#0d0806', maleHi: '#1a100a', female: '#1a0e08', femaleHi: '#2e1a10' },
};

function buildPalette(gender: Gender, accent?: string, skinTone: SkinTone = 'light') {
  const st = SKIN_TONES[skinTone];
  const ht = HAIR_TONES[skinTone];
  return {
    hair:      gender === 'female' ? ht.female   : ht.male,
    hairHi:    gender === 'female' ? ht.femaleHi : ht.maleHi,
    skin:      st.skin,
    skinShade: st.skinShade,
    vest: '#181820',
    vestHi: '#2a2a35',
    shirt: '#6e2a2a',
    shirtHi: accent && /^#[0-9a-fA-F]{3,6}$/.test(accent) ? accent : '#9a3a3a',
    pants: '#1e2028',
    pantsHi: '#2a2c34',
    shoes: '#0a0a0a',
    eye: '#0c0c0c',
  };
}

/**
 * Static seated sprite viewed from behind.
 * Rows 0-14 are identical to the standing back-view.
 * Rows 15-18 replace the standing legs with thighs spread wide + feet below.
 */
function sittingGridFor(pal: Record<string, string>, gender: Gender): (string | 0)[][] {
  const H = pal.hair, Hh = pal.hairHi;
  const S = pal.skin;
  const V = pal.vest, Vh = pal.vestHi;
  const Sh = pal.shirt, Sh2 = pal.shirtHi;
  const P = pal.pants, Ph = pal.pantsHi;
  const Bt = pal.shoes;
  const _ = 0 as const;
  const sideHair = gender === 'female';

  return [
    // ── Head (rows 0-8) — same as back-view standing ──
    [_, _, _, _, _, H,  H,  H,  H,  _, _, _, _, _],
    [_, _, _, _, H,  Hh, Hh, Hh, Hh, H,  _, _, _, _],
    [_, _, _, H,  H,  Hh, H,  H,  Hh, H,  H,  _, _, _],
    [_, _, H,  H,  Hh, H,  H,  H,  H,  Hh, H,  H,  _, _],
    [_, H,  H,  Hh, H,  H,  H,  H,  H,  H,  Hh, H,  H,  _],
    [_, H,  Hh, H,  H,  H,  H,  H,  H,  H,  H,  Hh, H,  _],
    [_, _, H,  H,  H,  H,  H,  H,  H,  H,  H,  H,  _, _],
    [_, _, sideHair ? H : S, S, S, S, S, S, S, S, sideHair ? H : S, _, _, _],
    [_, _, _, S,  S,  S,  S,  S,  S,  S,  _, _, _, _],
    // ── Torso (rows 9-14) — same as back-view standing ──
    [_, _, V,  V,  V,  V,  V,  V,  V,  V,  V,  _, _, _],
    [_, S,  V,  Vh, V,  Sh, Sh, V,  Vh, V,  V,  S,  _, _],
    [_, S,  V,  V,  Sh, Sh, Sh, Sh, V,  V,  V,  S,  _, _],
    [_, _, V,  V,  Sh, Sh2,Sh2,Sh, V,  V,  _, _, _, _],
    [_, _, V,  V,  V,  V,  V,  V,  V,  V,  _, _, _, _],
    [_, _, _, V,  V,  V,  V,  V,  V,  _, _, _, _, _],
    // ── Seated legs (rows 15-18) ──
    // Thighs spread wide to the sides (person sitting, viewed from behind)
    [_, _, Ph, P,  P,  P,  _, _, P,  P,  P,  Ph, _, _],
    // Inner thigh / knee area
    [_, _, _, P,  Ph, P,  _, _, P,  Ph, P,  _, _, _],
    // Feet visible below the chair seat
    [_, _, _, Bt, Bt, _, _, _, _, Bt, Bt, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ];
}

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
