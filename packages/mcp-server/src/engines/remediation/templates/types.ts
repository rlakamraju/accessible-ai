import type { FrameworkType } from '@accessible-ai/standards';

export interface FixTarget {
  filePath: string;
  /** 1-indexed line where the target tag starts. */
  line: number;
  tagName: string;
  /** Raw attribute string between the tag name and the closing `>`/`/>`. */
  attrsRaw: string;
}

export interface TransformResult {
  newContent: string;
  description: string;
}

/**
 * A Level-1 (template-based) auto-fix for one specific rule/pattern. Operates purely on file text —
 * `detect` finds candidate lines via the shared regex tag scanner (no per-framework AST, consistent
 * with `static-analyzer/custom-rules/tag-scanner.ts`'s documented trade-off), `transform` rewrites the
 * single line the target starts on and returns the whole new file content plus a human description.
 */
export interface FixTemplate {
  id: string;
  wcagCriteria: string[];
  applicableTo: FrameworkType[] | 'all';
  detect(fileContent: string, filePath: string): FixTarget[];
  transform(fileContent: string, target: FixTarget, framework: FrameworkType): TransformResult | null;
}
