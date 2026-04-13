import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface LineageState {
  tokenId: number | null;
  open: (id: number) => void;
  close: () => void;
}

const LineageContext = createContext<LineageState | null>(null);

export function LineageProvider({ children }: { children: ReactNode }) {
  const [tokenId, setTokenId] = useState<number | null>(null);

  const open = useCallback((id: number) => setTokenId(id), []);
  const close = useCallback(() => setTokenId(null), []);

  return (
    <LineageContext.Provider value={{ tokenId, open, close }}>
      {children}
    </LineageContext.Provider>
  );
}

export function useLineage(): LineageState {
  const ctx = useContext(LineageContext);
  if (!ctx) throw new Error('useLineage must be used within LineageProvider');
  return ctx;
}
