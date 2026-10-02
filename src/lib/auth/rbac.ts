import { Role } from '@prisma/client';

/** Every guardable capability in the admin panel. */
export type Permission =
  | 'products.read' | 'products.write'
  | 'categories.read' | 'categories.write'
  | 'orders.read' | 'orders.write' | 'orders.refund'
  | 'customers.read' | 'customers.write'
  | 'inventory.read' | 'inventory.write'
  | 'coupons.read' | 'coupons.write'
  | 'banners.read' | 'banners.write'
  | 'reviews.read' | 'reviews.write'
  | 'settings.read' | 'settings.write'
  | 'media.write'
  | 'audit.read'
  | 'admins.manage';

const STAFF: Permission[] = [
  'products.read', 'products.write',
  'categories.read',
  'orders.read', 'orders.write',
  'customers.read',
  'inventory.read', 'inventory.write',
  'coupons.read',
  'banners.read',
  'reviews.read',
  'media.write',
];

const ADMIN: Permission[] = [
  ...STAFF,
  'categories.write',
  'orders.refund',
  'customers.write',
  'coupons.write',
  'banners.write',
  'reviews.write',
  'settings.read', 'settings.write',
  'audit.read',
];

const SUPER_ADMIN: Permission[] = [...ADMIN, 'admins.manage'];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  CUSTOMER: [],
  STAFF,
  ADMIN,
  SUPER_ADMIN,
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** Roles allowed anywhere under /admin. */
export const STAFF_ROLES: Role[] = [Role.STAFF, Role.ADMIN, Role.SUPER_ADMIN];

export function isStaff(role: Role): boolean {
  return STAFF_ROLES.includes(role);
}
