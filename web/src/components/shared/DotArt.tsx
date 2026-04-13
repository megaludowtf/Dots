import { useMemo } from 'react';
import { renderSVG } from '../../art/art';

interface DotArtProps {
  check: {
    seed: number;
    divisorIndex: number;
    merges?: number[];
    isMega?: number;
    colorBandIdx?: number;
    gradientIdx?: number;
    direction?: number;
    speed?: number;
  };
  className?: string;
}

export function DotArt({ check, className }: DotArtProps) {
  const svg = useMemo(() => renderSVG(check), [check]);
  return (
    <div
      className={className ?? 'art'}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
