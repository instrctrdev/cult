/**
 * Homepage artwork importer.
 *
 *   npm run import:home-art            # optimise assets/ → public/images/home/
 *   npm run import:home-art -- --dry-run
 *
 * Drop campaign files into `assets/` using the naming below and re-run. Files
 * are re-encoded to WebP at sensible widths (the source PNGs are ~2 MB each,
 * which is far too heavy to serve), written to `public/images/home/`, and the
 * matching `HomepageSection` row is pointed at them and switched on.
 *
 * ── Naming ─────────────────────────────────────────────────────────────────
 *   <name>_desk.png | <name>_desktop.png | <name>-desktop.jpg   → 16:9 crop
 *   <name>_mob.png  | <name>_mobile.png  | <name>-mobile.jpg    → 9:16 crop
 *
 * `<name>` is matched against the aliases below, then falls back to the
 * slugified name, so `kurtas_desk.png` lands on the `kurtas` section with no
 * code change.
 *
 * ── Overlay ────────────────────────────────────────────────────────────────
 * CULT campaign artwork may carry its own typography on bright photography,
 * so any section that gets real artwork is set to `textMode: IMAGE` with the
 * darkening overlay switched off. A gradient would only muddy the picture.
 */
import './load-env';
import { readdir, mkdir } from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SOURCE_DIR = path.join(process.cwd(), 'assets');
const OUT_DIR = path.join(process.cwd(), 'public', 'images', 'home');
const PUBLIC_PREFIX = '/images/home';

const DRY_RUN = process.argv.includes('--dry-run');

/** Filename stems that mean the same section. */
const ALIASES: Record<string, string> = {
  fresharrival: 'fresh-arrivals',
  fresharrivals: 'fresh-arrivals',
  newarrival: 'fresh-arrivals',
  newarrivals: 'fresh-arrivals',
  polo: 'polos',
  polos: 'polos',
  shirt: 'shirts',
  shirts: 'shirts',
  tshirt: 't-shirts',
  tshirts: 't-shirts',
  jacket: 'jackets',
  jackets: 'jackets',
  hoodie: 'hoodies',
  hoodies: 'hoodies',
  bottom: 'bottoms',
  bottoms: 'bottoms',
  kurta: 'kurtas',
  kurtas: 'kurtas',
  bestseller: 'best-sellers',
  bestsellers: 'best-sellers',
  sale: 'sale',
  hero: 'hero',
};

/** Human-readable defaults for a section the seed does not know about yet. */
const TITLES: Record<string, { title: string; href: string }> = {
  'fresh-arrivals': { title: 'Fresh Arrivals', href: '/shop?collection=fresh-arrivals' },
  polos: { title: 'Polos', href: '/category/polos' },
  shirts: { title: 'Shirts', href: '/category/shirts' },
  't-shirts': { title: 'T-Shirts', href: '/category/t-shirts' },
  jackets: { title: 'Jackets', href: '/category/jackets' },
  hoodies: { title: 'Hoodies', href: '/category/hoodies' },
  bottoms: { title: 'Bottoms', href: '/category/bottoms' },
  kurtas: { title: 'Kurtas', href: '/category/kurtas' },
  'best-sellers': { title: 'Best Sellers', href: '/shop?collection=best-sellers' },
  sale: { title: 'Sale', href: '/shop?collection=sale' },
  hero: { title: 'The CULT Collection', href: '/shop' },
};

const MAX_WIDTH = { desktop: 2400, mobile: 1200 } as const;

/**
 * Real campaign photography exists for these, but the category has no stock
 * yet — shown as a "Coming Soon" preview rather than a live link.
 */
const COMING_SOON = new Set(['polos', 'jackets', 'hoodies']);

type Variant = 'desktop' | 'mobile';

function parseName(file: string): { key: string; variant: Variant } | null {
  const stem = file.replace(/\.[^.]+$/, '').toLowerCase();

  const match = stem.match(/^(.*?)[-_](desk|desktop|mob|mobile)$/);
  if (!match) return null;

  const variant: Variant = /^(desk|desktop)$/.test(match[2]) ? 'desktop' : 'mobile';
  const raw = match[1].replace(/[^a-z0-9]/g, '');
  const key = ALIASES[raw] ?? raw.replace(/([a-z])([0-9])/g, '$1-$2');

  return { key, variant };
}

async function main() {
  console.log(`▸ Reading ${path.relative(process.cwd(), SOURCE_DIR)}`);

  let files: string[] = [];
  try {
    files = (await readdir(SOURCE_DIR)).filter((f) => /\.(png|jpe?g|webp|avif)$/i.test(f));
  } catch {
    console.log('  ! No assets/ directory. Create it and add campaign artwork.');
    return;
  }
  if (files.length === 0) {
    console.log('  ! No images found in assets/.');
    return;
  }

  await mkdir(OUT_DIR, { recursive: true });

  const bySection = new Map<string, Partial<Record<Variant, string>>>();
  const skipped: string[] = [];

  for (const file of files) {
    const parsed = parseName(file);
    if (!parsed) {
      skipped.push(`${file} — expected "<name>_desk" or "<name>_mob"`);
      continue;
    }

    const src = path.join(SOURCE_DIR, file);
    const outName = `${parsed.key}-${parsed.variant}.webp`;
    const outPath = path.join(OUT_DIR, outName);

    const meta = await sharp(src).metadata();
    const width = Math.min(meta.width ?? MAX_WIDTH[parsed.variant], MAX_WIDTH[parsed.variant]);

    if (!DRY_RUN) {
      await sharp(src)
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 82, effort: 5 })
        .toFile(outPath);
    }

    const before = (await sharp(src).toBuffer()).byteLength;
    const after = DRY_RUN ? before : (await sharp(outPath).toBuffer()).byteLength;

    console.log(
      `  ✓ ${file.padEnd(26)} → ${outName.padEnd(28)} ` +
        `${(before / 1048576).toFixed(2)}MB → ${(after / 1048576).toFixed(2)}MB`,
    );

    const entry = bySection.get(parsed.key) ?? {};
    entry[parsed.variant] = `${PUBLIC_PREFIX}/${outName}`;
    bySection.set(parsed.key, entry);
  }

  if (skipped.length) {
    console.log('\n⚠ Skipped:');
    for (const s of skipped) console.log(`   • ${s}`);
  }

  if (DRY_RUN) {
    console.log('\n▸ DRY RUN — nothing written, database untouched.');
    return;
  }

  // ── Point the sections at the new artwork ────────────────────────────────
  console.log('\n▸ Updating homepage sections');
  let updated = 0;
  let created = 0;

  const maxPosition = await prisma.homepageSection.aggregate({ _max: { position: true } });
  let nextPosition = (maxPosition._max.position ?? -1) + 1;

  for (const [key, art] of bySection) {
    const existing = await prisma.homepageSection.findUnique({ where: { key } });

    const artwork = {
      desktopImage: art.desktop ?? existing?.desktopImage ?? null,
      mobileImage: art.mobile ?? existing?.mobileImage ?? null,
      // The wording lives in the picture, so nothing is drawn over it and the
      // darkening gradient is switched off.
      textMode: 'IMAGE' as const,
      overlayStrength: 0,
      // CULT's campaign lockup sits on the left of the frame. Anchoring the
      // crop left guarantees the headline and "+ SHOP NOW" survive on any
      // viewport whose ratio differs from the file's. Adjustable per section
      // with the focal-point control in Admin → Homepage.
      focalDesktop: 'left center',
      focalMobile: 'left center',
      theme: 'DARK' as const,
      isActive: true,
      comingSoon: COMING_SOON.has(key),
    };

    if (existing) {
      await prisma.homepageSection.update({ where: { key }, data: artwork });
      updated++;
      console.log(`  ✓ ${key} updated${art.mobile ? '' : ' (no mobile crop — landscape reused)'}`);
    } else {
      const meta = TITLES[key] ?? { title: key.replace(/-/g, ' '), href: '/shop' };
      await prisma.homepageSection.create({
        data: {
          key,
          title: meta.title,
          href: meta.href,
          ctaLabel: '+ SHOP NOW',
          imageAlt: `${meta.title} — CULT campaign`,
          position: nextPosition++,
          ...artwork,
        },
      });
      created++;
      console.log(`  + ${key} created → ${meta.href}`);
    }
  }

  console.log(`\n✅ ${updated} updated, ${created} created.`);
  console.log('   Review order and links in Admin → Homepage.\n');
}

main()
  .catch((e) => {
    console.error('\n❌ Artwork import failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
