import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { HydratedToken } from '../lib/tokenUtils';

interface MergeState {
  survivor: HydratedToken | null;
  burn: HydratedToken | null;
  swap: boolean;
  setSurvivor: (t: HydratedToken | null) => void;
  setBurn: (t: HydratedToken | null) => void;
  setSwap: (v: boolean) => void;
  clear: () => void;
}

const MergeContext = createContext<MergeState | null>(null);

export function MergeProvider({ children }: { children: ReactNode }) {
  const [survivor, setSurvivor] = useState<HydratedToken | null>(null);
  const [burn, setBurn] = useState<HydratedToken | null>(null);
  const [swap, setSwap] = useState(false);

  const clear = useCallback(() => {
    setSurvivor(null);
    setBurn(null);
    setSwap(false);
  }, []);

  return (
    <MergeContext.Provider value={{ survivor, burn, swap, setSurvivor, setBurn, setSwap, clear }}>
      {children}
    </MergeContext.Provider>
  );
}

export function useMerge(): MergeState {
  const ctx = useContext(MergeContext);
  if (!ctx) throw new Error('useMerge must be used within a MergeProvider');
  return ctx;
}
