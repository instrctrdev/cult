import 'server-only';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { toPaise } from '@/lib/money';

/** Orders that represent real revenue — cancelled ones never count. */
const REVENUE_STATUSES: OrderStatus[] = [
  OrderStatus.CONFIRMED, OrderStatus.PROCESSING, OrderStatus.SHIPPED,
  OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED,
];

export const DashboardService = {
  async overview() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [
      revenueAll, revenueMonth, revenuePrevMonth, revenueToday,
      orderCount, pendingOrders, todayOrders,
      customerCount, productCount, lowStockCount, pendingReviews,
    ] = await Promise.all([
      prisma.order.aggregate({ where: { status: { in: REVENUE_STATUSES } }, _sum: { grandTotal: true }, _count: true }),
      prisma.order.aggregate({ where: { status: { in: REVENUE_STATUSES }, placedAt: { gte: startOfMonth } }, _sum: { grandTotal: true }, _count: true }),
      prisma.order.aggregate({ where: { status: { in: REVENUE_STATUSES }, placedAt: { gte: startOfPrevMonth, lt: startOfMonth } }, _sum: { grandTotal: true } }),
      prisma.order.aggregate({ where: { status: { in: REVENUE_STATUSES }, placedAt: { gte: startOfToday } }, _sum: { grandTotal: true }, _count: true }),
      prisma.order.count(),
      prisma.order.count({ where: { status: { in: [OrderStatus.PENDING, OrderStatus.CONFIRMED] } } }),
      prisma.order.count({ where: { placedAt: { gte: startOfToday } } }),
      prisma.user.count({ where: { role: 'CUSTOMER', deletedAt: null } }),
      prisma.product.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
      prisma.$queryRaw<{ c: bigint }[]>`
        SELECT COUNT(*) AS c FROM Inventory
        WHERE allowBackorder = 0 AND (quantity - reserved) <= lowStockThreshold
      `,
      prisma.review.count({ where: { isApproved: false, deletedAt: null } }),
    ]);

    const monthRevenue = revenueMonth._sum.grandTotal ? toPaise(revenueMonth._sum.grandTotal) : 0;
    const prevRevenue = revenuePrevMonth._sum.grandTotal ? toPaise(revenuePrevMonth._sum.grandTotal) : 0;

    return {
      revenue: {
        allTimePaise: revenueAll._sum.grandTotal ? toPaise(revenueAll._sum.grandTotal) : 0,
        monthPaise: monthRevenue,
        todayPaise: revenueToday._sum.grandTotal ? toPaise(revenueToday._sum.grandTotal) : 0,
        // Null rather than a fabricated 100% when there is no prior month to compare.
        monthChangePercent: prevRevenue > 0 ? Math.round(((monthRevenue - prevRevenue) / prevRevenue) * 100) : null,
      },
      orders: {
        total: orderCount,
        paid: revenueAll._count,
        month: revenueMonth._count,
        today: revenueToday._count,
        pending: pendingOrders,
        todayPlaced: todayOrders,
      },
      customers: customerCount,
      products: productCount,
      lowStock: Number(lowStockCount[0]?.c ?? 0),
      pendingReviews,
    };
  },

  /** Daily revenue for the sales chart. Days with no orders are filled with zero. */
  /**
   * How far shoppers get: viewed a product, put one in the bag, bought it.
   *
   * Each stage counts distinct shoppers, so the numbers are comparable and a
   * rate cannot exceed 100%.
   *
   * The drop between those three is the most actionable number in the store —
   * a healthy shop converts roughly 5-10% of product views into bags, and a
   * far lower figure points at something concrete like a sold-out size rather
   * than at the advertising.
   *
   * Staff are excluded. An admin browsing their own catalogue would otherwise
   * dominate the counts and make the funnel describe us instead of customers.
   */
  async behaviourFunnel(days = 7) {
    const since = new Date();
    since.setDate(since.getDate() - (days - 1));
    since.setHours(0, 0, 0, 0);

    /**
     * A cohort, not three independent counts.
     *
     * Counting each stage separately lets someone who added to a bag without a
     * recorded view inflate the later stage above the earlier one — which is
     * exactly how this first reported 300% conversion. Following the same
     * people through the stages makes a rate above 100% arithmetically
     * impossible, and answers the question actually being asked: of the people
     * who looked, how many went on to buy.
     */
    const [row] = await prisma.$queryRaw<{ views: bigint; carts: bigint; bought: bigint }[]>`
      SELECT
        SUM(viewed) AS views,
        SUM(viewed AND carted) AS carts,
        SUM(viewed AND carted AND bought) AS bought
      FROM (
        SELECT COALESCE(e.userId, e.guestToken) AS person,
               MAX(e.eventType = 'PRODUCT_VIEW') AS viewed,
               MAX(e.eventType = 'ADD_TO_CART') AS carted,
               MAX(e.eventType = 'PURCHASE') AS bought
          FROM CustomerEvent e
          LEFT JOIN User u ON u.id = e.userId
         WHERE e.createdAt >= ${since}
           AND (u.id IS NULL OR u.role = 'CUSTOMER')
           AND COALESCE(e.userId, e.guestToken) IS NOT NULL
         GROUP BY person
      ) AS people
    `;

    const views = Number(row?.views ?? 0);
    const addToCart = Number(row?.carts ?? 0);
    const purchases = Number(row?.bought ?? 0);

    return {
      days,
      views,
      addToCart,
      purchases,
      /** Null rather than 0 when there is nothing to divide by — an unknown rate is not a bad one. */
      viewToCartPercent: views > 0 ? (addToCart / views) * 100 : null,
      cartToPurchasePercent: addToCart > 0 ? (purchases / addToCart) * 100 : null,
    };
  },

  /**
   * Products people looked at, and whether they could actually buy their size.
   *
   * Views against a product with sizes missing is demand the store turned
   * away, which is the difference between a marketing problem and a
   * restocking one.
   */
  async viewedVsStock(days = 7, limit = 6) {
    const since = new Date();
    since.setDate(since.getDate() - (days - 1));
    since.setHours(0, 0, 0, 0);

    const rows = await prisma.$queryRaw<
      { name: string; slug: string; views: bigint; sizes: bigint; inStock: bigint }[]
    >`
      SELECT p.name AS name, p.slug AS slug,
             COUNT(DISTINCT e.id) AS views,
             COUNT(DISTINCT pv.id) AS sizes,
             COUNT(DISTINCT CASE WHEN (i.quantity - i.reserved) > 0 THEN pv.id END) AS inStock
        FROM CustomerEvent e
        JOIN Product p ON p.id = e.productId
        LEFT JOIN User u ON u.id = e.userId
        LEFT JOIN ProductVariant pv ON pv.productId = p.id AND pv.isActive = 1 AND pv.deletedAt IS NULL
        LEFT JOIN Inventory i ON i.variantId = pv.id
       WHERE e.eventType = 'PRODUCT_VIEW'
         AND e.createdAt >= ${since}
         AND (u.id IS NULL OR u.role = 'CUSTOMER')
       GROUP BY p.id
       ORDER BY views DESC
       LIMIT ${limit}
    `;

    return rows.map((r) => ({
      name: r.name,
      slug: r.slug,
      views: Number(r.views),
      sizes: Number(r.sizes),
      inStock: Number(r.inStock),
    }));
  },

  async salesSeries(days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - (days - 1));
    since.setHours(0, 0, 0, 0);

    const rows = await prisma.$queryRaw<{ day: Date; total: Prisma.Decimal; orders: bigint }[]>`
      SELECT DATE(placedAt) AS day, SUM(grandTotal) AS total, COUNT(*) AS orders
        FROM \`Order\`
       WHERE placedAt >= ${since}
         AND status IN ('CONFIRMED','PROCESSING','SHIPPED','OUT_FOR_DELIVERY','DELIVERED')
       GROUP BY DATE(placedAt)
       ORDER BY day ASC
    `;

    const byDay = new Map(
      rows.map((r) => [
        new Date(r.day).toISOString().slice(0, 10),
        { revenuePaise: toPaise(r.total), orders: Number(r.orders) },
      ]),
    );

    return Array.from({ length: days }, (_, i) => {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      return { date: key, ...(byDay.get(key) ?? { revenuePaise: 0, orders: 0 }) };
    });
  },

  async recentOrders(limit = 8) {
    return prisma.order.findMany({
      orderBy: { placedAt: 'desc' },
      take: limit,
      select: {
        id: true, orderNumber: true, status: true, grandTotal: true,
        paymentMethod: true, placedAt: true, email: true,
        addressSnapshot: true,
        _count: { select: { items: true } },
      },
    });
  },

  /** Best-selling products by units, over live revenue orders only. */
  async topProducts(limit = 5) {
    const grouped = await prisma.orderItem.groupBy({
      by: ['productId'],
      where: { order: { status: { in: REVENUE_STATUSES } }, productId: { not: null } },
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: limit,
    });

    const ids = grouped.map((g) => g.productId).filter((id): id is string => Boolean(id));
    if (!ids.length) return [];

    const products = await prisma.product.findMany({
      where: { id: { in: ids } },
      select: {
        id: true, name: true, slug: true,
        images: { orderBy: { position: 'asc' }, take: 1, select: { url: true, isPlaceholder: true } },
      },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    return grouped.flatMap((g) => {
      const p = g.productId ? byId.get(g.productId) : undefined;
      if (!p) return [];
      const img = p.images[0];
      return [{
        id: p.id,
        name: p.name,
        slug: p.slug,
        imageUrl: img && !img.isPlaceholder ? img.url : null,
        unitsSold: g._sum.quantity ?? 0,
        revenuePaise: g._sum.lineTotal ? toPaise(g._sum.lineTotal) : 0,
      }];
    });
  },

  /** Products the admin still needs to finish after the catalogue import. */
  async needsAttention(limit = 10) {
    return prisma.product.findMany({
      where: { deletedAt: null, OR: [{ needsImagery: true }, { needsDescription: true }] },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: { id: true, name: true, slug: true, status: true, needsImagery: true, needsDescription: true },
    });
  },

  async unsettledPayments(limit = 10) {
    return prisma.payment.findMany({
      where: { status: { in: [PaymentStatus.PENDING, PaymentStatus.AUTHORIZED] }, method: 'PREPAID' },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true, amount: true, status: true, createdAt: true,
        order: { select: { id: true, orderNumber: true, email: true } },
      },
    });
  },
};
