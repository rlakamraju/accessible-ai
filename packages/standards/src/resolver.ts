import wcagCriteriaData from './data/wcag-criteria.json';
import standardMappingsData from './data/standard-mappings.json';
import type {
  ComplianceStandard,
  ResolvedStandard,
  StandardId,
  StandardMapping,
  WcagCriterion,
  WcagLevel,
  WcagVersion,
} from './types';

const wcagCriteria = wcagCriteriaData as WcagCriterion[];
const standardMappings = standardMappingsData as Record<string, StandardMapping>;

const VERSION_ORDER: WcagVersion[] = ['2.0', '2.1', '2.2'];
const LEVEL_ORDER: WcagLevel[] = ['A', 'AA', 'AAA'];

const WCAG_ID_PATTERN = /^wcag-(2\.0|2\.1|2\.2)-(a|aa|aaa)$/;

function versionAtMost(version: WcagVersion, max: WcagVersion): boolean {
  return VERSION_ORDER.indexOf(version) <= VERSION_ORDER.indexOf(max);
}

function levelAtMost(level: WcagLevel, max: WcagLevel): boolean {
  return LEVEL_ORDER.indexOf(level) <= LEVEL_ORDER.indexOf(max);
}

function standardDisplayName(standardId: StandardId, version: WcagVersion, level: WcagLevel): string {
  switch (standardId) {
    case 'ada':
      return `ADA (WCAG ${version} ${level})`;
    case 'section-508':
      return `Section 508 (WCAG ${version} ${level})`;
    case 'eaa':
      return `EAA (WCAG ${version} ${level})`;
    default:
      return `WCAG ${version} ${level}`;
  }
}

function resolveVersionAndLevel(standardId: StandardId): {
  version: WcagVersion;
  level: WcagLevel;
  mapping?: StandardMapping;
} {
  const wcagMatch = WCAG_ID_PATTERN.exec(standardId);
  if (wcagMatch) {
    return {
      version: wcagMatch[1] as WcagVersion,
      level: wcagMatch[2].toUpperCase() as WcagLevel,
    };
  }

  const mapping = standardMappings[standardId];
  if (!mapping) {
    throw new Error(`Unknown standard: ${standardId}`);
  }
  return { version: mapping.basedOn, level: mapping.level, mapping };
}

/** Broad axe-core category tags (e.g. "wcag2a", "wcag21aa") for every version/level at or below the target. */
function axeCategoryTags(version: WcagVersion, level: WcagLevel): string[] {
  const tags: string[] = [];
  for (const v of VERSION_ORDER) {
    if (!versionAtMost(v, version)) continue;
    const versionTag = v.replace('.', ''); // "2.0" -> "20", "2.1" -> "21"
    for (const l of LEVEL_ORDER) {
      if (!levelAtMost(l, level)) continue;
      // axe-core's own tags omit the "0" in "wcag20*" (they're just "wcag2a"/"wcag2aa"/"wcag2aaa").
      const prefix = v === '2.0' ? 'wcag2' : `wcag${versionTag}`;
      tags.push(`${prefix}${l.toLowerCase()}`);
    }
  }
  return tags;
}

export function resolveStandard(standardId: StandardId): ResolvedStandard {
  const { version, level, mapping } = resolveVersionAndLevel(standardId);

  const criteria = wcagCriteria.filter(
    (c) => versionAtMost(c.version, version) && levelAtMost(c.level, level),
  );

  const axeCoreRuleIds = Array.from(new Set(criteria.flatMap((c) => c.axeCoreRules)));
  const eslintRules = Array.from(new Set(criteria.flatMap((c) => c.eslintRules)));
  const axeCoreRuleTags = axeCategoryTags(version, level);

  const standard: ComplianceStandard = {
    id: standardId,
    name: standardDisplayName(standardId, version, level),
    basedOnVersion: version,
    level,
    notes: mapping?.notes,
    additionalRequirements: mapping?.additionalRequirements,
  };

  return { standard, criteria, axeCoreRuleTags, axeCoreRuleIds, eslintRules };
}

export function getAllCriteria(): WcagCriterion[] {
  return wcagCriteria;
}
