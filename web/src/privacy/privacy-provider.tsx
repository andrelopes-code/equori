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
const HIDDEN = "hidden";

interface Privacy {
  hidden: boolean;
  setHidden: (hidden: boolean) => void;
  toggle: () => void;
}

// A component outside the provider shows masks: a missing provider is seen at once, a leak is not.
const PrivacyContext = createContext<Privacy>({
  hidden: true,
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
  const toggle = useCallback(() => {
    setHidden(!hidden);
  }, [hidden, setHidden]);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setHiddenState(read());
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  const value = useMemo(
    () => ({ hidden, setHidden, toggle }),
    [hidden, setHidden, toggle],
  );
  return <PrivacyContext value={value}>{children}</PrivacyContext>;
}

export function usePrivacy(): Privacy {
  return useContext(PrivacyContext);
}
