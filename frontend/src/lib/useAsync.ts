import { useCallback, useEffect, useRef, useState } from "react";

/** Load data, keep the last good value while refreshing, expose reload(). */
export function useAsync<T>(load: (signal: AbortSignal) => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const ctrl = useRef<AbortController | null>(null);

  const run = useCallback(() => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setLoading(true);
    load(c.signal)
      .then((d) => {
        if (!c.signal.aborted) {
          setData(d);
          setError(null);
        }
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
    return () => ctrl.current?.abort();
  }, [run]);

  return { data, error, loading, reload: run, setData };
}
