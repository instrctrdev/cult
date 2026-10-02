/** The storefront's main content area. */
export function StoreMain({ children }: { children: React.ReactNode }) {
  return <main id="main" className="flex-1 pb-[var(--bottom-nav-h)]">{children}</main>;
}
