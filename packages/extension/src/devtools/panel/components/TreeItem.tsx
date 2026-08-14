import { useState } from 'react';
import type { TreeNode } from '../inspected-scripts';

interface TreeItemProps {
  node: TreeNode;
  depth: number;
  selectedSelector: string | null;
  onSelect: (node: TreeNode) => void;
}

export function TreeItem({ node, depth, selectedSelector, onSelect }: TreeItemProps) {
  const [collapsed, setCollapsed] = useState(false);
  const hasChildren = node.children.length > 0;
  const isSelected = node.selector === selectedSelector;

  return (
    <div className="tree-item">
      <div
        className={`tree-row${isSelected ? ' tree-row-selected' : ''}${node.violationIndexes.length ? ' tree-row-violation' : ''}`}
        style={{ paddingLeft: `${depth * 14 + 4}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="tree-toggle"
            aria-label={collapsed ? 'Expand' : 'Collapse'}
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed ? '▶' : '▼'}
          </button>
        ) : (
          <span className="tree-toggle-spacer" />
        )}
        <button type="button" className="tree-node-label" onClick={() => onSelect(node)}>
          <span className="tree-role">{node.role ?? node.tag}</span>
          {node.name && <span className="tree-name"> "{node.name}"</span>}
          {node.violationIndexes.length > 0 && (
            <span className="tree-violation-badge" title={`${node.violationIndexes.length} violation(s)`}>
              ⚠️ {node.violationIndexes.length}
            </span>
          )}
        </button>
      </div>
      {hasChildren && !collapsed && (
        <div className="tree-children">
          {node.children.map((child, i) => (
            <TreeItem key={`${child.selector}-${i}`} node={child} depth={depth + 1} selectedSelector={selectedSelector} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}
