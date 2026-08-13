import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AxeViolation, DeepAnalysisRequest } from '../../src/config/types';

const mockCallClaude = vi.fn();
vi.mock('../../src/llm/client', () => ({ callClaude: mockCallClaude }));

const imageAltViolation: AxeViolation = {
  id: 'image-alt',
  impact: 'critical',
  description: 'Images must have alternate text',
  help: 'Images must have alternate text',
  helpUrl: 'https://dequeuniversity.com/rules/axe/image-alt',
  tags: ['wcag2a', 'wcag111'],
  nodes: [{ target: ['#logo'], html: '<img id="logo" src="logo.png">' }],
};

const linkNameViolation: AxeViolation = {
  id: 'link-name',
  impact: 'serious',
  description: 'Links must have discernible text',
  help: 'Links must have discernible text',
  helpUrl: 'https://dequeuniversity.com/rules/axe/link-name',
  tags: ['wcag2a', 'wcag412'],
  nodes: [{ target: ['a.icon-link'], html: '<a class="icon-link" href="/x"><i class="icon"></i></a>' }],
};

function makeRequest(violations: AxeViolation[], pageHtml: string): DeepAnalysisRequest {
  return { auditResults: { violations }, standard: 'ada', pageUrl: 'https://example.com', pageHtml };
}

describe('deepAnalyze', () => {
  beforeEach(() => {
    vi.resetModules();
    mockCallClaude.mockReset();
    mockCallClaude.mockResolvedValue(
      JSON.stringify({ explanation: 'why', severityAssessment: 'high', fixRecommendation: 'fix it', legalRiskNote: 'risk' }),
    );
  });

  it('groups violations by WCAG criterion before calling the LLM', async () => {
    const { deepAnalyze } = await import('../../src/engines/deep-analyzer');
    const pageHtml = `<html><body>${imageAltViolation.nodes[0].html}${linkNameViolation.nodes[0].html}</body></html>`;

    const result = await deepAnalyze(makeRequest([imageAltViolation, linkNameViolation], pageHtml));

    expect(result.enrichedFindings).toHaveLength(2);
    expect(result.enrichedFindings.map((f) => f.criterionId).sort()).toEqual(['1.1.1', '2.4.4']);
  });

  it('extracts HTML context around the violating node for the LLM prompt', async () => {
    const { deepAnalyze } = await import('../../src/engines/deep-analyzer');
    const pageHtml = `<html><body><header>site</header>${imageAltViolation.nodes[0].html}<footer>end</footer></body></html>`;

    await deepAnalyze(makeRequest([imageAltViolation], pageHtml));

    const [options] = mockCallClaude.mock.calls[0];
    const promptText = options.messages[0].content;
    expect(promptText).toContain('site');
    expect(promptText).toContain(imageAltViolation.nodes[0].html);
  });

  it('assembles enriched findings with impact, instance count, and AI analysis text', async () => {
    const { deepAnalyze } = await import('../../src/engines/deep-analyzer');
    const result = await deepAnalyze(makeRequest([imageAltViolation], '<html></html>'));

    const finding = result.enrichedFindings[0];
    expect(finding.impact).toBe('critical');
    expect(finding.instanceCount).toBe(1);
    expect(finding.aiAnalysis).toContain('why');
    expect(finding.aiAnalysis).toContain('fix it');
  });

  it('reuses a cached analysis for an identical violation pattern instead of calling the LLM again', async () => {
    const { deepAnalyze } = await import('../../src/engines/deep-analyzer');
    const pageHtml = `<html>${imageAltViolation.nodes[0].html}</html>`;

    await deepAnalyze(makeRequest([imageAltViolation], pageHtml));
    const callsAfterFirst = mockCallClaude.mock.calls.length;

    await deepAnalyze(makeRequest([imageAltViolation], pageHtml));
    const callsAfterSecond = mockCallClaude.mock.calls.length;

    // Only the summary call should re-run on the second pass — the violation-analysis call is cached.
    expect(callsAfterSecond).toBe(callsAfterFirst + 1);
  });
});
