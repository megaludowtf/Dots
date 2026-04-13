import { useState, useMemo } from 'react';
import { useMerge } from '@/contexts/MergeContext';
import { useMergeAction } from '@/hooks/useMergeAction';
import { StatusMessage } from '@/components/shared/StatusMessage';
import { PickerModal } from '@/components/modals/PickerModal';
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
    if (survivor.divisorIndex >= 6) return false;
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

  // When merge succeeds, clear slots
  if (status === 'success' && survivor) {
    clear();
  }

  const statusText = (() => {
    if (status === 'confirming') return 'Confirm in wallet…';
    if (status === 'pending') return `Submitted ${txHash?.slice(0, 10)}… waiting`;
    if (status === 'success') return 'Merged!';
    if (status === 'error') return error?.message ?? 'Transaction failed';
    if (survivor && burn) {
      if (survivor.id === burn.id) return 'Survivor and burn must be different tokens.';
      if (survivor.divisorIndex !== burn.divisorIndex) return 'Both tokens must share the same level.';
      if (survivor.divisorIndex >= 6) return 'Cannot merge past level 5. Use infinity() for the Mega Dot.';
      if (isValidPair) return `Ready to merge. Survivor advances to ${glyphCount(survivor.divisorIndex + 1)} dots.`;
    }
    return '';
  })();

  const statusTone = status === 'success' ? 'ok' : (status === 'error' || (survivor && burn && !isValidPair)) ? 'err' : '';

  // Picker filter: if other slot is filled, restrict to same divisor
  const otherSlot = pickerSlot === 'survivor' ? burn : survivor;
  const filterDivisor = otherSlot ? otherSlot.divisorIndex : undefined;
  const excludeIds = [survivor?.id, burn?.id].filter((id): id is number => id != null);

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
        <div className="placeholder">Click to pick<br />{label}</div>
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
            Pick two tokens you own at the same level. The first slot survives;
            the second is burned. Advance one step down the ladder.
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
              <div className="placeholder">Merged<br />result preview</div>
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
            <span>Copy the 2nd token&rsquo;s visual DNA onto the child</span>
          </label>

          <button
            className="merge-btn"
            disabled={!isConnected || !hasContract || !isValidPair || status === 'confirming' || status === 'pending'}
            onClick={handleMerge}
          >
            Merge &rarr;
          </button>
        </div>

        <StatusMessage text={statusText} tone={statusTone as 'ok' | 'err' | ''} />
      </div>

      {/* Token picker modal — opens when a slot is clicked */}
      <PickerModal
        open={pickerSlot !== null}
        onClose={() => setPickerSlot(null)}
        onSelect={(token) => {
          if (pickerSlot === 'survivor') setSurvivor(token);
          else if (pickerSlot === 'burn') setBurn(token);
          setPickerSlot(null);
        }}
        filterDivisor={filterDivisor}
        excludeIds={excludeIds}
      />
    </section>
  );
}
