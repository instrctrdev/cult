import 'server-only';
import { env } from '@/lib/env';
import { runGeminiCopilot, type CopilotChatMessage, type CopilotReply } from './gemini';
import type { CopilotActor } from './types';

export type { CopilotChatMessage, CopilotReply, CopilotToolCallRecord, PendingAction } from './gemini';

/** Provider switch — AI_PROVIDER picks which adapter runs. Only Gemini exists today. */
export async function runCopilot(history: CopilotChatMessage[], actor: CopilotActor): Promise<CopilotReply> {
  const provider = env().AI_PROVIDER;
  switch (provider) {
    case 'gemini':
      return runGeminiCopilot(history, actor);
    default:
      throw new Error(`Unsupported AI_PROVIDER: ${provider}`);
  }
}
