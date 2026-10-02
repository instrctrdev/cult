import 'server-only';
import { orderTools } from './order-tools';
import { productTools } from './product-tools';
import { inventoryTools } from './inventory-tools';
import { couponTools } from './coupon-tools';
import { customerTools } from './customer-tools';
import { analyticsTools } from './analytics-tools';
import { categoryTools } from './category-tools';
import { couponWriteTools } from './coupon-write-tools';
import { orderWriteTools } from './order-write-tools';
import { inventoryWriteTools } from './inventory-write-tools';
import { importTools } from './import-tools';
import type { CopilotTool } from '../types';

/**
 * Every tool the copilot can call. Read tools (default risk) run the
 * instant the model calls them. Write tools carry risk: 'write-low' and
 * never execute inline — the orchestration loop pauses on them and the
 * chat UI collects an explicit confirmation before `run` is ever called.
 */
export const ALL_TOOLS: CopilotTool[] = [
  ...orderTools,
  ...productTools,
  ...inventoryTools,
  ...couponTools,
  ...customerTools,
  ...analyticsTools,
  ...categoryTools,
  ...couponWriteTools,
  ...orderWriteTools,
  ...inventoryWriteTools,
  ...importTools,
];

export const TOOLS_BY_NAME = new Map(ALL_TOOLS.map((t) => [t.name, t]));
