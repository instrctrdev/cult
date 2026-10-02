'use client';

import * as React from 'react';
import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { publicEnv } from '@/lib/env';

/**
 * Meta Pixel base script — loads the SDK and fires the initial PageView.
 *
 * Separate from `src/lib/analytics/providers.ts`, which only fires
 * *commerce* events (ViewContent, AddToCart, Purchase, …) through `fbq` once
 * this has made it available on `window`. This component's only job is
 * getting `fbq` there in the first place and keeping PageView accurate.
 *
 * NEXT_PUBLIC_META_PIXEL_ID accepts several ids, comma separated. Every one
 * of them is initialised, and because `fbq('track', …)` reports to every
 * initialised pixel, the commerce events reach all of them without knowing
 * this. That is what makes moving between ad accounts safe: the new account
 * starts collecting while the campaign already running on the old one keeps
 * its conversion signal, instead of going dark mid-flight.
 *
 * Inert with no id set, same as every other analytics provider in this app —
 * nothing loads, nothing is sent.
 */
export function MetaPixel() {
  const pixelIds = React.useMemo(
    () =>
      publicEnv.NEXT_PUBLIC_META_PIXEL_ID.split(',')
        .map((id) => id.trim())
        // Digits only: a stray quote or space in an env file would otherwise
        // be initialised as a pixel id and silently collect nothing.
        .filter((id) => /^\d+$/.test(id)),
    [],
  );

  const pathname = usePathname();
  // The base script below fires the first PageView itself; this only
  // covers subsequent client-side navigations, which a single-page app
  // never reloads for.
  const isFirstRender = React.useRef(true);

  React.useEffect(() => {
    if (pixelIds.length === 0) return;
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    window.fbq?.('track', 'PageView');
  }, [pixelIds, pathname]);

  if (pixelIds.length === 0) return null;

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          ${pixelIds
            .map(
              (id) =>
                `fbq('init', '${id}');\n          fbq('set', 'autoConfig', false, '${id}');`,
            )
            .join('\n          ')}
          fbq('track', 'PageView');
        `}
      </Script>
      <noscript>
        {pixelIds.map((id) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={id}
            height="1"
            width="1"
            alt=""
            style={{ display: 'none' }}
            src={`https://www.facebook.com/tr?id=${id}&ev=PageView&noscript=1`}
          />
        ))}
      </noscript>
    </>
  );
}
