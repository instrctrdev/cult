'use client';

import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';

/** Calls the logout endpoint so the server-side session is actually revoked. */
export function SignOutButton({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  return (
    <button
      type="button"
      className="w-full text-left"
      onClick={async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        queryClient.clear();
        router.push('/');
        router.refresh();
      }}
    >
      {children}
    </button>
  );
}
