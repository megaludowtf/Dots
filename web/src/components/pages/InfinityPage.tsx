import { useState, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { useOwnedTokens } from '@/hooks/useOwnedTokens';
import { useInfinityAction } from '@/hooks/useInfinityAction';
import { StatusMessage } from '@/components/shared/StatusMessage';
import { hasContract } from '@/config/contract';
// @ts-ignore
import { renderSVG } from '@/art/art';

const REQUIRED = 64;

export function InfinityPage() {
  const { isConnected } = useAccount();
  const { tokens, isLoading } = useOwnedTokens();
  const { infinity, status, error, txHash } = useInfinityAction();

  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Only single dots (divisorIndex === 6) can be burned for infinity
  const singleDots = useMemo(() => {
    if (!tokens) return [];
    return tokens.filter((t: any) => t.divisorIndex === 6);
  }, [tokens]);

  const toggleSelection = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < REQUIRED) {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    const ids = singleDots.slice(0, REQUIRED).map((t: any) => t.id);
    setSelected(new Set(ids));
  };

  const handleBurn = () => {
    if (selected.size !== REQUIRED) return;
    infinity(Array.from(selected));
  };

  const fillPercent = Math.min(100, (selected.size / REQUIRED) * 100);

  const statusText = (() => {
    if (status === 'confirming') return 'Confirm in wallet...';
    if (status === 'pending') return 'Waiting for confirmation...';
    if (status === 'success') return `Mega Dot forged! tx: ${txHash}`;
    if (status === 'error') return error?.message ?? 'Transaction failed';
    return '';
  })();

  const statusTone = status === 'success' ? 'ok' : status === 'error' ? 'err' : '';

  return (
    <section id="infinity" className="is-page">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">07 &mdash; Mega Dot</span>
          <h2>Forge the Mega Dot.</h2>
          <p className="body">
            Collapse 64 single dots into one terminal Mega Dot. This is the final
            evolution, a single inverted logomark. Irreversible.
          </p>
        </div>

        <div className="infinity-panel">
          <div className="infinity-meter">
            <div className="meter-head">
              <span className="label">Selected</span>
              <span className="count">{selected.size}</span>
              <span className="sub">/ {REQUIRED}</span>
            </div>
            <div className="meter-bar">
              <div className="meter-fill" style={{ width: `${fillPercent}%` }} />
            </div>
          </div>

          <div className="infinity-picker">
            <div className="hint">
              {isLoading
                ? 'Loading your tokens...'
                : singleDots.length === 0
                  ? 'No single dots in your wallet. Merge tokens down to 1 dot first.'
                  : `Select ${REQUIRED} single dots to burn.`}
              {singleDots.length >= REQUIRED && (
                <button
                  onClick={selectAll}
                  style={{
                    marginLeft: 12,
                    textDecoration: 'underline',
                    color: 'var(--text)',
                    background: 'none',
                    border: 'none',
                    fontFamily: 'inherit',
                    fontSize: 'inherit',
                    letterSpacing: 'inherit',
                    textTransform: 'inherit' as any,
                    cursor: 'pointer',
                  }}
                >
                  Select first {REQUIRED}
                </button>
              )}
            </div>

            <div className="infinity-grid">
              {singleDots.map((token: any) => {
                const isSelected = selected.has(token.id);
                let svg: string | null = null;
                try {
                  svg = token.svg ?? renderSVG({
                    seed: token.seed,
                    divisorIndex: 6,
                    merges: [],
                    isMega: 0,
                  });
                } catch {
                  // render fallback
                }
                return (
                  <div
                    key={token.id}
                    className={`tile${isSelected ? ' selected' : ''}`}
                    onClick={() => toggleSelection(token.id)}
                  >
                    {svg ? (
                      <div dangerouslySetInnerHTML={{ __html: svg }} />
                    ) : (
                      <div className="art-placeholder" />
                    )}
                    <span className="tid">#{token.id}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="infinity-cta">
            <button
              className="mint-btn"
              disabled={
                !isConnected ||
                !hasContract ||
                selected.size !== REQUIRED ||
                status === 'confirming' ||
                status === 'pending'
              }
              onClick={handleBurn}
            >
              BURN {REQUIRED} &rarr; MEGA DOT
            </button>
            <StatusMessage text={statusText} tone={statusTone as 'ok' | 'err' | ''} />
          </div>
        </div>
      </div>
    </section>
  );
}
