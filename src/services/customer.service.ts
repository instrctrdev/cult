import 'server-only';
import { randomBytes, createHash } from 'crypto';
import { Prisma, Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { badRequest, conflict, notFound } from '@/lib/errors';
import { hashPassword, verifyPassword, dummyVerify } from '@/lib/auth/password';
import type { AddressSnapshot } from '@/types';

const RESET_TTL_MINUTES = 30;

export const CustomerService = {
  async register(input: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    phone: string;
  }) {
    const email = input.email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) throw conflict('An account with this email already exists.');

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(input.password),
        firstName: input.firstName?.trim() || null,
        lastName: input.lastName?.trim() || null,
        phone: input.phone?.replace(/\D/g, '').slice(-10) || null,
        role: Role.CUSTOMER,
        wishlist: { create: {} },
      },
      select: { id: true, email: true, role: true, firstName: true, lastName: true },
    });

    await this.claimGuestOrders(user.id, user.email);
    return user;
  },

  /**
   * Verifies credentials. The dummy hash comparison on a missing account keeps
   * response time flat so accounts cannot be enumerated by timing.
   */
  async authenticate(email: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true, email: true, role: true, passwordHash: true, isActive: true, deletedAt: true, firstName: true, lastName: true },
    });

    if (!user || user.deletedAt || !user.isActive) {
      await dummyVerify();
      return null;
    }
    if (!(await verifyPassword(password, user.passwordHash))) return null;

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.claimGuestOrders(user.id, user.email);
    return { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName };
  },

  /**
   * Connects previous guest orders to a customer account once the customer
   * proves ownership of that email through our own login/register flow.
   *
   * Cashfree's phone login is not the same thing as a CULT account session,
   * so we only claim by email here. Phone-only matching would let an unverified
   * profile phone expose another person's orders.
   */
  async claimGuestOrders(userId: string, email: string): Promise<number> {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return 0;

    return prisma.$transaction(async (tx) => {
      const orders = await tx.order.findMany({
        where: { userId: null, email: normalized },
        select: { id: true },
      });
      if (orders.length === 0) return 0;

      const orderIds = orders.map((order) => order.id);
      await tx.order.updateMany({
        where: { id: { in: orderIds }, userId: null },
        data: { userId },
      });
      await tx.couponUsage.updateMany({
        where: { orderId: { in: orderIds }, userId: null },
        data: { userId },
      });

      return orderIds.length;
    });
  },

  /**
   * Issues a reset token. Only the SHA-256 hash is stored, so a database leak
   * does not hand out working reset links.
   */
  async createPasswordResetToken(email: string): Promise<string | null> {
    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true, deletedAt: true, isActive: true },
    });
    if (!user || user.deletedAt || !user.isActive) return null;

    const token = randomBytes(32).toString('hex');
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: createHash('sha256').update(token).digest('hex'),
        expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60_000),
      },
    });
    return token;
  },

  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!record || record.usedAt || record.expiresAt < new Date()) return false;

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash: await hashPassword(newPassword) },
      }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      // Changing a password invalidates every existing session.
      prisma.session.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    return true;
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
    if (!user) throw notFound('Account not found.');
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      throw badRequest('Your current password is not correct.');
    }
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(newPassword) },
    });
  },

  async getProfile(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, firstName: true, lastName: true, phone: true, createdAt: true,
        _count: { select: { orders: true } },
      },
    });
  },

  async updateProfile(
    userId: string,
    data: { firstName?: string; lastName?: string; phone?: string },
  ) {
    const phone = data.phone?.replace(/\D/g, '').slice(-10) || null;

    return prisma.user.update({
      where: { id: userId },
      data: {
        firstName: data.firstName?.trim() || null,
        lastName: data.lastName?.trim() || null,
        phone,
      },
      select: { id: true, firstName: true, lastName: true, phone: true },
    });
  },

  // ─────────────────────────── Address book ────────────────────────────

  async listAddresses(userId: string) {
    return prisma.address.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });
  },

  async addAddress(userId: string, data: AddressSnapshot & { isDefault?: boolean }) {
    return prisma.$transaction(async (tx) => {
      const count = await tx.address.count({ where: { userId, deletedAt: null } });
      const makeDefault = data.isDefault || count === 0;
      if (makeDefault) {
        await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      }
      return tx.address.create({
        data: {
          userId,
          fullName: data.fullName,
          phone: data.phone,
          email: data.email ?? null,
          line1: data.line1,
          line2: data.line2 ?? null,
          landmark: data.landmark ?? null,
          city: data.city,
          state: data.state,
          pincode: data.pincode,
          country: data.country || 'India',
          isDefault: makeDefault,
        },
      });
    });
  },

  async updateAddress(userId: string, addressId: string, data: Partial<AddressSnapshot> & { isDefault?: boolean }) {
    const owned = await prisma.address.findFirst({ where: { id: addressId, userId, deletedAt: null } });
    if (!owned) throw notFound('Address not found.');

    return prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      }
      return tx.address.update({
        where: { id: addressId },
        data: {
          ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
          ...(data.phone !== undefined ? { phone: data.phone } : {}),
          ...(data.line1 !== undefined ? { line1: data.line1 } : {}),
          ...(data.line2 !== undefined ? { line2: data.line2 } : {}),
          ...(data.landmark !== undefined ? { landmark: data.landmark } : {}),
          ...(data.city !== undefined ? { city: data.city } : {}),
          ...(data.state !== undefined ? { state: data.state } : {}),
          ...(data.pincode !== undefined ? { pincode: data.pincode } : {}),
          ...(data.isDefault !== undefined ? { isDefault: data.isDefault } : {}),
        },
      });
    });
  },

  /** Soft delete — historic orders still reference the row. */
  async deleteAddress(userId: string, addressId: string) {
    const owned = await prisma.address.findFirst({ where: { id: addressId, userId, deletedAt: null } });
    if (!owned) throw notFound('Address not found.');
    await prisma.address.update({ where: { id: addressId }, data: { deletedAt: new Date(), isDefault: false } });
  },

  // ───────────────────────────── Admin list ─────────────────────────────

  async listCustomers(params: { page?: number; perPage?: number; search?: string }) {
    const page = Math.max(1, params.page ?? 1);
    const perPage = Math.min(100, params.perPage ?? 20);
    const where: Prisma.UserWhereInput = {
      role: Role.CUSTOMER,
      deletedAt: null,
      ...(params.search
        ? {
            OR: [
              { email: { contains: params.search } },
              { firstName: { contains: params.search } },
              { lastName: { contains: params.search } },
              { phone: { contains: params.search } },
            ],
          }
        : {}),
    };

    const [total, data] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        select: {
          id: true, email: true, firstName: true, lastName: true, phone: true, createdAt: true, isActive: true,
          _count: { select: { orders: true } },
        },
      }),
    ]);

    return { data, total, page, perPage, totalPages: Math.max(1, Math.ceil(total / perPage)) };
  },
};
