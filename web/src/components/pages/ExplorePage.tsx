import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveTokens } from '@/hooks/useLiveTokens';
import { useGalleryHydration } from '@/hooks/useGalleryHydration';
import { useMerge } from '@/contexts/MergeContext';
import { ScrollSentinel } from '@/components/shared/ScrollSentinel';
// @ts-ignore
import { glyphCount } from '@/art/art';

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

const GRADIENT_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: 'None', value: '0' },
  { label: 'Linear', value: '1' },
  { label: 'Radial', value: '2' },
  { label: 'Conic', value: '5' },
  { label: 'Stripe', value: '8' },
  { label: 'Checker', value: '9' },
  { label: 'Diamond', value: '10' },
];

const COLOR_BAND_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: 'Eighty', value: '80' },
  { label: 'Sixty', value: '60' },
  { label: 'Forty', value: '40' },
  { label: 'Twenty', value: '20' },
  { label: 'Ten', value: '10' },
  { label: 'Five', value: '5' },
  { label: 'One', value: '1' },
];

const SORT_OPTIONS = [
  { label: 'Latest', value: 'latest' },
  { label: '#Number', value: 'number' },
];

const GLYPH_TO_DIVISOR: Record<number, number> = { 80: 0, 40: 1, 20: 2, 10: 3, 5: 4, 4: 5, 1: 6 };

export function ExplorePage() {
  const { tokens: liveTokens, isLoading } = useLiveTokens();
  const hydrated = useGalleryHydration(liveTokens);
  const { setSurvivor } = useMerge();
  const navigate = useNavigate();

  const [dotsFilter, setDotsFilter] = useState('all');
  const [gradientFilter, setGradientFilter] = useState('all');
  const [bandFilter, setBandFilter] = useState('all');
  const [sortBy, setSortBy] = useState('latest');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Use hydrated tokens (with SVGs) when available, fall back to live tokens.
  const tokens = hydrated.length > 0 ? hydrated : liveTokens;

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
      const bandVal = Number(bandFilter);
      list = list.filter((t: any) => {
        const cb = t.colorBandIdx;
        // Map index to value: COLOR_BANDS = [80,60,40,20,10,5,1]
        const bandMap = [80, 60, 40, 20, 10, 5, 1];
        return bandMap[cb] === bandVal;
      });
    }

    if (sortBy === 'latest') {
      list.sort((a: any, b: any) => b.id - a.id);
    } else {
      list.sort((a: any, b: any) => a.id - b.id);
    }

    return list;
  }, [tokens, dotsFilter, gradientFilter, bandFilter, sortBy]);

  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const hasMore = visibleCount < filtered.length;

  const loadMore = useCallback(() => {
    setVisibleCount((c) => c + PAGE_SIZE);
  }, []);

  const handleCardClick = (token: any) => {
    setSurvivor(token);
    navigate('/merge');
  };

  return (
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
                  >
                    <div className="art">
                      {token.svg ? (
                        <div dangerouslySetInnerHTML={{ __html: token.svg }} />
                      ) : token.fetchStatus === 'fail' ? (
                        <div className="art-fail">?</div>
                      ) : (
                        <div className="art-placeholder" />
                      )}
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
  );
}
