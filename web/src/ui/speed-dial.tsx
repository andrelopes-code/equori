import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { createPortal } from "react-dom";

import styles from "@/ui/speed-dial.module.css";

export interface SpeedDialAction {
  id: string;
  // The label beside the action and its accessible name.
  label: string;
  icon: ReactNode;
  onSelect: () => void;
}

function orb(mark: ReactNode) {
  return (
    <span className={styles.orb}>
      <span className={styles.press}>
        <span className={styles.glow} />
        <span className={styles.glass} />
        <span className={styles.rim} />
        <span className={styles.glyph}>{mark}</span>
      </span>
    </span>
  );
}

// Families read: menu, button, popover, drawer. Menu draws its surface in a positioned layer
// apart from its trigger, so its items cannot rise out of the button and share the liquid
// layer's coordinates, and its arrows wrap instead of returning to the button. The dial is
// equori's own by choice: a glass button whose actions rise out of it.
// The layer is rendered at the end of the document: the navigation bar it stands over is a
// backdrop root and a containing block for fixed descendants, which would clip the scrim and
// leave the glass with nothing to blur.
export function SpeedDial({
  actions,
  label,
  closeLabel,
  offset,
  tone = "aurora",
}: {
  // Ordered from the button upward.
  actions: readonly SpeedDialAction[];
  label: string;
  closeLabel: string;
  // Pixels between the bottom of the viewport and the bar the button stands above.
  offset: number;
  tone?: "aurora" | "accent";
}) {
  const [open, setOpen] = useState(false);
  // Until the first press the liquid plays no closing animation.
  const [moved, setMoved] = useState(false);
  const focusFirst = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const fab = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  // Per instance: the gradient stops read the custom properties at the gradient's own place.
  const id = useId();
  const goo = `${id}-goo`;
  const gradient = `${id}-gradient`;
  const menu = `${id}-menu`;

  useEffect(() => {
    if (open && focusFirst.current) items.current[0]?.focus();
    focusFirst.current = false;
  }, [open]);

  const toggle = (next: boolean) => {
    setMoved(true);
    setOpen(next);
    if (!next && root.current?.contains(document.activeElement)) {
      fab.current?.focus();
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (!open) return;
    const list = items.current.slice(0, actions.length);
    const at = list.findIndex((item) => item === document.activeElement);
    const move = (target: HTMLElement | null | undefined) => {
      event.preventDefault();
      target?.focus();
    };
    switch (event.key) {
      case "Escape":
        event.preventDefault();
        toggle(false);
        break;
      case "ArrowUp":
        move(list[Math.min(list.length - 1, at + 1)]);
        break;
      case "ArrowDown":
        move(at <= 0 ? fab.current : list[at - 1]);
        break;
      case "Home":
        move(list[0]);
        break;
      case "End":
        move(list.at(-1));
        break;
      case "Tab":
        toggle(false);
        break;
    }
  };

  return createPortal(
    <div
      ref={root}
      data-own="speed-dial"
      data-open={open}
      data-moved={moved || undefined}
      data-tone={tone}
      className={styles.root}
      style={
        {
          "--offset": `${String(offset)}px`,
          "--n": actions.length,
        } as CSSProperties
      }
    >
      <div
        aria-hidden="true"
        className={styles.scrim}
        onClick={() => {
          toggle(false);
        }}
      />
      <div className={styles.stage} onKeyDown={onKeyDown}>
        <svg className={styles.defs} aria-hidden="true" focusable="false">
          <filter id={goo} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
          <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" className={styles.stop1} />
            <stop offset="0.5" className={styles.stop2} />
            <stop offset="1" className={styles.stop3} />
          </linearGradient>
        </svg>
        <div
          aria-hidden="true"
          className={styles.liquid}
          style={{ filter: `url(#${goo})` }}
        >
          {actions.map((action, i) => (
            <span
              key={action.id}
              className={styles.drop}
              style={{ "--i": i } as CSSProperties}
            />
          ))}
          <span className={styles.dropMain} />
        </div>
        <button
          ref={fab}
          type="button"
          className={styles.fab}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={menu}
          aria-label={open ? closeLabel : label}
          onClick={(event) => {
            // detail 0: the press came from the keyboard.
            focusFirst.current = !open && event.detail === 0;
            toggle(!open);
          }}
        >
          {orb(
            <svg
              className={styles.plus}
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="none"
              stroke={`url(#${gradient})`}
              strokeWidth={2.2}
              strokeLinecap="round"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>,
          )}
        </button>
        <div id={menu} role="menu" aria-label={label}>
          {actions.map((action, i) => (
            <button
              key={action.id}
              ref={(element) => {
                items.current[i] = element;
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className={styles.item}
              style={{ "--i": i } as CSSProperties}
              onClick={() => {
                toggle(false);
                action.onSelect();
              }}
            >
              <span className={styles.chip}>{action.label}</span>
              {orb(action.icon)}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
