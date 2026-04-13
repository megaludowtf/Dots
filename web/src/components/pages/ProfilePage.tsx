import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { useOwnedTokens } from '@/hooks/useOwnedTokens';
import { useMerge } from '@/contexts/MergeContext';
import { useLineage } from '@/contexts/LineageContext';
import { shortAddr } from '@/lib/format';
// @ts-ignore
import { glyphCount, renderSVG } from '@/art/art';

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

const GRADIENT_LABELS = ['None', 'Linear', 'Reflected', 'Angled', 'Double Angled', 'Linear Double', 'Linear Z'];
const COLOR_BAND_LABELS = ['Eighty', 'Sixty', 'Forty', 'Twenty', 'Ten', 'Five', 'One'];

const GRADIENT_OPTIONS = [
  { label: 'All', value: 'all' },
  ...GRADIENT_LABELS.map((l, i) => ({ label: l, value: String(i) })),
];

const COLOR_BAND_OPTIONS = [
  { label: 'All', value: 'all' },
  ...COLOR_BAND_LABELS.map((l, i) => ({ label: l, value: String(i) })),
];

const GLYPH_TO_DIVISOR: Record<number, number> = { 80: 0, 40: 1, 20: 2, 10: 3, 5: 4, 4: 5, 1: 6 };

export function ProfilePage() {
  const { address } = useAccount();
  const { tokens, isLoading } = useOwnedTokens();
  const { setSurvivor } = useMerge();
  const { open: openLineage } = useLineage();
  const navigate = useNavigate();

  const [dotsFilter, setDotsFilter] = useState('all');
  const [gradientFilter, setGradientFilter] = useState('all');
  const [bandFilter, setBandFilter] = useState('all');
  const [sort, setSort] = useState<'latest' | 'oldest' | 'level-asc' | 'level-desc'>('latest');

  // Stats breakdown by divisor
  const divisorCounts = useMemo(() => {
    const counts = new Array(8).fill(0);
    if (tokens) {
      tokens.forEach((t: any) => {
        if (t.divisorIndex >= 0 && t.divisorIndex < 8) counts[t.divisorIndex]++;
      });
    }
    return counts;
  }, [tokens]);

  const filtered = useMemo(() => {
    if (!tokens) return [];
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

    // Sort
    if (sort === 'latest') list.sort((a: any, b: any) => b.id - a.id);
    else if (sort === 'oldest') list.sort((a: any, b: any) => a.id - b.id);
    else if (sort === 'level-asc') list.sort((a: any, b: any) => a.divisorIndex - b.divisorIndex || a.id - b.id);
    else if (sort === 'level-desc') list.sort((a: any, b: any) => b.divisorIndex - a.divisorIndex || b.id - a.id);

    return list;
  }, [tokens, dotsFilter, gradientFilter, bandFilter, sort]);

  const handleMerge = (token: any) => {
    setSurvivor(token);
    navigate('/merge');
  };

  const handleTree = (token: any) => {
    openLineage(token.id);
  };

  return (
    <section id="profile" className="is-page">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">06 &mdash; Profile</span>
          <h2>Your collection.</h2>
        </div>

        <div className="profile-toolbar">
          <div className="profile-addr">
            <span className="profile-label">Address</span>
            <span className="profile-val">{address ? shortAddr(address) : '...'}</span>
          </div>
          <div className="profile-stats">
            <span className="profile-stat">
              Tokens: <strong>{tokens?.length ?? 0}</strong>
            </span>
            {divisorCounts.map((c, d) => (
              c > 0 ? (
                <span key={d} className="profile-stat">
                  {glyphCount(d)}{d === 7 ? ' mega' : ' dots'}: <strong>{c}</strong>
                </span>
              ) : null
            ))}
          </div>
        </div>

        <div className="profile-filters">
          <div className="filter-group">
            <span className="label">Dots</span>
            <select value={dotsFilter} onChange={(e) => setDotsFilter(e.target.value)}>
              {DOTS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <span className="label">Gradient</span>
            <select value={gradientFilter} onChange={(e) => setGradientFilter(e.target.value)}>
              {GRADIENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <span className="label">Color band</span>
            <select value={bandFilter} onChange={(e) => setBandFilter(e.target.value)}>
              {COLOR_BAND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <span className="label">Sort</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as any)}>
              <option value="latest">Latest</option>
              <option value="oldest">Oldest</option>
              <option value="level-asc">Level ↑</option>
              <option value="level-desc">Level ↓</option>
            </select>
          </div>
        </div>

        <div className="profile-grid">
          {isLoading ? (
            <div className="profile-empty">Loading...</div>
          ) : !tokens || tokens.length === 0 ? (
            <div className="profile-empty">No Dots in wallet.</div>
          ) : filtered.length === 0 ? (
            <div className="profile-empty">No tokens match this filter.</div>
          ) : (
            filtered.map((token: any) => {
              const gc = glyphCount(token.divisorIndex);
              return (
                <div
                  key={token.id}
                  className="profile-card"
                  title={`#${token.id} · ${gc} dots · Level ${token.divisorIndex}\nBand: ${COLOR_BAND_LABELS[token.colorBandIdx ?? 0]}\nGradient: ${GRADIENT_LABELS[token.gradientIdx ?? 0]}\nDirection: ${token.direction === 1 ? 'Reverse' : 'Forward'}\nSpeed: ${token.speed ?? 1}`}
                >
                  <div className="art">
                    <div dangerouslySetInnerHTML={{ __html: renderSVG({
                      seed: token.seed,
                      divisorIndex: token.divisorIndex,
                      merges: [],
                      isMega: token.isMega ?? 0,
                    }) }} />
                  </div>
                  <div className="meta">
                    <span className="id">#{token.id}</span>
                    <span className="glyphs">{gc} dots</span>
                  </div>
                  <div className="actions">
                    <a onClick={() => handleTree(token)}>Tree</a>
                    <a onClick={() => handleMerge(token)}>Merge</a>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
