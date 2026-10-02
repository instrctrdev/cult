import type {
  OrderStatus, PaymentMethod, PaymentStatus, ShipmentStatus,
  ProductStatus, Role, DiscountType, BannerPlacement,
} from '@prisma/client';

export type {
  OrderStatus, PaymentMethod, PaymentStatus, ShipmentStatus,
  ProductStatus, Role, DiscountType, BannerPlacement,
};

/**
 * Money crossing the server→client boundary is always an integer number of
 * paise, never a float rupee value. Field names carry the unit so a mistake
 * is visible at the call site.
 */
export type Paise = number;

export interface SizeDTO {
  id: string;
  code: string;
  label: string;
}

export interface ColorDTO {
  id: string;
  slug: string;
  name: string;
  hex: string;
}

export interface ProductImageDTO {
  id: string;
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
  blurDataUrl: string | null;
  isPlaceholder: boolean;
  colorId: string | null;
}

/** A product clip. Videos are served as uploaded — no derivatives, no blur. */
export interface ProductVideoDTO {
  id: string;
  url: string;
  posterUrl: string | null;
  alt: string;
}

export interface VariantDTO {
  id: string;
  sku: string;
  size: SizeDTO | null;
  color: ColorDTO | null;
  pricePaise: Paise;
  compareAtPaise: Paise | null;
  /** quantity - reserved. This is what the UI must gate "Add to bag" on. */
  available: number;
  inStock: boolean;
  isLowStock: boolean;
}

/** Shape used by grids and carousels — intentionally small. */
export interface ProductCardDTO {
  id: string;
  slug: string;
  name: string;
  image: ProductImageDTO | null;
  /** Second image, used for the hover/tap image swap the live theme uses. */
  hoverImage: ProductImageDTO | null;
  /** Up to 5, in display order — the card's own scrollable gallery. */
  images: ProductImageDTO[];
  pricePaise: Paise;
  compareAtPaise: Paise | null;
  discountPercent: number | null;
  inStock: boolean;
  sizes: SizeDTO[];
  colors: ColorDTO[];
  isNewArrival: boolean;
  isBestSeller: boolean;
}

export interface ProductDetailDTO extends ProductCardDTO {
  subtitle: string | null;
  description: string | null;
  details: { label: string; value: string }[];
  fabric: string | null;
  fit: string | null;
  sizeChartImage: string | null;
  images: ProductImageDTO[];
  videos: ProductVideoDTO[];
  variants: VariantDTO[];
  categories: { id: string; slug: string; name: string }[];
  metaTitle: string | null;
  metaDescription: string | null;
  rating: { average: number; count: number } | null;
  updatedAt: string;
}

export interface CategoryDTO {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  productCount: number;
  children?: CategoryDTO[];
}

// ───────────────────────────── Cart & pricing ─────────────────────────────

export interface CartLineDTO {
  id: string;
  productId: string;
  variantId: string;
  slug: string;
  name: string;
  variantLabel: string;
  sku: string;
  image: string | null;
  unitPricePaise: Paise;
  compareAtPaise: Paise | null;
  quantity: number;
  /** Stock ceiling for this line right now. */
  maxQuantity: number;
  lineTotalPaise: Paise;
  /** Set when stock changed under the customer — surfaced in the cart UI. */
  issue: 'OUT_OF_STOCK' | 'QUANTITY_REDUCED' | null;
}

export interface PricingBreakdown {
  subtotalPaise: Paise;
  discountPaise: Paise;
  shippingPaise: Paise;
  handlingPaise: Paise;
  codFeePaise: Paise;
  taxPaise: Paise;
  totalPaise: Paise;
  /** Paise still needed to unlock free shipping; 0 when already free. */
  freeShippingRemainingPaise: Paise;
  freeShippingThresholdPaise: Paise;
  /**
   * True when the payment gateway adds shipping and COD charges in its own
   * checkout sheet, so this breakdown genuinely cannot know them. The bag
   * says "calculated at checkout" rather than claiming shipping is free.
   */
  feesAtCheckout: boolean;
  /**
   * The shipping rule as told to the customer.
   *
   * When `feesAtCheckout` is true the gateway does the actual charging, so
   * these numbers are for messaging only and must be kept in step with the
   * gateway's own rules in Admin → Settings.
   */
  shippingPolicy: {
    feePaise: Paise;
    freeThresholdPaise: Paise;
    freeEnabled: boolean;
    /** Delivery is waived on prepaid orders; COD still pays `feePaise`. */
    prepaidFree: boolean;
  };
  /**
   * Shipping this bag is expected to attract. Zero once the free threshold is
   * met. Not part of `totalPaise` when the gateway does the charging — adding
   * it there would send the gateway a total it then charges shipping on top
   * of — but it is what the shopper should see.
   */
  estimatedShippingPaise: Paise;
  /** `totalPaise` plus expected shipping: what the customer will actually pay. */
  estimatedTotalPaise: Paise;
  coupon: AppliedCoupon | null;
}

export interface AppliedCoupon {
  code: string;
  description: string | null;
  discountPaise: Paise;
  freeShipping: boolean;
}

export interface CartDTO {
  id: string;
  lines: CartLineDTO[];
  itemCount: number;
  pricing: PricingBreakdown;
}

// ──────────────────────────────── Orders ─────────────────────────────────

export interface OrderItemDTO {
  id: string;
  /** Stable catalogue id used by Meta/Google product matching. */
  productId?: string | null;
  productName: string;
  variantLabel: string | null;
  sku: string;
  slug: string | null;
  imageUrl: string | null;
  unitPricePaise: Paise;
  quantity: number;
  lineTotalPaise: Paise;
}

export interface OrderDTO {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus | null;
  items: OrderItemDTO[];
  subtotalPaise: Paise;
  discountPaise: Paise;
  shippingPaise: Paise;
  handlingPaise: Paise;
  codFeePaise: Paise;
  taxPaise: Paise;
  totalPaise: Paise;
  couponCode: string | null;
  address: AddressSnapshot | null;
  shipment: ShipmentDTO | null;
  timeline: { status: string; message: string | null; at: string }[];
  canCancel: boolean;
  canReturn: boolean;
  placedAt: string;
}

export interface AddressSnapshot {
  fullName: string;
  phone: string;
  email?: string | null;
  line1: string;
  line2?: string | null;
  landmark?: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export interface ShipmentDTO {
  status: ShipmentStatus;
  awbCode: string | null;
  courierName: string | null;
  trackingUrl: string | null;
  expectedDelivery: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
}

// ──────────────────────────────── Listing ────────────────────────────────

export type SortOption =
  | 'featured' | 'newest' | 'price-asc' | 'price-desc' | 'discount' | 'name-asc';

/** Curated homepage collections that are flags on Product, not categories. */
export type CollectionKey = 'fresh-arrivals' | 'best-sellers' | 'sale' | 'featured';

export interface ProductFilters {
  /** A curated collection (flag-based), as linked from the editorial homepage. */
  collection?: CollectionKey;
  categorySlugs?: string[];
  sizeCodes?: string[];
  colorSlugs?: string[];
  minPricePaise?: number;
  maxPricePaise?: number;
  inStockOnly?: boolean;
  onSaleOnly?: boolean;
  search?: string;
  sort?: SortOption;
  page?: number;
  perPage?: number;
}

export interface FacetOption<T = string> {
  value: T;
  label: string;
  count: number;
  meta?: Record<string, string>;
}

export interface ProductListResult {
  products: ProductCardDTO[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  facets: {
    sizes: FacetOption[];
    colors: FacetOption[];
    categories: FacetOption[];
    priceRangePaise: { min: number; max: number };
  };
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}
