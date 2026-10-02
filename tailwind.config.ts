import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

/**
 * CULT's palette is defined in the storefront's CSS custom
 * properties (see docs/BRAND.md). Colours are declared as CSS variables in
 * globals.css so nothing here invents a new brand colour.
 */
const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: '1rem', sm: '1.5rem', lg: '2rem', '2xl': '2.5rem' },
      screens: { '2xl': '1440px' },
    },
    extend: {
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        sunken: 'rgb(var(--sunken) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        gold: 'rgb(var(--gold) / <alpha-value>)',
        'gold-ink': 'rgb(var(--gold-ink) / <alpha-value>)',
        success: 'rgb(var(--success) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
        line: 'rgb(var(--ink) / 0.10)',
        'line-soft': 'rgb(var(--ink) / 0.06)',
        // Alphas chosen so both clear WCAG AA (4.5:1) against the page
        // background *and* the raised surface tone, not just the lighter one.
        muted: 'rgb(var(--ink) / 0.78)',
        faint: 'rgb(var(--ink) / 0.68)',
      },
      fontFamily: {
        // Cinzel / Cormorant Garamond / DM Sans — the live store's three faces.
        display: ['var(--font-cinzel)', 'Georgia', 'serif'],
        serif: ['var(--font-cormorant)', 'Georgia', 'serif'],
        sans: ['var(--font-dm-sans)', 'system-ui', '-apple-system', 'sans-serif'],
        script: ['var(--font-script)', 'cursive'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.08em' }],
      },
      letterSpacing: { luxe: '0.18em', wide2: '0.12em' },
      borderRadius: { xl: '0.875rem', '2xl': '1.25rem' },
      boxShadow: {
        card: '0 1px 2px rgb(26 26 26 / 0.04), 0 8px 24px -12px rgb(26 26 26 / 0.12)',
        lift: '0 2px 8px rgb(26 26 26 / 0.06), 0 18px 40px -16px rgb(26 26 26 / 0.18)',
        sheet: '0 -8px 40px -12px rgb(26 26 26 / 0.22)',
      },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'none' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'none' } },
        'slide-in-right': { from: { transform: 'translateX(100%)' }, to: { transform: 'none' } },
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
      },
      animation: {
        'fade-up': 'fade-up .5s cubic-bezier(.22,1,.36,1) both',
        'fade-in': 'fade-in .4s ease both',
        'slide-up': 'slide-up .3s cubic-bezier(.22,1,.36,1)',
        'slide-in-right': 'slide-in-right .3s cubic-bezier(.22,1,.36,1)',
        marquee: 'marquee 32s linear infinite',
        shimmer: 'shimmer 1.6s infinite',
        'accordion-down': 'accordion-down .25s ease-out',
        'accordion-up': 'accordion-up .25s ease-out',
      },
    },
  },
  plugins: [animate],
};

export default config;
