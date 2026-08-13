import type { AccessibilityIssue, AxeViolation } from '../config/types.js';
import type { ProjectContext } from '../engines/remediation/types.js';

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

export function buildFixGenerationPrompt(issue: AccessibilityIssue, context: ProjectContext, fileContent: string): string {
  return `
Generate a fix for this accessibility issue. Standard: ${issue.standard}. WCAG criteria: ${issue.wcagCriteria.join(', ') || '(none mapped)'}.

Rule: ${issue.ruleId}
Impact: ${issue.impact}
Description: ${issue.description}
Violating code:
${issue.codeSnippet.violating || issue.runtimeContext?.renderedHtml || '(no snippet available)'}

Project context: framework=${context.framework}${context.frameworkVersion ? ` v${context.frameworkVersion}` : ''}, uiLibrary=${context.uiLibrary ?? 'none'}, namingConvention=${context.namingConvention}, existingA11yImports=${JSON.stringify(context.existingA11yImports)}.

Full current content of ${issue.sourceLocation.filePath || '(file unknown)'}:
${fileContent}

Produce a minimal, idiomatic fix for this framework (e.g. use the project's existing UI library/CDK utilities if one is already imported, rather than raw DOM APIs). Each "searchBlock" must be an exact, verbatim substring of the file above — it will be used to locate and replace the code.

Return JSON: { "changes": [{ "filePath": string, "searchBlock": string, "replaceBlock": string, "description": string }], "newFiles": [{ "filePath": string, "content": string, "description": string }], "newImports": [{ "filePath": string, "importStatement": string }], "explanation": string }`;
}

export function buildSummaryPrompt(allFindings: unknown, standard: string): string {
  return `
Given these accessibility findings for a page audited against ${standard}:

${JSON.stringify(allFindings, null, 2)}

Write a concise (3-5 sentence) executive summary in plain English covering: overall compliance posture, the most urgent issues, and whether there is meaningful legal exposure under ${standard}. Return JSON: { "summary": string }`;
}
