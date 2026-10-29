'use client';

import * as React from 'react';
import { CultMark } from '@/components/store/cult-mark';

const INTRO_SEEN_KEY = 'cult-home-intro-v2-seen';
const INTRO_DURATION_MS = 7900;

/** A first-visit logo reveal inspired by the supplied black studio intro. */
export function HomepageIntro() {
  const [visible, setVisible] = React.useState(true);
  const previousOverflow = React.useRef('');

  React.useEffect(() => {
    try {
      if (sessionStorage.getItem(INTRO_SEEN_KEY) === '1') {
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
      try { sessionStorage.setItem(INTRO_SEEN_KEY, '1'); } catch { /* Optional. */ }
    }, reducedMotion ? 800 : INTRO_DURATION_MS);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow.current;
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="cult-intro fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-[#080809] text-white" role="status" aria-label="CULT Clothing intro">
      <div className="cult-intro-center relative flex flex-col items-center px-5 text-center">
        <div className="cult-intro-logo relative">
          <CultMark inverted className="text-[clamp(5rem,14vw,11rem)]" />
          <span className="cult-intro-glint" aria-hidden />
        </div>
        <p className="cult-intro-tagline">Dress like you mean it</p>
      </div>
      <button type="button" onClick={() => {
        setVisible(false);
        document.body.style.overflow = previousOverflow.current;
        try { sessionStorage.setItem(INTRO_SEEN_KEY, '1'); } catch { /* Optional. */ }
      }} className="absolute bottom-8 right-5 text-[10px] uppercase tracking-[0.3em] text-white/50 hover:text-white md:right-10">
        Skip intro
      </button>
    </div>
  );
}
