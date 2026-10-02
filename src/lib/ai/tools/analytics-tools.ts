import 'server-only';
import { formatPaise } from '@/lib/money';
import { DashboardService } from '@/services/dashboard.service';
import type { CopilotTool } from '../types';

/** Wraps the exact same DashboardService the Admin → Dashboard page renders from — no separate analytics logic. */
export const analyticsTools: CopilotTool[] = [
  {
    name: 'get_sales_summary',
    description:
      'Store-wide revenue and order counts — today, this month, all time, plus month-over-month change, low stock count, pending reviews. Use for "how\'s the store doing", revenue and average-order-value questions.',
    permission: 'orders.read',
    parameters: { type: 'object', properties: {} },
    run: async () => {
      const o = await DashboardService.overview();
      const avgOrderValue = o.orders.paid > 0 ? Math.round(o.revenue.allTimePaise / o.orders.paid) : 0;
      return {
        revenueToday: formatPaise(o.revenue.todayPaise),
        revenueThisMonth: formatPaise(o.revenue.monthPaise),
        revenueAllTime: formatPaise(o.revenue.allTimePaise),
        monthOverMonthChangePercent: o.revenue.monthChangePercent,
        ordersToday: o.orders.todayPlaced,
        ordersThisMonth: o.orders.month,
        ordersPendingFulfilment: o.orders.pending,
        averageOrderValue: formatPaise(avgOrderValue),
        totalCustomers: o.customers,
        activeProducts: o.products,
        lowStockProductCount: o.lowStock,
        pendingReviews: o.pendingReviews,
      };
    },
  },
  {
    name: 'get_top_products',
    description: 'Best-selling products by units sold, based on confirmed/shipped/delivered orders. Use for "best sellers", "what\'s selling well".',
    permission: 'orders.read',
    parameters: {
      type: 'object',
      properties: { limit: { type: 'number', description: 'Default 5, max 20.' } },
    },
    run: async (args) => {
      const products = await DashboardService.topProducts(Math.min(20, Math.max(1, Number(args.limit) || 5)));
      return {
        products: products.map((p) => ({
          name: p.name,
          slug: p.slug,
          unitsSold: p.unitsSold,
          revenue: formatPaise(p.revenuePaise),
        })),
      };
    },
  },
];
