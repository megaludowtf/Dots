import { useState, useMemo, useCallback } from 'react';
import { useEventCache } from '@/hooks/useEventCache';
import { ScrollSentinel } from '@/components/shared/ScrollSentinel';
import { fmtWhen, shortHash } from '@/lib/format';
import { ACTIVE_CHAIN } from '@/config/chains';
import { useLineage } from '@/contexts/LineageContext';
import { TokenDetailModal } from '@/components/modals/TokenDetailModal';
import type { NormalisedEvent } from '@/lib/tokenUtils';
// @ts-ignore
import { renderSVG } from '@/art/art';

const PAGE_SIZE = 30;

type FilterKind = 'all' | 'mint' | 'merge' | 'infinity' | 'burn';

const FILTERS: { label: string; value: FilterKind }[] = [
  { label: 'All', value: 'all' },
  { label: 'Mint', value: 'mint' },
  { label: 'Merge', value: 'merge' },
  { label: 'Infinity', value: 'infinity' },
  { label: 'Burn', value: 'burn' },
];

function renderThumbSvg(
  event: NormalisedEvent,
  mintedBy: Map<string, { seed: number }>,
): string | null {
  try {
    const args = event.args as any;
    if (event.kind === 'mint') {
      return renderSVG({ seed: Number(args.seed ?? 0), divisorIndex: 0, merges: [], isMega: 0 });
    }
    if (event.kind === 'merge') {
      // Look up the survivor's actual seed so each merge renders uniquely.
      const sid = String(args.survivorId ?? 0);
      const mint = mintedBy.get(sid);
      const seed = mint ? mint.seed : 0;
      return renderSVG({
        seed,
        divisorIndex: Number(args.newDivisorIndex ?? 1),
        merges: [],
        isMega: 0,
      });
    }
    if (event.kind === 'infinity') {
      return renderSVG({ seed: 0, divisorIndex: 7, merges: [], isMega: 1 });
    }
  } catch {
    // fall through
  }
  return null;
}

function eventHeadline(event: NormalisedEvent): string {
  const args = event.args as any;
  switch (event.kind) {
    case 'mint':
      return `Minted #${args.tokenId}`;
    case 'merge':
      return `Merged #${args.survivorId} + #${args.burnedId}`;
    case 'burn':
      return `Burned #${args.tokenId}`;
    case 'infinity':
      return `Infinity #${args.megaDotId}`;
    default:
      return 'Event';
  }
}

function eventTokenIds(event: NormalisedEvent): string {
  const args = event.args as any;
  switch (event.kind) {
    case 'mint':
      return `#${args.tokenId}`;
    case 'merge':
      return `#${args.survivorId} + #${args.burnedId}`;
    case 'burn':
      return `#${args.tokenId}`;
    case 'infinity':
      return `#${args.megaDotId}`;
    default:
      return '';
  }
}

export function TimelinePage() {
  const { events, blockTs, mintedBy, isLoading } = useEventCache();
  const { open: openLineage } = useLineage();
  const [filter, setFilter] = useState<FilterKind>('all');
  const [detailToken, setDetailToken] = useState<any>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    if (!events) return [];
    if (filter === 'all') return events;
    return events.filter((e) => e.kind === filter);
  }, [events, filter]);

  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const hasMore = visibleCount < filtered.length;

  const loadMore = useCallback(() => {
    setVisibleCount((c) => c + PAGE_SIZE);
  }, []);

  return (
    <>
    <section id="timeline" className="is-page">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">04 &mdash; Timeline</span>
          <h2>Onchain history.</h2>
        </div>

        <div className="timeline-toolbar">
          <span className="timeline-count">
            {filtered.length} event{filtered.length !== 1 ? 's' : ''}
          </span>
          <div className="timeline-filter">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                className={filter === f.value ? 'active' : ''}
                onClick={() => {
                  setFilter(f.value);
                  setVisibleCount(PAGE_SIZE);
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading && events.length === 0 ? (
          <div className="tl-empty">syncing...</div>
        ) : visible.length === 0 ? (
          <div className="tl-empty">No events yet</div>
        ) : (
          <ol className="timeline-feed">
            {visible.map((event, i) => {
              const thumbSvg = renderThumbSvg(event, mintedBy);
              const kindClass = `tl-${event.kind}`;
              const ts = blockTs.get(event.block);
              const args = event.args as any;
              const lineageId = event.kind === 'mint' ? args.tokenId?.toString()
                : event.kind === 'merge' ? args.survivorId?.toString()
                : event.kind === 'infinity' ? args.megaDotId?.toString()
                : null;
              return (
                <li
                  key={`${event.tx}-${event.logIndex}`}
                  className={`tl-entry tl-entry-clickable ${kindClass}`}
                  onClick={() => {
                    if (!lineageId) return;
                    const mint = mintedBy.get(lineageId);
                    if (mint) {
                      const mergeList = (event as any).kind === 'merge' ? Number((event.args as any).newDivisorIndex ?? 0) : 0;
                      setDetailToken({
                        id: Number(lineageId),
                        seed: mint.seed,
                        divisorIndex: event.kind === 'merge' ? Number((event.args as any).newDivisorIndex ?? 0) : event.kind === 'infinity' ? 7 : 0,
                        isMega: event.kind === 'infinity' ? 1 : 0,
                      });
                    }
                  }}
                  style={{ cursor: lineageId ? 'pointer' : 'default' }}
                >
                  <span className="tl-dot" />
                  <div className="tl-thumb">
                    {thumbSvg ? (
                      <div dangerouslySetInnerHTML={{ __html: thumbSvg }} />
                    ) : (
                      <div className="tl-thumb-burned">
                        <span>{event.kind === 'burn' ? 'BURNED' : '?'}</span>
                      </div>
                    )}
                  </div>
                  <div className="tl-row">
                    <div>
                      <div className="tl-head">{eventHeadline(event)}</div>
                      <div className="tl-sub">
                        {event.kind.toUpperCase()} &middot; {eventTokenIds(event)}
                      </div>
                    </div>
                    <div className="tl-meta">
                      <span className="tl-when">
                        {ts !== undefined ? fmtWhen(ts) : ''}
                      </span>
                      <a
                        className="tl-tx"
                        href={`${ACTIVE_CHAIN.blockExplorers.default.url}/tx/${event.tx}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {shortHash(event.tx)}
                      </a>
                    </div>
                  </div>
                </li>
              );
            })}

            {hasMore ? (
              <li className="tl-sentinel">
                <ScrollSentinel onIntersect={loadMore} />
                Loading more...
              </li>
            ) : visible.length > 0 ? (
              <li className="tl-end">End of timeline</li>
            ) : null}
          </ol>
        )}
      </div>
    </section>

    <TokenDetailModal token={detailToken} onClose={() => setDetailToken(null)} />
    </>
  );
}
