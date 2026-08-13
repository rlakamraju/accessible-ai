/** Extracts a JSON object from Claude's response, tolerating markdown code fences. Returns null if it can't be parsed. */
export function parseJsonResponse<T>(raw: string): T | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(raw);
  const candidate = fenced ? fenced[1] : raw;
  try {
    return JSON.parse(candidate.trim()) as T;
  } catch {
    return null;
  }
}

interface ViolationAnalysis {
  explanation?: string;
  severityAssessment?: string;
  fixRecommendation?: string;
  legalRiskNote?: string;
}

/** Turns a parsed (or unparsed) violation-analysis response into a single readable insight string. */
export function formatViolationAnalysis(raw: string): string {
  const parsed = parseJsonResponse<ViolationAnalysis>(raw);
  if (!parsed) return raw.trim();

  const sections = [
    parsed.explanation && `Why it matters: ${parsed.explanation}`,
    parsed.severityAssessment && `Severity in context: ${parsed.severityAssessment}`,
    parsed.fixRecommendation && `Fix: ${parsed.fixRecommendation}`,
    parsed.legalRiskNote && `Legal risk: ${parsed.legalRiskNote}`,
  ].filter(Boolean);

  return sections.length > 0 ? sections.join('\n') : raw.trim();
}

interface SummaryResponse {
  summary?: string;
}

export function formatSummary(raw: string): string {
  const parsed = parseJsonResponse<SummaryResponse>(raw);
  return parsed?.summary ?? raw.trim();
}

export interface FixResponseChange {
  filePath: string;
  searchBlock: string;
  replaceBlock: string;
  description: string;
}

export interface FixResponseNewFile {
  filePath: string;
  content: string;
  description: string;
}

export interface FixResponse {
  changes?: FixResponseChange[];
  newFiles?: FixResponseNewFile[];
  newImports?: Array<{ filePath: string; importStatement: string }>;
  explanation?: string;
}

/** Parses `buildFixGenerationPrompt`'s expected response shape. Returns `null` (not a partial object) if the JSON itself doesn't parse — callers fall back to manual guidance using the raw text. */
export function parseFixResponse(raw: string): FixResponse | null {
  return parseJsonResponse<FixResponse>(raw);
}
