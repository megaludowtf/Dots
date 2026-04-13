import { useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useOwnedTokens } from '@/hooks/useOwnedTokens';
// @ts-ignore
import { glyphCount, renderSVG } from '@/art/art';

interface PickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (token: any) => void;
  /** If set, only show tokens at this divisor index. */
  filterDivisor?: number;
  /** Token IDs to exclude from the list. */
  excludeIds?: number[];
}

export function PickerModal({
  open,
  onClose,
  onSelect,
  filterDivisor,
  excludeIds = [],
}: PickerModalProps) {
  const { tokens } = useOwnedTokens();

  // Lock body scroll when open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const eligible = useMemo(() => {
    if (!tokens) return [];
    let list = tokens;
    if (filterDivisor !== undefined) {
      list = list.filter((t: any) => t.divisorIndex === filterDivisor);
    }
    if (excludeIds.length > 0) {
      const set = new Set(excludeIds);
      list = list.filter((t: any) => !set.has(t.id));
    }
    return list;
  }, [tokens, filterDivisor, excludeIds]);

  const handleSelect = useCallback(
    (token: any) => {
      onSelect(token);
      onClose();
    },
    [onSelect, onClose],
  );

  if (!open) return null;

  return createPortal(
    <div className="picker-modal">
      <div className="picker-backdrop" onClick={onClose} />
      <div className="picker-dialog">
        <div className="picker-head">
          <div>
            <div className="picker-eyebrow">Token Picker</div>
            <div className="picker-title">
              Select a token
              {filterDivisor !== undefined
                ? ` (${glyphCount(filterDivisor)} dots)`
                : ''}
            </div>
          </div>
          <button className="picker-close" onClick={onClose}>
            &times;
          </button>
        </div>

        {filterDivisor !== undefined && (
          <div className="picker-hint">
            Showing tokens at level {filterDivisor} ({glyphCount(filterDivisor)} dots)
          </div>
        )}

        <div className="picker-grid">
          {eligible.length === 0 ? (
            <div className="picker-empty">
              No eligible tokens found.
            </div>
          ) : (
            eligible.map((token: any) => {
              const gc = glyphCount(token.divisorIndex);
              let svg: string | null = token.svg ?? null;
              if (!svg) {
                try {
                  svg = renderSVG({
                    seed: token.seed,
                    divisorIndex: token.divisorIndex,
                    merges: [],
                    isMega: token.isMega ?? 0,
                  });
                } catch {
                  // no svg
                }
              }
              return (
                <div
                  key={token.id}
                  className="picker-card"
                  onClick={() => handleSelect(token)}
                >
                  <div className="art">
                    {svg ? (
                      <div dangerouslySetInnerHTML={{ __html: svg }} />
                    ) : (
                      <div className="art-placeholder" />
                    )}
                  </div>
                  <div className="meta">
                    <span className="id">#{token.id}</span>
                    <span className="glyphs">{gc}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
