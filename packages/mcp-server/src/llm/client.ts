import Anthropic from '@anthropic-ai/sdk';

const DEFAULT_MODEL = 'claude-sonnet-5';
const DEFAULT_MAX_TOKENS = 2048;

let envClient: Anthropic | undefined;

/**
 * Resolves the Anthropic client to call. `apiKey` (when given) is a per-request, bring-your-own
 * key from the Chrome extension's `x-anthropic-api-key` header — each client pays for their own
 * Claude usage, so it's never cached and never falls back to this server's own env var. Only the
 * env-var path (stdio/Claude Code, or an HTTP deployment with no client-supplied key) is cached.
 */
function getClient(apiKey?: string): Anthropic {
  if (apiKey) return new Anthropic({ apiKey });

  if (!envClient) {
    const envKey = process.env.ANTHROPIC_API_KEY;
    if (!envKey) {
      throw new Error(
        'No Anthropic API key configured — set ANTHROPIC_API_KEY, or provide one via the x-anthropic-api-key header.',
      );
    }
    envClient = new Anthropic({ apiKey: envKey });
  }
  return envClient;
}

export interface CallClaudeOptions {
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  maxTokens?: number;
  apiKey?: string;
}

/** Calls Claude with a single retry on rate limiting. Throws on auth errors. */
export async function callClaude(options: CallClaudeOptions): Promise<string> {
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  const anthropic = getClient(options.apiKey);

  const request = async () =>
    anthropic.messages.create({
      model,
      max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
      system: options.system,
      messages: options.messages,
    });

  let response;
  try {
    response = await request();
  } catch (error) {
    if (error instanceof Anthropic.APIError && error.status === 429) {
      response = await request();
    } else {
      throw error;
    }
  }

  const usage = response.usage;
  console.log(
    `[accessible-ai] Claude call: ${usage.input_tokens} input / ${usage.output_tokens} output tokens`,
  );

  const textBlock = response.content.find((block) => block.type === 'text');
  return textBlock && 'text' in textBlock ? textBlock.text : '';
}
