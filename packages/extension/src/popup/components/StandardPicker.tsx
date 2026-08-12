import { useEffect, useState, type ChangeEvent } from 'react';
import type { StandardId, WcagLevel, WcagVersion } from '@accessible-ai/standards';

const STORAGE_KEY = 'selectedStandard';
const DEFAULT_STANDARD: StandardId = 'wcag-2.1-aa';

const STANDARD_OPTIONS: { id: StandardId; label: string }[] = [
  { id: 'wcag-2.1-aa', label: 'WCAG 2.1 AA (default)' },
  { id: 'wcag-2.2-aa', label: 'WCAG 2.2 AA' },
  { id: 'ada', label: 'ADA' },
  { id: 'section-508', label: 'Section 508' },
  { id: 'eaa', label: 'EAA' },
];

interface StandardPickerProps {
  onStandardChange: (standard: StandardId) => void;
}

export function StandardPicker({ onStandardChange }: StandardPickerProps) {
  const [selected, setSelected] = useState<StandardId>(DEFAULT_STANDARD);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [customVersion, setCustomVersion] = useState<WcagVersion>('2.1');
  const [customLevel, setCustomLevel] = useState<WcagLevel>('AA');

  useEffect(() => {
    chrome.storage.local.get(STORAGE_KEY).then((stored) => {
      const saved = stored[STORAGE_KEY] as StandardId | undefined;
      const initial = saved ?? DEFAULT_STANDARD;
      setSelected(initial);
      onStandardChange(initial);
    });
    // Only run once on mount — onStandardChange identity may change across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectStandard(id: StandardId): void {
    setSelected(id);
    onStandardChange(id);
    void chrome.storage.local.set({ [STORAGE_KEY]: id });
  }

  function handleSelectChange(event: ChangeEvent<HTMLSelectElement>): void {
    selectStandard(event.target.value as StandardId);
  }

  function applyCustom(): void {
    selectStandard(`wcag-${customVersion}-${customLevel.toLowerCase()}` as StandardId);
  }

  return (
    <div className="standard-picker">
      <label htmlFor="standard-select">Compliance standard</label>
      <select id="standard-select" value={selected} onChange={handleSelectChange}>
        {STANDARD_OPTIONS.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
        {!STANDARD_OPTIONS.some((opt) => opt.id === selected) && (
          <option value={selected}>{selected}</option>
        )}
      </select>
      <button
        type="button"
        className="link-button"
        aria-expanded={advancedOpen}
        onClick={() => setAdvancedOpen((v) => !v)}
      >
        {advancedOpen ? 'Hide advanced options' : 'Advanced: custom WCAG version/level'}
      </button>
      {advancedOpen && (
        <div className="standard-picker-advanced">
          <select
            aria-label="WCAG version"
            value={customVersion}
            onChange={(e) => setCustomVersion(e.target.value as WcagVersion)}
          >
            <option value="2.0">2.0</option>
            <option value="2.1">2.1</option>
            <option value="2.2">2.2</option>
          </select>
          <select
            aria-label="WCAG level"
            value={customLevel}
            onChange={(e) => setCustomLevel(e.target.value as WcagLevel)}
          >
            <option value="A">A</option>
            <option value="AA">AA</option>
            <option value="AAA">AAA</option>
          </select>
          <button type="button" onClick={applyCustom}>
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
