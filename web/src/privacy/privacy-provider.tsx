import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

const STORAGE_KEY = "equori.privacy";
const AUTO_KEY = "equori.privacyAuto";
const HIDDEN = "hidden";
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"];

export type PrivacyAuto = "never" | "leave" | "idle";
export const privacyAutos: readonly PrivacyAuto[] = ["never", "leave", "idle"];
export const IDLE_MS = 300_000;

interface Privacy {
  hidden: boolean;
  auto: PrivacyAuto;
  setAuto: (value: PrivacyAuto) => void;
  setHidden: (hidden: boolean) => void;
  toggle: () => void;
}

// A component outside the provider shows masks: a missing provider is seen at once, a leak is not.
const PrivacyContext = createContext<Privacy>({
  hidden: true,
  auto: "never",
  setAuto: () => undefined,
  setHidden: () => undefined,
  toggle: () => undefined,
});

function read(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === HIDDEN;
  } catch {
    return false;
  }
}

function readAuto(): PrivacyAuto {
  try {
    const stored = localStorage.getItem(AUTO_KEY);
    return privacyAutos.find((value) => value === stored) ?? "never";
  } catch {
    return "never";
  }
}

function writeAuto(auto: PrivacyAuto): void {
  try {
    localStorage.setItem(AUTO_KEY, auto);
  } catch {
    // The choice still holds for this page load when storage is unavailable.
  }
}

function write(hidden: boolean): void {
  try {
    if (hidden) localStorage.setItem(STORAGE_KEY, HIDDEN);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // The choice still holds for this page load when storage is unavailable.
  }
}

// Whether amounts are hidden, kept per browser. The first render already reads the stored choice.
export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [hidden, setHiddenState] = useState(read);
  const setHidden = useCallback((next: boolean) => {
    write(next);
    setHiddenState(next);
  }, []);
  const [auto, setAutoState] = useState(readAuto);
  const setAuto = useCallback((next: PrivacyAuto) => {
    writeAuto(next);
    setAutoState(next);
  }, []);
  const toggle = useCallback(() => {
    setHidden(!hidden);
  }, [hidden, setHidden]);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setHiddenState(read());
      if (event.key === AUTO_KEY) setAutoState(readAuto());
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  useEffect(() => {
    if (auto !== "leave") return;
    const onChange = () => {
      if (document.visibilityState === "hidden") setHidden(true);
    };
    document.addEventListener("visibilitychange", onChange);
    return () => {
      document.removeEventListener("visibilitychange", onChange);
    };
  }, [auto, setHidden]);
  useEffect(() => {
    if (auto !== "idle") return;
    let timer = setTimeout(() => {
      setHidden(true);
    }, IDLE_MS);
    const restart = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        setHidden(true);
      }, IDLE_MS);
    };
    for (const name of ACTIVITY_EVENTS) {
      window.addEventListener(name, restart, { passive: true });
    }
    return () => {
      clearTimeout(timer);
      for (const name of ACTIVITY_EVENTS) {
        window.removeEventListener(name, restart);
      }
    };
  }, [auto, setHidden]);
  const value = useMemo(
    () => ({ hidden, auto, setAuto, setHidden, toggle }),
    [hidden, auto, setAuto, setHidden, toggle],
  );
  return <PrivacyContext value={value}>{children}</PrivacyContext>;
}

export function usePrivacy(): Privacy {
  return useContext(PrivacyContext);
}
