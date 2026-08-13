import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { hasFeature, validateLicenseKeyNode, type FeatureFlag, type LicenseValidation } from '@accessible-ai/standards';

const LICENSE_FILE_PATH = join(homedir(), '.accessible-ai', 'license.key');

/** Reads a license key persisted to disk (set once by Claude Code / Claude Desktop users). Returns null if absent. */
export function readKeyFromDisk(): string | null {
  try {
    return readFileSync(LICENSE_FILE_PATH, 'utf8').trim() || null;
  } catch {
    return null;
  }
}

function resolveKey(headerKey?: string): string | null {
  return headerKey || process.env.LICENSE_KEY || readKeyFromDisk() || null;
}

function validate(key: string | null): LicenseValidation {
  const secret = process.env.LICENSE_SECRET;
  if (!key || !secret) {
    return { valid: false, reason: key ? 'LICENSE_SECRET is not configured' : 'License key required' };
  }
  return validateLicenseKeyNode(key, secret);
}

/** Express middleware gating an HTTP route behind a feature flag. Resolves the key from the `x-license-key` header. */
export function requireLicense(feature: FeatureFlag) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = resolveKey(req.headers['x-license-key'] as string | undefined);
    const validation = validate(key);

    if (!validation.valid || !hasFeature(validation, feature)) {
      res.status(403).json({
        error: validation.reason ?? `Upgrade required for ${feature}`,
        feature,
        requiredTier: feature,
      });
      return;
    }

    next();
  };
}

type ToolHandler<Args> = (args: Args) => Promise<CallToolResult> | CallToolResult;

/** Wraps an MCP tool handler so it refuses to run without a license covering `feature`. Resolves the key from `LICENSE_KEY` env or disk. */
export function requireLicenseForTool<Args>(feature: FeatureFlag, handler: ToolHandler<Args>): ToolHandler<Args> {
  return async (args: Args) => {
    const key = resolveKey();
    const validation = validate(key);

    if (!validation.valid || !hasFeature(validation, feature)) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'License required',
              feature,
              message: `This tool requires a ${feature} license. Set LICENSE_KEY env or create ~/.accessible-ai/license.key`,
              currentTier: validation.tier ?? 'none',
            }),
          },
        ],
      };
    }

    return handler(args);
  };
}
