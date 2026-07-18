import { useSyncExternalStore } from 'react';

// true solo tras hidratar en el cliente; evita mismatch SSR con sessionStorage
export const useMounted = () =>
  useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
