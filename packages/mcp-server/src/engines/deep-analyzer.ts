import { getAllCriteria } from '@accessible-ai/standards';
import { callClaude } from '../llm/client.js';
import {
  ACCESSIBILITY_EXPERT_SYSTEM_PROMPT,
  buildAltTextEvaluationPrompt,
  buildSummaryPrompt,
  buildViolationAnalysisPrompt,
} from '../llm/prompts.js';
import { formatSummary, formatViolationAnalysis, parseJsonResponse } from '../llm/response-parser.js';
import type { AxeViolation, DeepAnalysisRequest, DeepAnalysisResult, DeepFinding, LlmOnlyFinding } from '../config/types.js';

const CONTEXT_RADIUS = 200;
const analysisCache = new Map<string, string>();

interface CriterionGroup {
  criterionId: string;
  criterionName: string;
  violations: AxeViolation[];
}

function groupByCriterion(violations: AxeViolation[]): CriterionGroup[] {
  const criteria = getAllCriteria();
  const groups = new Map<string, CriterionGroup>();

  for (const violation of violations) {
    const criterion = criteria.find((c) => c.axeCoreRules.includes(violation.id));
    const key = criterion?.id ?? 'unmapped';
    const existing = groups.get(key);
    if (existing) {
      existing.violations.push(violation);
    } else {
      groups.set(key, {
        criterionId: key,
        criterionName: criterion?.name ?? 'Unmapped rule',
        violations: [violation],
      });
    }
  }

  return Array.from(groups.values());
}

/** Extracts a window of surrounding markup around a violating node's rendered HTML, for LLM context. */
function extractContext(pageHtml: string, nodeHtml: string): string {
  const index = pageHtml.indexOf(nodeHtml);
  if (index === -1) return nodeHtml;
  const start = Math.max(0, index - CONTEXT_RADIUS);
  const end = Math.min(pageHtml.length, index + nodeHtml.length + CONTEXT_RADIUS);
  return pageHtml.slice(start, end);
}

function cacheKey(group: CriterionGroup): string {
  const htmlSignature = group.violations.flatMap((v) => v.nodes.map((n) => n.html)).join('|');
  return `${group.violations.map((v) => v.id).join(',')}::${htmlSignature}`;
}

async function analyzeGroup(
  group: CriterionGroup,
  standard: string,
  pageHtml: string,
  apiKey: string | undefined,
): Promise<DeepFinding> {
  const key = cacheKey(group);
  let raw = analysisCache.get(key);

  if (raw === undefined) {
    const htmlContexts = group.violations.flatMap((v) => v.nodes.map((n) => extractContext(pageHtml, n.html)));
    const prompt = buildViolationAnalysisPrompt(
      group.violations,
      { id: group.criterionId, name: group.criterionName },
      htmlContexts,
      standard,
    );
    raw = await callClaude({
      system: ACCESSIBILITY_EXPERT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
      apiKey,
    });
    analysisCache.set(key, raw);
  }

  const instanceCount = group.violations.reduce((sum, v) => sum + v.nodes.length, 0);
  const primaryImpact = group.violations.find((v) => v.impact)?.impact ?? 'moderate';

  return {
    criterionId: group.criterionId,
    criterionName: group.criterionName,
    ruleId: group.violations.map((v) => v.id).join(', '),
    impact: primaryImpact,
    instanceCount,
    aiAnalysis: formatViolationAnalysis(raw),
  };
}

/** LLM-only checks that axe-core cannot perform: alt text quality on images that already "pass" the has-alt check. */
async function performLlmOnlyChecks(pageHtml: string, apiKey: string | undefined): Promise<LlmOnlyFinding[]> {
  const findings: LlmOnlyFinding[] = [];
  const imgMatches = Array.from(pageHtml.matchAll(/<img\b[^>]*alt="[^"]+"[^>]*>/gi)).slice(0, 5);

  for (const match of imgMatches) {
    const imgElement = match[0];
    const context = extractContext(pageHtml, imgElement);
    const raw = await callClaude({
      system: ACCESSIBILITY_EXPERT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildAltTextEvaluationPrompt(imgElement, context) }],
      apiKey,
    });
    const parsed = parseJsonResponse<{ isDescriptive?: boolean; issue?: string }>(raw);
    if (parsed && parsed.isDescriptive === false) {
      findings.push({
        category: 'alt-text-quality',
        description: parsed.issue ?? `Alt text on ${imgElement} may not be descriptive enough.`,
        severity: 'moderate',
      });
    }
  }

  return findings;
}

export async function deepAnalyze(request: DeepAnalysisRequest): Promise<DeepAnalysisResult> {
  const { auditResults, standard, pageUrl, pageHtml, anthropicApiKey } = request;

  const groups = groupByCriterion(auditResults.violations);
  const enrichedFindings = await Promise.all(
    groups.map((group) => analyzeGroup(group, standard, pageHtml, anthropicApiKey)),
  );
  const llmOnlyFindings = await performLlmOnlyChecks(pageHtml, anthropicApiKey);

  const summaryRaw = await callClaude({
    system: ACCESSIBILITY_EXPERT_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildSummaryPrompt({ enrichedFindings, llmOnlyFindings }, standard) }],
    apiKey: anthropicApiKey,
  });

  return {
    enrichedFindings,
    llmOnlyFindings,
    summary: formatSummary(summaryRaw),
    pageUrl,
    standard,
    generatedAt: new Date().toISOString(),
  };
}
