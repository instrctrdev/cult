'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

/** Writes to NewsletterSubscriber — a real endpoint, not a decorative field. */
export function NewsletterForm() {
  const [email, setEmail] = React.useState('');
  const [state, setState] = React.useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [message, setMessage] = React.useState('');

  if (state === 'done') {
    return (
      <p className="flex items-center gap-2 text-sm text-success" role="status">
        <Check className="h-4 w-4" aria-hidden />
        You are on the list.
      </p>
    );
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setState('loading');
        try {
          const res = await fetch('/api/newsletter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, source: 'footer' }),
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(json?.error?.message ?? 'Could not subscribe.');
          setState('done');
        } catch (err) {
          setState('error');
          setMessage(err instanceof Error ? err.message : 'Could not subscribe.');
        }
      }}
      className="space-y-2"
    >
      <label htmlFor="newsletter-email" className="sr-only">Email address</label>
      <Input
        id="newsletter-email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        autoComplete="email"
        invalid={state === 'error'}
        aria-describedby={state === 'error' ? 'newsletter-error' : undefined}
        className="h-11 bg-bg"
      />
      {state === 'error' && (
        <p id="newsletter-error" role="alert" className="text-xs text-danger">{message}</p>
      )}
      <Button type="submit" variant="outline" size="md" full loading={state === 'loading'}>
        Subscribe
      </Button>
    </form>
  );
}
