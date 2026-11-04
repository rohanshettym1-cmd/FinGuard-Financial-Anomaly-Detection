import { useCallback, useEffect, useState } from 'react';

export function useResource(loader, dependencies = []) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setState((previous) => ({ ...previous, loading: true, error: null }));
    Promise.resolve()
      .then(() => loader(controller.signal))
      .then((data) => {
        if (!controller.signal.aborted) setState({ data, error: null, loading: false });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState((previous) => ({ ...previous, error, loading: false }));
      });
    return () => controller.abort();
    // Callers list the primitive values captured by their loader, just as for useEffect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, revision]);
  return { ...state, reload };
}
