/**
 * Minimal data hook: runs an async loader on mount, whenever the database
 * changes (emitChange), and when the screen regains focus.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useDataVersion } from '../lib/events';

export function useQuery<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const version = useDataVersion();
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<unknown>(null);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const run = useCallback(() => {
    let cancelled = false;
    loaderRef
      .current()
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e));
    return () => {
      cancelled = true;
    };
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(run, [version, run, ...deps]);
  useFocusEffect(run);

  return { data, error, reload: run };
}
