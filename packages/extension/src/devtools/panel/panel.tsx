import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import { checkFeatureAccess } from '../../core/license-gate';
import { mcpBridge, LicenseError, type DeepAnalysisResult } from '../../background/mcp-bridge';
import { UpgradePrompt } from '../../popup/components/UpgradePrompt';
import type { ProcessedAuditResult } from '../../shared/types';
import { callInInspectedWindow, callWithInspectedElement } from './eval-runner';
import {
  computeAccessibilityTreeInPage,
  describeSelectedElementInPage,
  selectElementBySelectorInPage,
  type ElementDetails,
  type TreeNode,
} from './inspected-scripts';
import { findLatestPageAudit, toViolationSelectorGroups } from './audit-lookup';
import { TreeItem } from './components/TreeItem';
import './styles/panel.css';

type AiState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'upgrade'; reason?: string }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; result: DeepAnalysisResult };

function getPageUrl(): Promise<string> {
  return callInInspectedWindow<string>(() => location.href);
}

function fallbackDetails(node: TreeNode): ElementDetails {
  return {
    tag: node.tag,
    role: node.role,
    name: node.name,
    selector: node.selector,
    focusable: false,
    hasClickHandler: false,
    hasKeyboardHandler: false,
    outerHtml: '',
    violationIndexes: node.violationIndexes,
  };
}

function Panel() {
  const [url, setUrl] = useState<string | null>(null);
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [auditResult, setAuditResult] = useState<ProcessedAuditResult | null>(null);
  const [selected, setSelected] = useState<ElementDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiState, setAiState] = useState<AiState>({ status: 'idle' });

  async function refresh(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const currentUrl = await getPageUrl();
      setUrl(currentUrl);
      const result = await findLatestPageAudit(currentUrl);
      setAuditResult(result);
      const groups = result ? toViolationSelectorGroups(result) : [];
      const nextTree = await callInInspectedWindow(computeAccessibilityTreeInPage, [groups]);
      setTree(nextTree);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to inspect the page');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    const onNavigated = () => void refresh();
    chrome.devtools.network.onNavigated.addListener(onNavigated);
    return () => chrome.devtools.network.onNavigated.removeListener(onNavigated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handler = () => {
      const groups = auditResult ? toViolationSelectorGroups(auditResult) : [];
      callWithInspectedElement<ElementDetails | null>(describeSelectedElementInPage, [groups])
        .then((details) => {
          if (details) {
            setSelected(details);
            setAiState({ status: 'idle' });
          }
        })
        .catch(() => {
          /* $0 may be unset (nothing selected in Elements panel) */
        });
    };
    chrome.devtools.panels.elements.onSelectionChanged.addListener(handler);
    return () => chrome.devtools.panels.elements.onSelectionChanged.removeListener(handler);
  }, [auditResult]);

  async function selectNode(node: TreeNode): Promise<void> {
    setAiState({ status: 'idle' });
    try {
      await callInInspectedWindow(selectElementBySelectorInPage, [node.selector]);
      const groups = auditResult ? toViolationSelectorGroups(auditResult) : [];
      const details = await callWithInspectedElement<ElementDetails | null>(describeSelectedElementInPage, [groups]);
      setSelected(details ?? fallbackDetails(node));
    } catch {
      setSelected(fallbackDetails(node));
    }
  }

  async function runAiSuggest(): Promise<void> {
    if (!selected || !auditResult || selected.violationIndexes.length === 0) return;
    setAiState({ status: 'checking' });
    const access = await checkFeatureAccess('deep-analysis');
    if (!access.allowed) {
      setAiState({ status: 'upgrade', reason: access.reason });
      return;
    }
    setAiState({ status: 'loading' });
    try {
      const violations = selected.violationIndexes.map((i) => auditResult.violations[i]).filter(Boolean);
      const synthetic: ProcessedAuditResult = { ...auditResult, violations };
      const result = await mcpBridge.requestDeepAnalysis(synthetic, selected.outerHtml);
      setAiState({ status: 'success', result });
    } catch (err) {
      if (err instanceof LicenseError) {
        setAiState({ status: 'upgrade', reason: err.message });
      } else {
        setAiState({ status: 'error', message: err instanceof Error ? err.message : 'AI analysis failed' });
      }
    }
  }

  const matchedViolations = selected && auditResult ? selected.violationIndexes.map((i) => auditResult.violations[i]).filter(Boolean) : [];

  return (
    <div className="devtools-panel">
      <header className="devtools-header">
        <h1>AccessibleAI</h1>
        <span className="devtools-url" title={url ?? ''}>
          {url ?? 'Loading…'}
        </span>
        <button type="button" className="devtools-refresh" onClick={() => void refresh()} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      {error && (
        <p className="devtools-error" role="alert">
          {error}
        </p>
      )}

      {!auditResult && !loading && (
        <p className="devtools-hint">
          No Quick Audit found for this page yet. Run one from the extension popup to see violations annotated
          here.
        </p>
      )}

      <div className="devtools-body">
        <div className="devtools-tree-pane">
          {tree ? (
            <TreeItem node={tree} depth={0} selectedSelector={selected?.selector ?? null} onSelect={(n) => void selectNode(n)} />
          ) : (
            <p className="devtools-hint">{loading ? 'Inspecting page…' : 'No elements found.'}</p>
          )}
        </div>

        <div className="devtools-detail-pane">
          {!selected ? (
            <p className="devtools-hint">Select an element in the tree, or in the Elements panel.</p>
          ) : (
            <div className="element-details">
              <h2>
                &lt;{selected.tag}&gt;
                {selected.role && <span className="element-role"> role: {selected.role}</span>}
              </h2>
              <p className="element-name">
                Name: {selected.name ? `"${selected.name}"` : <span className="element-name-missing">MISSING ⚠️</span>}
              </p>
              <p>Focusable: {selected.focusable ? 'yes' : 'no'}</p>
              <p>
                Keyboard:{' '}
                {selected.hasKeyboardHandler
                  ? 'handled'
                  : selected.hasClickHandler
                    ? 'click only ⚠️'
                    : 'n/a'}
              </p>

              <div className="element-violations">
                <h3>Violations</h3>
                {matchedViolations.length === 0 ? (
                  <p className="devtools-hint">No known violations for this element.</p>
                ) : (
                  <ul>
                    {matchedViolations.map((v) => (
                      <li key={v.id}>
                        <strong>{v.criterionIds.join(', ')}</strong>
                        <p>{v.help}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="ai-suggest">
                <button
                  type="button"
                  className="ai-suggest-button"
                  disabled={matchedViolations.length === 0 || aiState.status === 'loading' || aiState.status === 'checking'}
                  onClick={() => void runAiSuggest()}
                >
                  {aiState.status === 'loading' || aiState.status === 'checking' ? 'Analyzing…' : '🤖 AI Suggest'}
                </button>

                {aiState.status === 'upgrade' && (
                  <UpgradePrompt feature="deep-analysis" reason={aiState.reason} onOpenSettings={() => {
                    try {
                      chrome.action?.openPopup?.();
                    } catch {
                      /* devtools context can't always open the action popup; the pricing link still works */
                    }
                  }} />
                )}

                {aiState.status === 'error' && (
                  <p className="devtools-error" role="alert">
                    {aiState.message}
                  </p>
                )}

                {aiState.status === 'success' && (
                  <div className="ai-suggestion-result">
                    <p className="ai-suggestion-summary">{aiState.result.summary}</p>
                    {aiState.result.enrichedFindings.map((finding) => (
                      <p key={finding.ruleId} className="ai-suggestion-finding">
                        {finding.aiAnalysis}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<Panel />);
}
