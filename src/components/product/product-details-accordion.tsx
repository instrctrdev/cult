'use client';

import * as React from 'react';
import Link from 'next/link';
import * as Accordion from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';
import type { ProductDetailDTO } from '@/types';

/**
 * Description, specifications, shipping and returns.
 *
 * Only sections with real content render — a product the source store left
 * blank shows nothing rather than filler copy.
 */
export function ProductDetailsAccordion({ product }: { product: ProductDetailDTO }) {
  const specs = product.details.filter((d) => d.label && d.value);
  const bullets = product.details.filter((d) => !d.label && d.value);

  const sections = [
    product.description && {
      value: 'description',
      title: 'Description',
      content: (
        <div
          className="prose-sm space-y-3 text-sm leading-relaxed text-muted [&_li]:ml-4 [&_li]:list-disc [&_strong]:text-ink [&_ul]:space-y-1.5"
          // Source HTML comes from the store's own product descriptions.
          dangerouslySetInnerHTML={{ __html: product.description }}
        />
      ),
    },
    (specs.length > 0 || product.fabric || product.fit) && {
      value: 'details',
      title: 'Product details',
      content: (
        <dl className="space-y-2.5 text-sm">
          {product.fabric && <Spec label="Fabric" value={product.fabric} />}
          {product.fit && <Spec label="Fit" value={product.fit} />}
          {specs
            .filter((s) => !/fabric/i.test(s.label))
            .map((s, i) => <Spec key={i} label={s.label} value={s.value} />)}
          {bullets.length > 0 && (
            <ul className="ml-4 mt-3 space-y-1.5 text-muted">
              {bullets.map((b, i) => <li key={i} className="list-disc">{b.value}</li>)}
            </ul>
          )}
        </dl>
      ),
    },
    {
      value: 'shipping',
      title: 'Shipping & delivery',
      content: (
        <div className="space-y-2.5 text-sm text-muted">
          <p>Orders are dispatched from Visakhapatnam and tracked end to end.</p>
          <p>Shipping is calculated at checkout, where cash on delivery is also offered.</p>
          <p>
            Full terms are in our{' '}
            <Link href="/pages/shipping-and-delivery-policy" className="text-ink underline underline-offset-4">
              shipping and delivery policy
            </Link>.
          </p>
        </div>
      ),
    },
    {
      value: 'returns',
      title: 'Returns & exchanges',
      content: (
        <div className="space-y-2.5 text-sm text-muted">
          <p>Returns and exchanges can be requested from your account within 3 days of delivery.</p>
          <p>
            See the{' '}
            <Link href="/pages/return-exchange-policy" className="text-ink underline underline-offset-4">
              return &amp; exchange policy
            </Link>{' '}
            for what qualifies.
          </p>
        </div>
      ),
    },
  ].filter(Boolean) as { value: string; title: string; content: React.ReactNode }[];

  return (
    <Accordion.Root
      type="multiple"
      defaultValue={[sections[0]?.value].filter(Boolean)}
      className="divide-y divide-line border-y border-line"
    >
      {sections.map((section) => (
        <Accordion.Item key={section.value} value={section.value}>
          <Accordion.Header>
            <Accordion.Trigger className="group flex w-full items-center justify-between gap-4 py-4 text-left">
              <span className="font-sans text-sm font-medium uppercase tracking-wide2 text-ink">{section.title}</span>
              <ChevronDown
                className="h-4 w-4 shrink-0 text-muted transition-transform duration-200 group-data-[state=open]:rotate-180"
                aria-hidden
              />
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
            <div className="pb-5">{section.content}</div>
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-28 shrink-0 text-muted">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}
