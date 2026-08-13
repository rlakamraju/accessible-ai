import type { AxeViolation } from '../config/types.js';

export const ACCESSIBILITY_EXPERT_SYSTEM_PROMPT = `You are an accessibility expert grounded in the WCAG success criteria and the specific compliance standard given to you (do not invent criterion numbers). Respond with a JSON object matching the schema described in the user message — no prose outside the JSON.`;

interface CriterionLike {
  id: string;
  name: string;
}

export function buildViolationAnalysisPrompt(
  violations: AxeViolation[],
  criterion: CriterionLike,
  htmlContexts: string[],
  standard: string,
): string {
  return `
Standard: ${standard}
WCAG Criterion: ${criterion.id} — ${criterion.name}

Violations found by axe-core:
${JSON.stringify(violations, null, 2)}

HTML context around each violation:
${htmlContexts.map((c, i) => `--- Instance ${i + 1} ---\n${c}`).join('\n')}

Return JSON: { "explanation": string (plain-English, why this matters for ${standard}), "severityAssessment": string, "fixRecommendation": string (with code), "legalRiskNote": string }`;
}

export function buildAltTextEvaluationPrompt(imgElement: string, surroundingHtml: string): string {
  return `
Evaluate whether this image's alt text is genuinely descriptive (not just present):

Image element: ${imgElement}
Surrounding context: ${surroundingHtml}

Return JSON: { "isDescriptive": boolean, "issue": string | null, "suggestedAltText": string | null }`;
}

export function buildAriaPatternPrompt(componentHtml: string, widgetType: string): string {
  return `
Assess whether this "${widgetType}" widget has a complete ARIA pattern (roles, states, and keyboard interaction model — not just individual attributes):

${componentHtml}

Return JSON: { "isComplete": boolean, "missingPieces": string[], "recommendation": string }`;
}

export function buildSummaryPrompt(allFindings: unknown, standard: string): string {
  return `
Given these accessibility findings for a page audited against ${standard}:

${JSON.stringify(allFindings, null, 2)}

Write a concise (3-5 sentence) executive summary in plain English covering: overall compliance posture, the most urgent issues, and whether there is meaningful legal exposure under ${standard}. Return JSON: { "summary": string }`;
}
