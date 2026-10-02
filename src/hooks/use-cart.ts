'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/toast';
import { track, rupees } from '@/lib/analytics';
import type { CartDTO } from '@/types';

const CART_KEY = ['cart'] as const;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((json as { error?: { message?: string } })?.error?.message ?? 'Something went wrong.');
  }
  return json as T;
}

export function useCart() {
  return useQuery({
    queryKey: CART_KEY,
    queryFn: () => api<CartDTO>('/api/cart'),
    staleTime: 10_000,
  });
}

/**
 * Cart mutations. Server responses always carry the full recomputed cart, so
 * the cache is replaced wholesale rather than patched — the client never
 * derives its own totals.
 */
export function useCartActions() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const commit = (cart: CartDTO) => qc.setQueryData(CART_KEY, cart);
  const onError = (err: Error) => {
    toast({ title: err.message, variant: 'error' });
    void qc.invalidateQueries({ queryKey: CART_KEY });
  };

  const addItem = useMutation({
    mutationFn: (vars: { variantId: string; quantity?: number; meta?: { id: string; name: string; price: number; variant?: string } }) =>
      api<CartDTO>('/api/cart/items', {
        method: 'POST',
        body: JSON.stringify({ variantId: vars.variantId, quantity: vars.quantity ?? 1 }),
      }),
    onSuccess: (cart, vars) => {
      commit(cart);
      toast({ title: 'Added to bag', description: vars.meta?.name, variant: 'success' });
      if (vars.meta) {
        track({
          name: 'add_to_cart',
          item: { ...vars.meta, quantity: vars.quantity ?? 1 },
          value: vars.meta.price * (vars.quantity ?? 1),
        });
      }
    },
    onError,
  });

  const updateItem = useMutation({
    mutationFn: (vars: { itemId: string; quantity: number }) =>
      api<CartDTO>('/api/cart/items', { method: 'PATCH', body: JSON.stringify(vars) }),
    onSuccess: commit,
    onError,
  });

  const removeItem = useMutation({
    mutationFn: (vars: { itemId: string; meta?: { id: string; name: string; price: number } }) =>
      api<CartDTO>(`/api/cart/items?itemId=${encodeURIComponent(vars.itemId)}`, { method: 'DELETE' }),
    onSuccess: (cart, vars) => {
      commit(cart);
      if (vars.meta) {
        track({ name: 'remove_from_cart', item: vars.meta, value: rupees(cart.pricing.subtotalPaise) });
      }
    },
    onError,
  });

  const applyCoupon = useMutation({
    mutationFn: (code: string) =>
      api<CartDTO>('/api/cart/coupon', { method: 'POST', body: JSON.stringify({ code }) }),
    onSuccess: (cart) => {
      commit(cart);
      if (cart.pricing.coupon) {
        toast({ title: `Coupon ${cart.pricing.coupon.code} applied`, variant: 'success' });
        track({
          name: 'select_coupon',
          code: cart.pricing.coupon.code,
          discount: rupees(cart.pricing.coupon.discountPaise),
        });
      }
    },
    onError,
  });

  const removeCoupon = useMutation({
    mutationFn: () => api<CartDTO>('/api/cart/coupon', { method: 'DELETE' }),
    onSuccess: commit,
    onError,
  });

  return { addItem, updateItem, removeItem, applyCoupon, removeCoupon };
}
