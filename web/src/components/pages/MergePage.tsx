import { useState, useMemo } from 'react';
import { useMerge } from '@/contexts/MergeContext';
import { useMergeAction } from '@/hooks/useMergeAction';
import { useOwnedTokens } from '@/hooks/useOwnedTokens';
import { StatusMessage } from '@/components/shared/StatusMessage';
import { hasContract } from '@/config/contract';
import { useAccount } from 'wagmi';
// @ts-ignore
import { renderSVG, glyphCount } from '@/art/art';

export function MergePage() {
  const { isConnected } = useAccount();
  const { survivor, burn, swap, setSwap, setSurvivor, setBurn, clear } = useMerge();
  const { merge, status, error, txHash } = useMergeAction();

  const [pickerSlot, setPickerSlot] = useState<'survivor' | 'burn' | null>(null);

  // Validation
  const isValidPair = useMemo(() => {
    if (!survivor || !burn) return false;
    if (survivor.id === burn.id) return false;
    if (survivor.divisorIndex !== burn.divisorIndex) return false;
    if (survivor.divisorIndex >= 7) return false; // cannot merge mega dots
    return true;
  }, [survivor, burn]);

  // Result preview
  const resultSvg = useMemo(() => {
    if (!isValidPair || !survivor) return null;
    try {
      return renderSVG({
        seed: swap ? burn!.seed : survivor.seed,
        divisorIndex: survivor.divisorIndex + 1,
        merges: [],
        isMega: survivor.divisorIndex + 1 >= 7 ? 1 : 0,
      });
    } catch {
      return null;
    }
  }, [isValidPair, survivor, burn, swap]);

  const handleMerge = () => {
    if (!isValidPair || !survivor || !burn) return;
    merge(survivor.id, burn.id, swap);
  };

  const statusText = (() => {
    if (status === 'confirming') return 'Confirm in wallet...';
    if (status === 'pending') return 'Waiting for confirmation...';
    if (status === 'success') return `Merged! tx: ${txHash}`;
    if (status === 'error') return error?.message ?? 'Transaction failed';
    if (survivor && burn && !isValidPair) {
      if (survivor.id === burn.id) return 'Cannot merge a token with itself';
      if (survivor.divisorIndex !== burn.divisorIndex) return 'Both tokens must be at the same level';
      if (survivor.divisorIndex >= 7) return 'Cannot merge mega dots';
    }
    return '';
  })();

  const statusTone = status === 'success' ? 'ok' : (status === 'error' || (survivor && burn && !isValidPair)) ? 'err' : '';

  const renderSlot = (token: any, label: string, slotType: 'survivor' | 'burn') => (
    <div
      className={`slot${token ? ' filled' : ''}`}
      onClick={() => setPickerSlot(slotType)}
    >
      {token?.svg ? (
        <div dangerouslySetInnerHTML={{ __html: token.svg }} />
      ) : token ? (
        (() => {
          try {
            const svg = renderSVG({
              seed: token.seed,
              divisorIndex: token.divisorIndex,
              merges: [],
              isMega: token.isMega ?? 0,
            });
            return <div dangerouslySetInnerHTML={{ __html: svg }} />;
          } catch {
            return <div className="placeholder">#{token.id}</div>;
          }
        })()
      ) : (
        <div className="placeholder">Click to pick {label}</div>
      )}
    </div>
  );

  return (
    <section id="merge" className="is-page">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">06 &mdash; Merge</span>
          <h2>Burn two, advance one.</h2>
          <p className="body">
            Pick two tokens you own at the same level. One burns, the other
            advances to the next divisor.
          </p>
        </div>

        <div className="workspace">
          {renderSlot(survivor, 'survivor', 'survivor')}
          <div className="op">+</div>
          {renderSlot(burn, 'burn token', 'burn')}
          <div className="op">=</div>
          <div className={`slot${resultSvg ? ' filled' : ''}`}>
            {resultSvg ? (
              <div dangerouslySetInnerHTML={{ __html: resultSvg }} />
            ) : (
              <div className="placeholder">Result preview</div>
            )}
          </div>
        </div>

        <div className="controls">
          <label className="swap-row">
            <input
              type="checkbox"
              checked={swap}
              onChange={(e) => setSwap(e.target.checked)}
            />
            Copy the 2nd token&rsquo;s visual DNA onto the child
          </label>

          <button
            className="merge-btn"
            disabled={!isConnected || !hasContract || !isValidPair || status === 'confirming' || status === 'pending'}
            onClick={handleMerge}
          >
            MERGE
          </button>
        </div>

        <StatusMessage text={statusText} tone={statusTone as 'ok' | 'err' | ''} />

        {/* Inline picker hint when a slot is clicked */}
        {pickerSlot && (
          <div style={{ marginTop: 16 }}>
            <p className="body">
              Select a token from your{' '}
              <a
                href="/profile"
                onClick={(e) => {
                  e.preventDefault();
                  setPickerSlot(null);
                }}
                style={{ textDecoration: 'underline', color: 'var(--text)' }}
              >
                profile
              </a>{' '}
              to set as the {pickerSlot}. Or use the token picker modal below.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
