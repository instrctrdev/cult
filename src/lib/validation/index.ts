import { z } from 'zod';

/**
 * Every request body and query string is parsed through one of these before it
 * reaches a service. Nothing downstream re-validates shape.
 */

// ───────────────────────────── Primitives ─────────────────────────────

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(191)
  .email('Enter a valid email address.');

/** Indian mobile numbers: 10 digits starting 6–9, with common prefixes tolerated. */
export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, ''))
  .refine((v) => /^(91)?[6-9]\d{9}$/.test(v), 'Enter a valid 10-digit mobile number.')
  .transform((v) => v.slice(-10));

export const pincodeSchema = z
  .string()
  .trim()
  .regex(/^[1-9][0-9]{5}$/, 'Enter a valid 6-digit PIN code.');

export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(72, 'Password is too long.') // bcrypt truncates beyond 72 bytes
  .refine((v) => /[a-zA-Z]/.test(v) && /[0-9]/.test(v), 'Include at least one letter and one number.');

export const cuidSchema = z.string().min(1).max(64);

// ────────────────────────────── Account ───────────────────────────────

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
  // Required at signup: order tracking, delivery updates and Cashfree's own
  // OCC phone-login all key off this number, so an account without one is
  // missing the one piece of contact info the rest of checkout depends on.
  phone: phoneSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password.').max(72),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().min(32).max(128),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: passwordSchema,
});

export const profileSchema = z.object({
  firstName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
  phone: phoneSchema.optional(),
});

export const addressSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter the recipient name.').max(150),
  phone: phoneSchema,
  email: emailSchema.optional(),
  line1: z.string().trim().min(5, 'Enter the house/flat and street.').max(255),
  line2: z.string().trim().max(255).optional().or(z.literal('')),
  landmark: z.string().trim().max(255).optional().or(z.literal('')),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100),
  pincode: pincodeSchema,
  country: z.string().trim().max(100).default('India'),
  isDefault: z.boolean().optional(),
});

// ──────────────────────────────── Cart ────────────────────────────────

export const addToCartSchema = z.object({
  variantId: cuidSchema,
  quantity: z.coerce.number().int().min(1).max(10).default(1),
});

export const updateCartItemSchema = z.object({
  itemId: cuidSchema,
  quantity: z.coerce.number().int().min(0).max(10),
});

export const couponCodeSchema = z.object({
  code: z.string().trim().min(2).max(64).transform((v) => v.toUpperCase()),
});

// ────────────────────────────── Checkout ──────────────────────────────

export const checkoutSchema = z.object({
  email: emailSchema,
  phone: phoneSchema,
  /**
   * Optional only for a prepaid One Click Checkout order, where Cashfree
   * collects the delivery address itself and we read it back after payment.
   * The route handler enforces that: any other combination without an address
   * is rejected, so a COD order can never be created with nowhere to deliver.
   */
  address: addressSchema.optional(),
  saveAddress: z.boolean().default(false),
  paymentMethod: z.enum(['PREPAID', 'COD']),
  couponCode: z.string().trim().max(64).optional().nullable(),
  customerNote: z.string().trim().max(1000).optional().nullable(),
  /**
   * Required. The server stores it under a unique index, which is what makes
   * a double-tapped "Place order" a no-op instead of two orders.
   */
  idempotencyKey: z.string().uuid('A valid idempotency key is required.'),
});

// ───────────────────────────── Listing ────────────────────────────────

export const sortSchema = z.enum(['featured', 'newest', 'price-asc', 'price-desc', 'discount', 'name-asc']);

/** Query-string parser for the shop/category pages. */
export const collectionSchema = z.enum(['fresh-arrivals', 'best-sellers', 'sale', 'featured']);

export const productQuerySchema = z.object({
  collection: collectionSchema.optional(),
  category: z.string().trim().max(200).optional(),
  size: z.string().trim().max(200).optional(),
  color: z.string().trim().max(200).optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  inStock: z.enum(['1', 'true']).optional(),
  onSale: z.enum(['1', 'true']).optional(),
  q: z.string().trim().max(100).optional(),
  sort: sortSchema.optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
  perPage: z.coerce.number().int().min(1).max(60).default(12),
});

export const searchSchema = z.object({
  q: z.string().trim().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(20).default(6),
});

// ───────────────────────────── Reviews ────────────────────────────────

export const reviewSchema = z.object({
  productId: cuidSchema,
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(255).optional(),
  body: z.string().trim().max(4000).optional(),
});

export const newsletterSchema = z.object({
  email: emailSchema,
  source: z.string().trim().max(64).optional(),
});

export const trackOrderSchema = z.object({
  orderNumber: z.string().trim().min(4).max(40),
  email: emailSchema,
});

// ─────────────────────────────── Admin ────────────────────────────────

export const adminProductSchema = z.object({
  name: z.string().trim().min(2).max(255),
  slug: z.string().trim().regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers and hyphens.').max(191).optional(),
  subtitle: z.string().trim().max(255).optional().nullable(),
  description: z.string().max(20000).optional().nullable(),
  details: z.array(z.object({ label: z.string().max(100), value: z.string().max(500) })).optional(),
  fabric: z.string().trim().max(150).optional().nullable(),
  fit: z.string().trim().max(100).optional().nullable(),
  sizeChartImage: z.string().trim().max(512).optional().nullable(),
  price: z.coerce.number().min(0).max(10_000_000),
  compareAtPrice: z.coerce.number().min(0).max(10_000_000).optional().nullable(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']),
  categoryIds: z.array(cuidSchema).default([]),
  isFeatured: z.boolean().default(false),
  isNewArrival: z.boolean().default(false),
  isBestSeller: z.boolean().default(false),
  metaTitle: z.string().trim().max(255).optional().nullable(),
  metaDescription: z.string().trim().max(500).optional().nullable(),
});

export const adminVariantSchema = z.object({
  id: cuidSchema.optional(),
  sizeId: cuidSchema.optional().nullable(),
  colorId: cuidSchema.optional().nullable(),
  sku: z.string().trim().min(1).max(100),
  price: z.coerce.number().min(0).max(10_000_000),
  compareAtPrice: z.coerce.number().min(0).max(10_000_000).optional().nullable(),
  quantity: z.coerce.number().int().min(0).max(1_000_000).default(0),
  lowStockThreshold: z.coerce.number().int().min(0).max(1000).default(3),
  weightGrams: z.coerce.number().int().min(0).max(50_000).default(300),
  isActive: z.boolean().default(true),
});

export const adminCategorySchema = z.object({
  name: z.string().trim().min(2).max(150),
  slug: z.string().trim().regex(/^[a-z0-9-]+$/).max(191).optional(),
  description: z.string().max(2000).optional().nullable(),
  parentId: cuidSchema.optional().nullable(),
  imageUrl: z.string().max(512).optional().nullable(),
  position: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
  showInNav: z.boolean().default(false),
  metaTitle: z.string().trim().max(255).optional().nullable(),
  metaDescription: z.string().trim().max(500).optional().nullable(),
});

export const adminCouponSchema = z
  .object({
    code: z.string().trim().min(2).max(64).regex(/^[A-Za-z0-9_-]+$/).transform((v) => v.toUpperCase()),
    description: z.string().trim().max(255).optional().nullable(),
    type: z.enum(['PERCENTAGE', 'FIXED']),
    value: z.coerce.number().min(0).max(1_000_000),
    minOrderAmount: z.coerce.number().min(0).optional().nullable(),
    maxDiscount: z.coerce.number().min(0).optional().nullable(),
    usageLimit: z.coerce.number().int().min(1).optional().nullable(),
    perUserLimit: z.coerce.number().int().min(1).optional().nullable(),
    startsAt: z.coerce.date().optional().nullable(),
    expiresAt: z.coerce.date().optional().nullable(),
    isActive: z.boolean().default(true),
    appliesToSubset: z.boolean().default(false),
    freeShipping: z.boolean().default(false),
    firstOrderOnly: z.boolean().default(false),
    productIds: z.array(cuidSchema).default([]),
    categoryIds: z.array(cuidSchema).default([]),
  })
  .refine((v) => v.type !== 'PERCENTAGE' || v.value <= 100, {
    message: 'A percentage discount cannot exceed 100%.',
    path: ['value'],
  })
  .refine((v) => !v.startsAt || !v.expiresAt || v.expiresAt > v.startsAt, {
    message: 'The end date must be after the start date.',
    path: ['expiresAt'],
  });

export const adminBannerSchema = z.object({
  title: z.string().trim().min(1).max(255),
  subtitle: z.string().trim().max(255).optional().nullable(),
  eyebrow: z.string().trim().max(120).optional().nullable(),
  placement: z.enum(['HOME_HERO', 'HOME_SPLIT', 'HOME_PROMO', 'CATEGORY_TOP', 'ANNOUNCEMENT']),
  desktopImage: z.string().max(512).optional().nullable(),
  mobileImage: z.string().max(512).optional().nullable(),
  videoUrl: z.string().max(512).optional().nullable(),
  ctaLabel: z.string().trim().max(100).optional().nullable(),
  ctaHref: z.string().trim().max(512).optional().nullable(),
  overlay: z.string().trim().max(64).optional().nullable(),
  position: z.coerce.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
  startsAt: z.coerce.date().optional().nullable(),
  endsAt: z.coerce.date().optional().nullable(),
});

/**
 * A homepage band's link. Only internal routes are allowed — an editorial band
 * is site navigation, and permitting arbitrary URLs here would turn the admin
 * into an open redirect.
 */
const internalHrefSchema = z
  .string()
  .trim()
  .min(1, 'Enter a link.')
  .max(512)
  .refine((v) => v.startsWith('/') && !v.startsWith('//'), 'Use an internal path such as /category/shirts.');

/** CSS object-position: "50% 35%", "center top", "left center". */
const focalSchema = z
  .string()
  .trim()
  .max(32)
  .regex(
    /^(\d{1,3}%|left|right|center|top|bottom)\s+(\d{1,3}%|left|right|center|top|bottom)$/i,
    'Use two values, e.g. "50% 35%" or "center top".',
  );

export const adminHomepageSectionSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers and hyphens.'),
  title: z.string().trim().min(1, 'Enter a title.').max(150),
  subtitle: z.string().trim().max(255).optional().nullable(),
  ctaLabel: z.string().trim().max(60).optional().nullable(),
  href: internalHrefSchema,
  desktopImage: z.string().trim().max(512).optional().nullable(),
  mobileImage: z.string().trim().max(512).optional().nullable(),
  videoUrl: z.string().trim().max(512).optional().nullable(),
  imageAlt: z.string().trim().max(255).optional().nullable(),
  focalDesktop: focalSchema.default('50% 50%'),
  focalMobile: focalSchema.default('50% 35%'),
  textMode: z.enum(['IMAGE', 'OVERLAY']).default('IMAGE'),
  textAlign: z.enum(['CENTER', 'BOTTOM_LEFT', 'BOTTOM_CENTER', 'BOTTOM_RIGHT', 'TOP_LEFT']).default('BOTTOM_LEFT'),
  theme: z.enum(['LIGHT', 'DARK']).default('LIGHT'),
  overlayStrength: z.coerce.number().int().min(0).max(80).default(35),
  showProductRail: z.boolean().default(false),
  railSource: z.string().trim().max(100).optional().nullable(),
  priority: z.boolean().default(false),
  comingSoon: z.boolean().default(false),
  isActive: z.boolean().default(true),
  position: z.coerce.number().int().min(0).max(999).default(0),
});

export const adminHomepageReorderSchema = z.object({
  order: z.array(cuidSchema).min(1).max(50),
});

export const adminOrderStatusSchema = z.object({
  status: z.enum([
    'PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY',
    'DELIVERED', 'CANCELLED', 'RETURN_REQUESTED', 'RETURNED', 'REFUNDED',
  ]),
  message: z.string().trim().max(500).optional(),
});

export const adminInventorySchema = z.object({
  variantId: cuidSchema,
  quantity: z.coerce.number().int().min(0).max(1_000_000),
  note: z.string().trim().max(255).optional(),
});

export const adminRefundSchema = z.object({
  amount: z.coerce.number().min(1).max(10_000_000),
  reason: z.string().trim().max(255).optional(),
});

export const adminSettingsSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]));

/** Parses a URLSearchParams through a schema, collapsing repeats to the first value. */
export function parseQuery<T extends z.ZodTypeAny>(schema: T, params: URLSearchParams): z.infer<T> {
  const obj: Record<string, string> = {};
  for (const [k, v] of params.entries()) if (!(k in obj)) obj[k] = v;
  return schema.parse(obj);
}
