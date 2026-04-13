import { useContractStats } from '@/hooks/useContractStats';
// @ts-ignore
import { glyphCount } from '@/art/art';

const DIVISOR_LABELS: [number, string][] = [
  [0, 'dots'],
  [1, 'dots'],
  [2, 'dots'],
  [3, 'dots'],
  [4, 'dots'],
  [5, 'dots'],
  [6, 'dot'],
  [7, 'mega dot'],
];

/** Bunny SVG icon used in the mega row of the stats table. */
const MEGA_DOT_SVG = `<svg class="megadot-icon" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
  <circle cx="24" cy="24" r="23" fill="#DFD9D9"/>
  <circle cx="18" cy="28.978" r="2" fill="#19191A"/>
  <circle cx="30" cy="28.978" r="2" fill="#19191A"/>
  <path d="M32.974,20.864C34.809,19.36,36,16.462,36,12.978c0-5.131-2.58-9-6-9s-6,3.869-6,9c0,1.903,0.356,3.631,0.977,5.054c-0.325-0.021-0.647-0.054-0.977-0.054s-0.652,0.033-0.977,0.054C23.644,16.609,24,14.881,24,12.978c0-5.131-2.58-9-6-9s-6,3.869-6,9c0,3.484,1.191,6.383,3.026,7.886C10.752,23.834,8,28.626,8,32.978c0,6.683,6.28,11,16,11s16-4.317,16-11C40,28.626,37.248,23.834,32.974,20.864z M30,7.978c0.581,0,2,1.752,2,5s-1.419,5-2,5s-2-1.752-2-5S29.419,7.978,30,7.978z M18,7.978c0.581,0,2,1.752,2,5s-1.419,5-2,5s-2-1.752-2-5S17.419,7.978,18,7.978z M26,39.9v-3.922h2v-4h-8v4h2V39.9c-5.14-0.391-10-2.353-10-6.922c0-4.982,5.353-11,12-11s12,6.018,12,11C36,37.547,31.14,39.509,26,39.9z" fill="#19191A"/>
</svg>`;

export function StatsPage() {
  const { circulation, isLoading, error } = useContractStats();

  const renderCount = (idx: number): string => {
    if (error) return 'Offline';
    if (isLoading || !circulation) return 'syncing...';
    return String(Number(circulation[idx]));
  };

  return (
    <section id="stats" className="is-page">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">02 &mdash; Stats</span>
          <h2>Live from the contract.</h2>
        </div>

        <div className="circulation">
          <div className="circulation-head">
            <span className="label">Circulation by level</span>
            <span className="sub">Live</span>
          </div>
          <div className="circulation-grid">
            {DIVISOR_LABELS.map(([d, label]) => {
              const gc = glyphCount(d);
              const isMega = d === 7;
              return (
                <div
                  key={d}
                  className={`circ-cell${isMega ? ' mega' : ''}`}
                >
                  <span className="glyphs">
                    {isMega ? (
                      <span
                        className="megadot-icon"
                        dangerouslySetInnerHTML={{ __html: MEGA_DOT_SVG }}
                      />
                    ) : (
                      gc
                    )}
                  </span>
                  <span className="hint">{label}</span>
                  <span className="count">{renderCount(d)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
