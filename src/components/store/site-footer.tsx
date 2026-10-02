import Link from 'next/link';
import { Instagram, Mail, Phone } from 'lucide-react';
import { CultMark } from './cult-mark';
import { BRAND, FOOTER_LINKS } from '@/lib/brand';
import { getSettings } from '@/lib/settings';
import { NewsletterForm } from './newsletter-form';

/**
 * Footer mirroring the live site's link groups. No invented claims.
 *
 * Carries the registered business identity on every page. Who is selling, from
 * what address, under what registration is the first thing a shopper checks
 * before paying a store they have not bought from before — and Google's
 * Misrepresentation policy asks for the same transparency before it will show
 * the catalogue at all. Blank fields are omitted rather than printed as empty
 * labels, so a half-filled record never renders as a half-filled address.
 */
export async function SiteFooter() {
  const settings = await getSettings();
  const str = (key: keyof typeof settings) => String(settings[key] ?? '').trim();

  const legalName = str('store.legal_name') || BRAND.legalName;
  const addressLines = [
    str('store.address_line1'),
    str('store.address_line2'),
    [str('store.city'), str('store.state'), str('store.pincode')].filter(Boolean).join(', '),
  ].filter(Boolean);
  const gstin = str('store.gstin');

  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="container py-14 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-4">
            <CultMark className="text-[1.75rem]" />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted text-pretty">{BRAND.description}</p>
            <div className="mt-5 space-y-2.5">
              {BRAND.instagram && <a
                href={BRAND.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-muted transition-colors hover:text-ink"
              >
                <Instagram className="h-4 w-4" aria-hidden />
                Instagram
                <span className="sr-only">(opens in a new tab)</span>
              </a>}
              {BRAND.phoneDisplay && <a href={`tel:${BRAND.phoneDisplay.replace(/\s/g, '')}`} className="flex items-center gap-2 text-sm text-muted transition-colors hover:text-ink">
                <Phone className="h-4 w-4" aria-hidden />
                {BRAND.phoneDisplay}
              </a>}
              {BRAND.email && <a href={`mailto:${BRAND.email}`} className="flex items-center gap-2 text-sm text-muted transition-colors hover:text-ink">
                <Mail className="h-4 w-4" aria-hidden />
                {BRAND.email}
              </a>}
            </div>

            {(addressLines.length > 0 || gstin) && (
              <address className="mt-5 border-t border-line pt-4 text-xs not-italic leading-relaxed text-faint">
                <span className="block font-medium text-muted">{legalName}</span>
                {addressLines.map((line) => (
                  <span key={line} className="block">{line}</span>
                ))}
                {gstin && <span className="mt-1 block">GSTIN: {gstin}</span>}
              </address>
            )}
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-5">
            {Object.entries(FOOTER_LINKS).map(([group, links]) => (
              <nav key={group} aria-label={group}>
                <h2 className="eyebrow mb-3.5">{group}</h2>
                <ul className="space-y-2.5">
                  {links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-sm text-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>

          <div className="lg:col-span-3">
            <h2 className="eyebrow mb-3.5">Stay in the loop</h2>
            <p className="mb-4 text-sm text-muted text-pretty">
              New drops and first access, straight to your inbox.
            </p>
            <NewsletterForm />
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-line pt-6 sm:flex-row sm:items-center">
          <p className="text-xs text-faint">© {new Date().getFullYear()} {BRAND.legalName}. All rights reserved.</p>
          <p className="text-xs text-faint">🇮🇳 India (INR) · English</p>
        </div>
      </div>
    </footer>
  );
}
