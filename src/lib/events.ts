/**
 * Tiny change bus. Any write to the database calls `emitChange()`, and screens
 * re-query through `useDataVersion()`. This keeps the data layer plain async
 * functions (no global store library needed for an app this size).
 */
import { useEffect, useState } from 'react';

type Listener = () => void;
const listeners = new Set<Listener>();

export function emitChange() {
  listeners.forEach((l) => l());
}

export function onChange(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Returns a number that increments whenever data changes. */
export function useDataVersion(): number {
  const [v, setV] = useState(0);
  useEffect(() => onChange(() => setV((x) => x + 1)), []);
  return v;
}
