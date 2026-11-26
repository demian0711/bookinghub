'use client';
import { useEffect, useState } from 'react';
type Result<T> = { url: string; data: T } | { url: string; error: number };
export function useResource<T>(url: string) {
  const [attempt, retry] = useState(0);
  const [result, setResult] = useState<Result<T>>();
  useEffect(() => {
    const abort = new AbortController();
    async function load() {
      try {
        const response = await fetch(url, {
          signal: abort.signal,
          cache: 'no-store',
        });
        if (!response.ok) {
          if (!abort.signal.aborted) setResult({ url, error: response.status });
          return;
        }
        const data: T = await response.json();
        if (!abort.signal.aborted) setResult({ url, data });
      } catch {
        if (!abort.signal.aborted) setResult({ url, error: 0 });
      }
    }
    void load();
    return () => abort.abort();
  }, [url, attempt]);
  return {
    result: result?.url === url ? result : undefined,
    retry: () => {
      setResult(undefined);
      retry((n) => n + 1);
    },
  };
}
