import { useRef, useEffect } from 'react';

interface Props {
  onIntersect: () => void;
  rootMargin?: string;
}

export function ScrollSentinel({ onIntersect, rootMargin = '200px' }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onIntersect();
      },
      { rootMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [onIntersect, rootMargin]);

  return <div ref={ref} style={{ height: 1 }} />;
}
