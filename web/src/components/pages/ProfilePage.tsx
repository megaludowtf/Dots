import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { useOwnedTokens } from '@/hooks/useOwnedTokens';
import { useMerge } from '@/contexts/MergeContext';
import { useLineage } from '@/contexts/LineageContext';
import { shortAddr } from '@/lib/format';
// @ts-ignore
import { glyphCount } from '@/art/art';

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
      const bandVal = Number(bandFilter);
      const bandMap = [80, 60, 40, 20, 10, 5, 1];
      list = list.filter((t: any) => bandMap[t.colorBandIdx] === bandVal);
    }

    return list;
  }, [tokens, dotsFilter, gradientFilter, bandFilter]);

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
                <div key={token.id} className="profile-card">
                  <div className="art">
                    {token.svg ? (
                      <div dangerouslySetInnerHTML={{ __html: token.svg }} />
                    ) : (
                      <div className="art-placeholder" />
                    )}
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
