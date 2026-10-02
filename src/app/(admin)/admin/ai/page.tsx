import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/session';
import { AiChat } from '@/components/admin/ai-chat';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'AI Assistant' };

export default async function AdminAiPage() {
  await requirePermission('orders.read');

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col space-y-6">
      <header>
        <h1 className="font-serif text-2xl">AI Assistant</h1>
        <p className="mt-1 text-sm text-muted">
          Ask about orders, products, inventory, coupons, customers, or sales. It only reads data — it can&apos;t make changes yet.
        </p>
      </header>

      <AiChat />
    </div>
  );
}
