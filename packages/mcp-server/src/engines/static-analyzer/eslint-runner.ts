import { ESLint, type Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import ngTemplatePlugin from '@angular-eslint/eslint-plugin-template';
import ngTemplateParser from '@angular-eslint/template-parser';
import vueA11yPlugin from 'eslint-plugin-vuejs-accessibility';
import vueParser from 'vue-eslint-parser';
import type { FrameworkType } from '@accessible-ai/standards';
import type { EslintAnalysisIssue, EslintAnalysisResult } from './types.js';

interface FrameworkEslintSetup {
  filePatterns: string[];
  pluginName: string;
  plugin: ESLint.Plugin;
  languageOptions: Linter.LanguageOptions;
}

const FRAMEWORK_SETUPS: Partial<Record<FrameworkType, FrameworkEslintSetup>> = {
  react: {
    filePatterns: ['**/*.jsx', '**/*.tsx'],
    pluginName: 'jsx-a11y',
    plugin: jsxA11y as unknown as ESLint.Plugin,
    languageOptions: {
      parser: tsParser as unknown as Linter.Parser,
      parserOptions: { ecmaFeatures: { jsx: true }, sourceType: 'module', ecmaVersion: 2022 },
    },
  },
  angular: {
    filePatterns: ['**/*.component.html'],
    pluginName: '@angular-eslint/template',
    plugin: ngTemplatePlugin as unknown as ESLint.Plugin,
    languageOptions: { parser: ngTemplateParser as unknown as Linter.Parser },
  },
  vue: {
    filePatterns: ['**/*.vue'],
    pluginName: 'vuejs-accessibility',
    plugin: vueA11yPlugin as unknown as ESLint.Plugin,
    languageOptions: { parser: vueParser as unknown as Linter.Parser },
  },
};

function emptyResult(): EslintAnalysisResult {
  return { issues: [], summary: { totalFiles: 0, filesWithIssues: 0, totalIssues: 0, byRule: {} } };
}

export interface EslintRunPatterns {
  include?: string[];
  exclude?: string[];
}

/**
 * Runs the accessibility rules of the ESLint plugin appropriate for `framework` against `projectPath`,
 * restricted to `ruleIds` (the eslint rule IDs the resolved standard cares about). No config file is
 * required or read from the target project — the flat config is composed entirely in-memory.
 */
export async function runEslintAnalysis(
  projectPath: string,
  framework: FrameworkType,
  ruleIds: string[],
  patterns: EslintRunPatterns = {},
): Promise<EslintAnalysisResult> {
  const setup = FRAMEWORK_SETUPS[framework];
  if (!setup) return emptyResult();

  const prefix = `${setup.pluginName}/`;
  const activeRuleIds = ruleIds.filter((id) => id.startsWith(prefix));
  if (activeRuleIds.length === 0) return emptyResult();

  const rules: Linter.RulesRecord = {};
  for (const ruleId of activeRuleIds) rules[ruleId] = 'error';

  const configs: Linter.Config[] = [
    {
      files: setup.filePatterns,
      languageOptions: setup.languageOptions,
      plugins: { [setup.pluginName]: setup.plugin },
      rules,
    },
  ];
  if (patterns.exclude?.length) configs.push({ ignores: patterns.exclude });

  const eslint = new ESLint({
    cwd: projectPath,
    overrideConfigFile: true,
    overrideConfig: configs,
    errorOnUnmatchedPattern: false,
  });

  const lintPatterns = patterns.include?.length ? patterns.include : setup.filePatterns;
  const results = await eslint.lintFiles(lintPatterns);

  const issues: EslintAnalysisIssue[] = [];
  const byRule: Record<string, number> = {};
  let filesWithIssues = 0;

  for (const fileResult of results) {
    if (fileResult.messages.length > 0) filesWithIssues++;
    for (const message of fileResult.messages) {
      issues.push({
        filePath: fileResult.filePath,
        line: message.line,
        column: message.column,
        ruleId: message.ruleId,
        message: message.message,
        severity: message.severity as 1 | 2,
        fixable: Boolean(message.fix),
      });
      if (message.ruleId) byRule[message.ruleId] = (byRule[message.ruleId] ?? 0) + 1;
    }
  }

  return {
    issues,
    summary: {
      totalFiles: results.length,
      filesWithIssues,
      totalIssues: issues.length,
      byRule,
    },
  };
}
