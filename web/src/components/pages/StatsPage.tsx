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

/** The M logomark SVG paths from the contract, used in the mega row icon. */
const MEGA_DOT_SVG = `<svg class="megadot-icon" viewBox="0 0 105 105" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="52.5" cy="52.5" r="50" fill="#DFD9D9"/>
  <path d="M62.7534 81.6321C65.9781 81.6321 68.5825 79.0297 68.5825 75.8195C68.5825 72.6093 65.9781 70.0068 62.7534 70.0068C59.5536 70.0068 56.9492 72.6093 56.9492 75.8195C56.9492 79.0297 59.5536 81.6321 62.7534 81.6321Z" fill="#19191A"/>
  <path d="M41.8648 81.805C45.0894 81.805 47.6693 79.2026 47.6693 75.9923C47.6693 72.7821 45.0894 70.1797 41.8648 70.1797C38.665 70.1797 36.0605 72.7821 36.0605 75.9923C36.0605 79.2026 38.665 81.805 41.8648 81.805Z" fill="#19191A"/>
  <path d="M29.1376 21.0791H42.9855C45.5913 28.1286 52.3911 48.1021 52.8874 49.215C53.0115 48.6586 59.8608 26.8919 61.7966 21.2028H76.1904V70.8582C74.4036 69.8687 72.6166 68.8795 70.6809 67.7662C69.3407 67.0863 68.1 66.344 66.7351 65.7875C66.611 56.1409 66.487 46.5561 66.1892 36.5385C64.2535 42.2894 57.5776 62.5721 57.0316 63.1286H48.1225C48.1225 63.1286 39.4613 38.5172 39.0394 37.4042C38.9154 46.8653 38.7913 56.3264 38.4687 66.0968C33.1579 68.8175 30.0063 70.3635 29.0137 70.7344V21.0791H29.1376Z" fill="#19191A"/>
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
          <p className="body">
            Read directly from MegaETH. Updates whenever someone mints, merges, or
            burns.
          </p>
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
