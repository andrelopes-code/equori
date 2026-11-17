import { useCallback } from "react";
import type { RefCallback } from "react";

const finePointer = "(hover: hover) and (pointer: fine)";
const reducedMotion = "(prefers-reduced-motion: reduce)";
const properties = ["--mx", "--my", "--rx", "--ry"];

export function useFaceTilt<T extends HTMLElement>(): RefCallback<T> {
  return useCallback((face: T | null) => {
    if (face === null) {
      return undefined;
    }

    const move = (event: PointerEvent) => {
      tilt(face, event);
    };
    const leave = () => {
      release(face);
    };

    face.addEventListener("pointermove", move);
    face.addEventListener("pointerleave", leave);

    return () => {
      face.removeEventListener("pointermove", move);
      face.removeEventListener("pointerleave", leave);
    };
  }, []);
}

function tilt(face: HTMLElement, event: PointerEvent) {
  if (
    !window.matchMedia(finePointer).matches ||
    window.matchMedia(reducedMotion).matches
  ) {
    return;
  }

  const box = face.getBoundingClientRect();
  const x = (event.clientX - box.left) / box.width;
  const y = (event.clientY - box.top) / box.height;

  face.setAttribute("data-live", "");
  face.style.setProperty("--mx", `${String(x * 100)}%`);
  face.style.setProperty("--my", `${String(y * 100)}%`);
  face.style.setProperty("--ry", `${String((x - 0.5) * 14)}deg`);
  face.style.setProperty("--rx", `${String((0.5 - y) * 10)}deg`);
}

function release(face: HTMLElement) {
  face.removeAttribute("data-live");

  for (const property of properties) {
    face.style.removeProperty(property);
  }
}
