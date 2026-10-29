// A choice kept in this browser: one of a closed set of values, or any value a check accepts.
// Every reader subscribes to one store, so a change made in one place shows everywhere at once.
// paint puts the value on the page; it runs on every apply, the start of the page included.
export interface Preference<T extends string> {
  fallback: T;
  accepts: (value: string) => value is T;
  read: () => T;
  snapshot: () => T;
  subscribe: (listener: () => void) => () => void;
  apply: (value: T) => void;
}

export function preference<T extends string>(
  key: string,
  values: readonly T[] | ((value: string) => boolean),
  fallback: T,
  paint: (value: T) => void,
): Preference<T> {
  const listeners = new Set<() => void>();
  // Holds the choice for this page load only while storage refuses the write.
  let held: T | undefined;
  const isValue = (value: string | null): value is T =>
    value !== null &&
    (typeof values === "function"
      ? values(value)
      : (values as readonly string[]).includes(value));
  const read = (): T => {
    try {
      const stored = localStorage.getItem(key);
      return isValue(stored) ? stored : fallback;
    } catch {
      return fallback;
    }
  };
  return {
    fallback,
    accepts: isValue,
    read,
    snapshot: () => held ?? read(),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    apply: (value) => {
      try {
        localStorage.setItem(key, value);
        held = undefined;
      } catch {
        // The choice still applies to this page load when storage is unavailable.
        held = value;
      }
      paint(value);
      listeners.forEach((listener) => {
        listener();
      });
    },
  };
}
