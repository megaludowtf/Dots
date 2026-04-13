import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
// @ts-ignore
import { randomSeed } from '../../art/art';
import { DotArt } from '../shared/DotArt';

export function IntroPage() {
  const [seed, setSeed] = useState(() => randomSeed());
  const [divisor, setDivisor] = useState(0);

  // Auto-cycle through divisor levels every 2.4s.
  useEffect(() => {
    const timer = setInterval(() => {
      setDivisor((d) => {
        if (d >= 7) {
          setSeed(randomSeed());
          return 0;
        }
        return d + 1;
      });
    }, 2400);
    return () => clearInterval(timer);
  }, []);

  const reroll = useCallback(() => {
    setSeed(randomSeed());
    setDivisor(0);
  }, []);

  return (
    <section id="intro" className="is-page">
      <div className="container intro-grid">
        <div className="copy">
          <div className="wordmark">
            <span className="accent-dot pink" />
            <span className="accent-dot green" />
            <span>Dots</span>
          </div>
          <h1>An onchain edition on MegaETH.</h1>
          <p className="body">
            Open mint. Merge dots down from 80 to a single dot, then burn 64 into
            one terminal Mega Dot. All art lives onchain.
          </p>
          <Link to="/mint" className="cta">
            Mint now &rarr;
          </Link>
        </div>
        <div className="art-cage" onClick={reroll} title="Click to reroll">
          <DotArt
            check={{
              seed,
              divisorIndex: divisor,
              merges: [],
              isMega: divisor >= 7 ? 1 : 0,
            }}
          />
        </div>
      </div>
    </section>
  );
}
