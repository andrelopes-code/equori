import { VIDEO_VIEW } from "@/features/help/video/compose-frame";
import type { VideoFrame } from "@/features/help/video/compose-frame";

export interface VideoStyle {
  // The accent of the theme the stills were taken in.
  accent: string;
  // The font family of the application, for the number of the mark.
  font: string;
}

// Device pixels per CSS pixel of a still: the canvas draws at the size of the still.
export const VIDEO_RATIO = 2;

// Lucide mouse-pointer-2 (ISC licence) on its 24-unit grid; its tip stands at 4.04, 4.04.
const ARROW =
  "M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0" +
  "-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z";

const out = (x: number) => 1 - Math.pow(1 - x, 3);
// Named apart from the clamp of compose-frame.ts: the review page of the tool runs both files in
// one script.
const unit = (x: number) => Math.max(0, Math.min(1, x));

// Draws one frame on a canvas of 3840 by 2400: the stills, the mark of the step, the click and
// the pointer. Every length is in CSS pixels of the screen times the ratio.
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  stills: readonly CanvasImageSource[],
  frame: VideoFrame,
  style: VideoStyle,
): void {
  const R = VIDEO_RATIO;
  const W = VIDEO_VIEW.width * R;
  const H = VIDEO_VIEW.height * R;
  const top = stills[frame.still];
  const under = frame.under === undefined ? undefined : stills[frame.under];
  if (top === undefined) return;

  ctx.imageSmoothingQuality = "high";
  ctx.globalAlpha = 1;
  if (under !== undefined) {
    ctx.drawImage(under, 0, 0, W, H);
    ctx.globalAlpha = frame.fade;
  }

  ctx.drawImage(top, 0, 0, W, H);
  ctx.globalAlpha = 1;

  drawMark(ctx, frame, style);

  const px = frame.pointer.x * R;
  const py = frame.pointer.y * R;

  if (frame.click >= 0) drawClick(ctx, px, py, frame.click, style.accent);

  drawPointer(ctx, px, py, frame.press, style.accent);
}

// The mark of the step: the same outline and number the figure carries.
function drawMark(
  ctx: CanvasRenderingContext2D,
  frame: VideoFrame,
  style: VideoStyle,
): void {
  if (frame.markOpacity <= 0) return;

  const R = VIDEO_RATIO;
  const m = frame.mark;
  const x = m.x * R;
  const y = m.y * R;

  ctx.globalAlpha = frame.markOpacity;
  ctx.beginPath();
  ctx.roundRect(x, y, m.width * R, m.height * R, 8 * R);
  ctx.lineWidth = 2 * R;
  ctx.strokeStyle = style.accent;
  ctx.stroke();

  if (frame.number > 0) {
    const bx = frame.badge.x * R;
    const by = frame.badge.y * R;

    ctx.beginPath();
    ctx.arc(bx, by, 10.5 * R, 0, Math.PI * 2);
    ctx.fillStyle = style.accent;
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `600 ${String(11 * R)}px ${style.font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(frame.number), bx, by + R * 0.5);
  }

  ctx.globalAlpha = 1;
}

// The click, in three beats the eye can follow: a disc lights the place, two rings open from it
// one after the other, and the pointer presses down and comes back.
function drawClick(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  c: number,
  accent: string,
): void {
  const R = VIDEO_RATIO;

  ctx.beginPath();
  ctx.arc(px, py, (12 + 14 * out(c)) * R, 0, Math.PI * 2);
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.32 * (1 - c);
  ctx.fill();

  // A white edge under the first ring keeps it visible on a ground of the accent itself.
  ctx.beginPath();
  ctx.arc(px, py, (10 + 30 * out(c)) * R, 0, Math.PI * 2);
  ctx.lineWidth = 6 * R;
  ctx.strokeStyle = "#fff";
  ctx.globalAlpha = 0.55 * (1 - c);
  ctx.stroke();
  ctx.lineWidth = 3 * R;
  ctx.strokeStyle = accent;
  ctx.globalAlpha = 1 - c;
  ctx.stroke();

  const late = unit((c - 0.22) / 0.78);
  ctx.beginPath();
  ctx.arc(px, py, (10 + 46 * out(late)) * R, 0, Math.PI * 2);
  ctx.lineWidth = 2 * R;
  ctx.globalAlpha = c > 0.22 ? 0.65 * (1 - late) : 0;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// The pointer: a rounded arrow in the accent of the theme, edged in white, over a soft glow of
// the same colour, so it reads as part of the application and stands out on both schemes.
function drawPointer(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  press: number,
  accent: string,
): void {
  const R = VIDEO_RATIO;
  const glow = ctx.createRadialGradient(px, py, 0, px, py, 26 * R);

  glow.addColorStop(0, accent);
  glow.addColorStop(1, "transparent");
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(px, py, 26 * R, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.translate(px, py);
  ctx.scale(R * 1.25 * press, R * 1.25 * press);
  ctx.translate(-4.04, -4.04);
  // A shadow is not scaled by the transform: its blur and offset are device pixels, the 8 and 3
  // of the 2560 px frame the video was encoded at, at the ratio of the still.
  ctx.shadowColor = "rgba(0,0,0,.4)";
  ctx.shadowBlur = 6 * R;
  ctx.shadowOffsetY = 2.25 * R;
  ctx.fillStyle = accent;

  const arrow = new Path2D(ARROW);
  ctx.fill(arrow);
  ctx.shadowColor = "transparent";
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#fff";
  ctx.lineJoin = "round";
  ctx.stroke(arrow);
  ctx.restore();
}
