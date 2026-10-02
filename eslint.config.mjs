import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

/**
 * Next.js' recommended rules. `core-web-vitals` is what catches the mistakes
 * that actually hurt this storefront: `<img>` where `next/image` belongs,
 * missing dimensions, and unoptimised fonts.
 */
const config = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    ignores: ['.next/**', 'node_modules/**', 'public/**', 'prisma/migrations/**', 'next-env.d.ts'],
  },
  {
    rules: {
      // Provider interfaces intentionally ignore parameters; `_` marks those.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
    },
  },
];

export default config;
