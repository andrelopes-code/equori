export interface OverrunGeometry {
  // Where the room ends and the overrun starts, in percent of the bar.
  room: number;
  // The width of the overrun, in percent of the bar.
  overrun: number;
}

// The bar is a little longer than the larger of the room and the spent amount, so the overrun's
// end never touches the edge. Both amounts share one currency and are integers of minor units.
const headroom = 1.06;

export function overrunGeometry(room: number, spent: number): OverrunGeometry {
  const length = Math.max(room, spent, 1) * headroom;
  const roomShare = (Math.max(room, 0) * 100) / length;

  return {
    room: roomShare,
    overrun: (Math.max(spent - Math.max(room, 0), 0) * 100) / length,
  };
}
