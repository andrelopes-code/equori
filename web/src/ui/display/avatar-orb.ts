export interface AvatarOrb {
  // The direction the first colour flows into the second, in degrees.
  angle: number;
}

// A person's mark, drawn from what names them: the same seed always gives the same angle. The
// colours come from the accent in user-avatar.module.css. The hash is FNV-1a; the stream after it
// is mulberry32.
export function avatarOrb(seed: string): AvatarOrb {
  const next = stream(hash(seed));

  return { angle: Math.floor(next() * 360) };
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
