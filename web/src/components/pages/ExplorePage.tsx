import { useState, useMemo, useCallback } from 'react';
import { useLiveTokens } from '@/hooks/useLiveTokens';
import { useLineage } from '@/contexts/LineageContext';
import { ScrollSentinel } from '@/components/shared/ScrollSentinel';
import { TokenDetailModal } from '@/components/modals/TokenDetailModal';
import { glyphCount, renderSVG } from '@/art/art';

const PAGE_SIZE = 30;

const DOTS_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: '80', value: '80' },
  { label: '40', value: '40' },
  { label: '20', value: '20' },
  { label: '10', value: '10' },
  { label: '5', value: '5' },
  { label: '4', value: '4' },
  { label: '1', value: '1' },
];

const GRADIENT_LABELS = ['None', 'Linear', 'Double Linear', 'Reflected', 'Double Angled', 'Angled', 'Linear Z'];
const COLOR_BAND_LABELS = ['Eighty', 'Sixty', 'Forty', 'Twenty', 'Ten', 'Five', 'One'];

const GRADIENT_OPTIONS = [
  { label: 'All', value: 'all' },
  ...GRADIENT_LABELS.map((l, i) => ({ label: l, value: String(i) })),
];

const COLOR_BAND_OPTIONS = [
  { label: 'All', value: 'all' },
  ...COLOR_BAND_LABELS.map((l, i) => ({ label: l, value: String(i) })),
];

const SORT_OPTIONS = [
  { label: 'Latest', value: 'latest' },
  { label: 'Oldest', value: 'oldest' },
  { label: 'Level ↑', value: 'level-asc' },
  { label: 'Level ↓', value: 'level-desc' },
];

const GLYPH_TO_DIVISOR: Record<number, number> = { 80: 0, 40: 1, 20: 2, 10: 3, 5: 4, 4: 5, 1: 6 };

export function ExplorePage() {
  const { tokens: liveTokens, isLoading } = useLiveTokens();
  // Render SVGs client-side from seed + divisorIndex — instant, no RPC calls.
  // Colors may differ slightly from canonical tokenURI (different hash function)
  // but avoids the per-token RPC bottleneck that makes the gallery slow.
  const [dotsFilter, setDotsFilter] = useState('all');
  const [gradientFilter, setGradientFilter] = useState('all');
  const [bandFilter, setBandFilter] = useState('all');
  const [sortBy, setSortBy] = useState('latest');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const tokens = liveTokens;

  const filtered = useMemo(() => {
    let list = [...tokens];

    if (dotsFilter !== 'all') {
      const divisor = GLYPH_TO_DIVISOR[Number(dotsFilter)];
      if (divisor !== undefined) {
        list = list.filter((t: any) => t.divisorIndex === divisor);
      }
    }

    if (gradientFilter !== 'all') {
      list = list.filter((t: any) => t.gradientIdx === Number(gradientFilter));
    }

    if (bandFilter !== 'all') {
      list = list.filter((t: any) => t.colorBandIdx === Number(bandFilter));
    }

    if (sortBy === 'latest') list.sort((a: any, b: any) => b.id - a.id);
    else if (sortBy === 'oldest') list.sort((a: any, b: any) => a.id - b.id);
    else if (sortBy === 'level-asc') list.sort((a: any, b: any) => a.divisorIndex - b.divisorIndex || a.id - b.id);
    else if (sortBy === 'level-desc') list.sort((a: any, b: any) => b.divisorIndex - a.divisorIndex || b.id - a.id);

    return list;
  }, [tokens, dotsFilter, gradientFilter, bandFilter, sortBy]);

  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const hasMore = visibleCount < filtered.length;

  const loadMore = useCallback(() => {
    setVisibleCount((c) => c + PAGE_SIZE);
  }, []);

  const { open: openLineage } = useLineage();
  const [detailToken, setDetailToken] = useState<any>(null);

  const handleCardClick = (token: any) => {
    setDetailToken(token);
  };

  return (
    <>
    <section id="explore" className="is-page">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">05 &mdash; Explore</span>
          <h2>Every dot, onchain.</h2>
        </div>

        <div className="toolbar">
          <span className="count">{filtered.length} tokens</span>
          <div className="filters">
            <div className="filter-group">
              <span className="label">Dots</span>
              <select
                value={dotsFilter}
                onChange={(e) => { setDotsFilter(e.target.value); setVisibleCount(PAGE_SIZE); }}
              >
                {DOTS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <span className="label">Gradient</span>
              <select
                value={gradientFilter}
                onChange={(e) => { setGradientFilter(e.target.value); setVisibleCount(PAGE_SIZE); }}
              >
                {GRADIENT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <span className="label">Color band</span>
              <select
                value={bandFilter}
                onChange={(e) => { setBandFilter(e.target.value); setVisibleCount(PAGE_SIZE); }}
              >
                {COLOR_BAND_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <span className="label">Sort</span>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="gallery">
          {tokens.length === 0 ? (
            <div className="empty">No tokens minted yet</div>
          ) : visible.length === 0 ? (
            <div className="empty">No tokens match this filter</div>
          ) : (
            <>
              {visible.map((token: any) => {
                const gc = glyphCount(token.divisorIndex);
                return (
                  <div
                    key={token.id}
                    className="token"
                    onClick={() => handleCardClick(token)}
                    title={`#${token.id} · ${gc} dots · Level ${token.divisorIndex}\nBand: ${COLOR_BAND_LABELS[token.colorBandIdx ?? 0]}\nGradient: ${GRADIENT_LABELS[token.gradientIdx ?? 0]}\nShift: ${token.direction === 1 ? 'UV' : 'IR'}\nSpeed: ${token.speed === 1 ? '2x' : token.speed === 2 ? '1x' : '0.5x'}`}
                  >
                    <div className="art">
                      <div dangerouslySetInnerHTML={{ __html: renderSVG({
                        seed: token.seed,
                        divisorIndex: token.divisorIndex,
                        merges: [],
                        isMega: token.isMega,
                      }) }} />
                    </div>
                    <div className="meta">
                      <span className="id">#{token.id}</span>
                      <span className="glyphs">{gc} dots</span>
                    </div>
                  </div>
                );
              })}

              {hasMore ? (
                <div className="gallery-sentinel">
                  <ScrollSentinel onIntersect={loadMore} />
                  Loading more...
                </div>
              ) : (
                <div className="gallery-end">
                  {filtered.length} token{filtered.length !== 1 ? 's' : ''}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>

    <TokenDetailModal token={detailToken} onClose={() => setDetailToken(null)} />
    </>
  );
}
