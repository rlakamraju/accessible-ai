export type FrameworkType = 'angular' | 'react' | 'vue' | 'svelte' | 'wordpress' | 'html' | 'auto';

export type WcagLevel = 'A' | 'AA' | 'AAA';
export type WcagVersion = '2.0' | '2.1' | '2.2';

export type StandardId =
  | 'wcag-2.0-a'
  | 'wcag-2.0-aa'
  | 'wcag-2.0-aaa'
  | 'wcag-2.1-a'
  | 'wcag-2.1-aa'
  | 'wcag-2.1-aaa'
  | 'wcag-2.2-a'
  | 'wcag-2.2-aa'
  | 'wcag-2.2-aaa'
  | 'ada'
  | 'section-508'
  | 'eaa';

export type Principle = 'perceivable' | 'operable' | 'understandable' | 'robust';

export type Impact = 'critical' | 'serious' | 'moderate' | 'minor';

export interface WcagCriterion {
  id: string; // e.g. "1.1.1"
  name: string;
  level: WcagLevel;
  version: WcagVersion; // the WCAG version that introduced this criterion
  principle: Principle;
  guideline: string; // e.g. "1.1"
  /** axe-core rule IDs known to test (at least in part) this criterion. May be empty for criteria with no reliable automated check. */
  axeCoreRules: string[];
  /** eslint-plugin-jsx-a11y (or equivalent) rule IDs for static codebase analysis. Populated in a later phase. */
  eslintRules: string[];
}

/** Raw entry in `data/standard-mappings.json` — describes a non-WCAG standard in terms of the WCAG version/level it's based on. */
export interface StandardMapping {
  basedOn: WcagVersion;
  level: WcagLevel;
  notes?: string;
  additionalRequirements?: string[];
}

export interface ComplianceStandard {
  id: StandardId;
  name: string;
  basedOnVersion: WcagVersion;
  level: WcagLevel;
  notes?: string;
  additionalRequirements?: string[];
}

export interface ResolvedStandard {
  standard: ComplianceStandard;
  criteria: WcagCriterion[];
  /** Broad axe-core category tags (e.g. "wcag2a", "wcag21aa") to pass to `axe.run`'s `runOnly.tags`. */
  axeCoreRuleTags: string[];
  /** Flattened, deduplicated axe-core rule IDs referenced by the in-scope criteria. */
  axeCoreRuleIds: string[];
  /** Flattened, deduplicated eslint rule IDs referenced by the in-scope criteria. */
  eslintRules: string[];
}
