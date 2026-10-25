'use client';

import * as React from 'react';
import { CultMark } from '@/components/store/cult-mark';

/** A short first-visit brand reveal before the homepage is shown. */
export function HomepageIntro() {
  const [visible, setVisible] = React.useState(true);
  const previousOverflow = React.useRef('');

  React.useEffect(() => {
    try {
      if (sessionStorage.getItem('cult-home-intro-seen') === '1') {
        setVisible(false);
        return;
      }
    } catch { /* Private browsing may block storage. */ }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    previousOverflow.current = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => {
      setVisible(false);
      document.body.style.overflow = previousOverflow.current;
      try { sessionStorage.setItem('cult-home-intro-seen', '1'); } catch { /* Optional. */ }
    }, reducedMotion ? 800 : 4200);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow.current;
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="cult-intro fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-[#080809] text-white" role="status" aria-label="CULT Clothing is loading">
      <div className="cult-intro-grid absolute inset-0" aria-hidden />
      <span className="cult-intro-vertical absolute left-5 top-6 text-[10px] uppercase tracking-[0.4em] text-white/40 md:left-10 md:top-10">CULT / 001</span>
      <div className="relative w-full px-5 text-center">
        <div className="cult-intro-line cult-intro-line-one">Your wardrobe&apos;s</div>
        <div className="cult-intro-line cult-intro-line-two">next obsession</div>
        <div className="cult-intro-mark absolute inset-0 flex items-center justify-center">
          <CultMark inverted className="text-[clamp(5rem,21vw,16rem)]" />
        </div>
      </div>
      <div className="cult-intro-progress absolute bottom-0 left-0 h-1 bg-[#d4261e]" aria-hidden />
      <button type="button" onClick={() => {
        setVisible(false);
        document.body.style.overflow = previousOverflow.current;
        try { sessionStorage.setItem('cult-home-intro-seen', '1'); } catch { /* Optional. */ }
      }} className="absolute bottom-8 right-5 text-[10px] uppercase tracking-[0.3em] text-white/60 hover:text-white md:right-10">
        Skip intro
      </button>
    </div>
  );
}
