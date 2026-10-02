import 'server-only';
import { GoogleGenAI, FunctionCallingConfigMode, type Content, type FunctionDeclaration } from '@google/genai';
import { env } from '@/lib/env';
import { can } from '@/lib/auth/rbac';
import { ALL_TOOLS, TOOLS_BY_NAME } from './tools';
import type { CopilotActor, ToolRisk } from './types';

const SYSTEM_INSTRUCTION = `You are the CULT Admin Copilot, an assistant built into the CULT fashion e-commerce admin panel.

You help store staff look up real data — orders, products, inventory, coupons, customers, sales, categories — and can also make changes: create coupons, activate/deactivate coupons, change an order's status, and adjust a variant's stock.

You can also add products. When an admin describes products they want created, call plan_product_import with every one of them. Never tell them to use the admin form instead, and never hand back a list for them to copy out by hand — that is the one thing they came here to avoid. The tool only prepares a table for them to confirm; it creates nothing by itself, so there is no risk in calling it.

If they attached a ZIP, its filenames are listed at the end of their message. Match each file to the product its name refers to — black-shirt-front.jpg belongs to the black shirt. You cannot see the pictures themselves, only the names, so never guess beyond what a filename plainly says. Invent a product name, description, fabric or fit when asked to; every number — price, stock, sizes — must come from what the admin actually said.

You have no knowledge of the store's actual data beyond what a tool call returns: never guess, estimate, or make up a number, order, product, or customer. If a question needs data, call the matching tool. If no tool fits, say so plainly and suggest what the admin could check instead — never invent an answer.

Every tool that changes data pauses for the admin's explicit confirmation before it actually runs — you will never see the result of a write tool in the same turn you call it, because it hasn't happened yet. Don't claim something was created or changed until you're told it was confirmed.

Money is shown to you already formatted in rupees. Be concise — admins are checking facts quickly, not reading essays. When a tool returns an empty result, say so directly instead of padding the answer.`;

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  const apiKey = env().AI_API_KEY;
  if (!apiKey) {
    throw new Error('AI Copilot is not configured: AI_API_KEY is empty on the server.');
  }
  if (!client) client = new GoogleGenAI({ apiKey });
  return client;
}

function toFunctionDeclarations(actor: CopilotActor): FunctionDeclaration[] {
  return ALL_TOOLS
    .filter((tool) => can(actor.role, tool.permission))
    .map((tool) => ({
      name: tool.name,
      description: tool.description,
      parametersJsonSchema: tool.parameters,
    }));
}

export interface CopilotChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface CopilotToolCallRecord {
  name: string;
  args: Record<string, unknown>;
  ok: boolean;
  result?: unknown;
  error?: string;
}

export interface PendingAction {
  name: string;
  args: Record<string, unknown>;
  summary: string;
  risk: ToolRisk;
}

export interface CopilotReply {
  text: string;
  toolCalls: CopilotToolCallRecord[];
  pendingAction?: PendingAction;
}

const MAX_TOOL_TURNS = 6;

export async function runGeminiCopilot(
  history: CopilotChatMessage[],
  actor: CopilotActor,
): Promise<CopilotReply> {
  const ai = getClient();
  const model = env().AI_MODEL;
  const functionDeclarations = toFunctionDeclarations(actor);

  const contents: Content[] = history.map((m) => ({
    role: m.role,
    parts: [{ text: m.text }],
  }));

  const toolCalls: CopilotToolCallRecord[] = [];

  for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: functionDeclarations.length ? [{ functionDeclarations }] : undefined,
        toolConfig: functionDeclarations.length
          ? { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } }
          : undefined,
      },
    });

    const calls = response.functionCalls ?? [];
    if (calls.length === 0) {
      return { text: response.text ?? '', toolCalls };
    }

    // Echo back the model's own turn verbatim (not a hand-rebuilt one) — newer
    // Gemini models attach a thoughtSignature to each functionCall part that
    // must round-trip unchanged, or the next call is rejected with 400.
    const modelContent = response.candidates?.[0]?.content;
    contents.push(modelContent ?? { role: 'model', parts: calls.map((c) => ({ functionCall: { name: c.name, args: c.args ?? {} } })) });

    const responseParts = [];
    for (const call of calls) {
      const name = call.name ?? '';
      const args = (call.args ?? {}) as Record<string, unknown>;
      const tool = TOOLS_BY_NAME.get(name);

      if (!tool) {
        toolCalls.push({ name, args, ok: false, error: 'Unknown tool.' });
        responseParts.push({ functionResponse: { name, response: { error: `No such tool: ${name}` } } });
        continue;
      }
      if (!can(actor.role, tool.permission)) {
        toolCalls.push({ name, args, ok: false, error: 'Not permitted for your role.' });
        responseParts.push({ functionResponse: { name, response: { error: 'You do not have permission to use this tool.' } } });
        continue;
      }

      const risk = tool.risk ?? 'read';
      if (risk !== 'read') {
        // Never execute a write tool inline — hand it to the chat UI as a
        // confirm/cancel card instead, and stop this turn entirely. The
        // conversation history sent so far is discarded for this request;
        // it's only replayed once the admin's next message (a confirmation
        // or a new question) restarts the loop from scratch.
        const summary = tool.confirmationSummary?.(args) ?? `Run ${name} with ${JSON.stringify(args)}.`;
        return {
          text: '',
          toolCalls,
          pendingAction: { name, args, summary, risk },
        };
      }

      try {
        const result = await tool.run(args, actor);
        toolCalls.push({ name, args, ok: true, result });
        responseParts.push({ functionResponse: { name, response: { output: result } } });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Tool failed unexpectedly.';
        toolCalls.push({ name, args, ok: false, error: message });
        responseParts.push({ functionResponse: { name, response: { error: message } } });
      }
    }

    contents.push({ role: 'user', parts: responseParts });
  }

  return {
    text: "I made several tool calls but couldn't settle on a final answer — could you narrow down the question?",
    toolCalls,
  };
}
