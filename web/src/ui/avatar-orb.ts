export interface AvatarOrb {
  // Two neighbours on the wheel of the data slots, so the pair always sits close in hue.
  slots: [number, number];
  // The direction the first slot flows into the second, in degrees.
  angle: number;
}

// The eight slots in the order of their hue: indigo, blue, teal, green, amber, orange, rose,
// magenta. A person takes one and the one after it; the last one wraps to the first.
const wheel = [1, 5, 3, 6, 2, 8, 4, 7] as const;

// A person's mark, drawn from what names them: the same seed always gives the same orb, and a
// different seed gives another. The hash is FNV-1a; the stream after it is mulberry32.
export function avatarOrb(seed: string): AvatarOrb {
  const next = stream(hash(seed));

  const at = Math.floor(next() * wheel.length);
  const first = wheel[at] ?? 1;
  const second = wheel[(at + 1) % wheel.length] ?? 5;

  return { slots: [first, second], angle: Math.floor(next() * 360) };
}

function hash(text: string): number {
  let h = 2166136261;
  for (const unit of text) {
    h = Math.imul(h ^ (unit.codePointAt(0) ?? 0), 16777619);
  }
  return h >>> 0;
}

function stream(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
