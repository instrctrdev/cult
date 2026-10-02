import 'server-only';
import type { Permission } from '@/lib/auth/rbac';
import type { Role } from '@/types';

/** Whoever is chatting — every tool call runs with exactly their permissions, nothing more. */
export interface CopilotActor {
  id: string;
  role: Role;
}

/**
 * Read tools run the instant the model calls them. Write tools never do —
 * the orchestration loop pauses on them and hands `confirmationSummary`'s
 * text back to the chat UI as a confirm/cancel card; `run` only executes
 * after the admin explicitly confirms, via a separate endpoint.
 */
export type ToolRisk = 'read' | 'write-low' | 'write-high';

/**
 * A single callable the model can invoke. `parameters` is a JSON Schema
 * object (Gemini's function-calling format), and `run` is the actual
 * server-side implementation — the model never sees or touches application
 * code directly, it only ever gets a name, a schema, and a JSON result.
 */
export interface CopilotTool {
  name: string;
  description: string;
  /** Checked before `run` is ever called — a role without this permission gets a clear refusal, not a silent failure. */
  permission: Permission;
  /** Defaults to 'read' when omitted — every Phase 1-3 tool relies on that default. */
  risk?: ToolRisk;
  /** Required for write tools — the plain-language "this will…" line shown for confirmation before `run` executes. */
  confirmationSummary?: (args: Record<string, unknown>) => string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  run: (args: Record<string, unknown>, actor: CopilotActor) => Promise<unknown>;
}
