import { useState } from 'react';
import { useLicense } from '../hooks/useLicense';
import { useAnthropicKey } from '../hooks/useAnthropicKey';

interface LicenseSettingsProps {
  onClose: () => void;
}

export function LicenseSettings({ onClose }: LicenseSettingsProps) {
  const { licenseStatus, isLoading, saveLicenseKey, removeLicenseKey } = useLicense();
  const { status: anthropicStatus, saveAnthropicKey, removeAnthropicKey } = useAnthropicKey();
  const [inputValue, setInputValue] = useState('');
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [anthropicInputValue, setAnthropicInputValue] = useState('');
  const [confirmingAnthropicRemove, setConfirmingAnthropicRemove] = useState(false);

  async function handleSave(): Promise<void> {
    const key = inputValue.trim();
    if (!key) return;
    await saveLicenseKey(key);
    setInputValue('');
  }

  async function handleRemove(): Promise<void> {
    await removeLicenseKey();
    setConfirmingRemove(false);
  }

  async function handleSaveAnthropicKey(): Promise<void> {
    const key = anthropicInputValue.trim();
    if (!key) return;
    await saveAnthropicKey(key);
    setAnthropicInputValue('');
  }

  async function handleRemoveAnthropicKey(): Promise<void> {
    await removeAnthropicKey();
    setConfirmingAnthropicRemove(false);
  }

  return (
    <div className="license-settings">
      <div className="license-settings-header">
        <h2>License</h2>
        <button type="button" className="link-button" onClick={onClose}>
          Close
        </button>
      </div>

      {isLoading && <p>Loading…</p>}

      {!isLoading && licenseStatus && !licenseStatus.hasKey && (
        <p className="license-status">
          Free tier — Quick Audit available. Enter a license key for Deep Analysis and more.
        </p>
      )}

      {!isLoading && licenseStatus?.hasKey && licenseStatus.valid && (
        <div className="license-status license-valid">
          <p>
            ✅ Licensed to: {licenseStatus.email} ({licenseStatus.tier} — expires{' '}
            {licenseStatus.expiresAt ? new Date(licenseStatus.expiresAt).toLocaleDateString() : 'n/a'})
          </p>
          <ul className="feature-checklist">
            {licenseStatus.features?.map((feature) => (
              <li key={feature}>✓ {feature}</li>
            ))}
          </ul>
        </div>
      )}

      {!isLoading && licenseStatus?.hasKey && !licenseStatus.valid && licenseStatus.reason === 'License expired' && (
        <p className="license-status license-expired">
          ⚠️ License expired.{' '}
          <a href="https://accessible-ai.example.com/renew" target="_blank" rel="noreferrer">
            Renew
          </a>
        </p>
      )}

      {!isLoading &&
        licenseStatus?.hasKey &&
        !licenseStatus.valid &&
        licenseStatus.reason !== 'License expired' && (
          <p className="license-status license-invalid">❌ Invalid license key — {licenseStatus.reason}</p>
        )}

      {licenseStatus?.hasKey && <p className="license-key-preview">Key: {licenseStatus.keyPreview}</p>}

      <div className="license-input-row">
        <input
          type="text"
          placeholder="Paste license key"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
        />
        <button type="button" onClick={handleSave} disabled={!inputValue.trim()}>
          Save
        </button>
      </div>

      {licenseStatus?.hasKey && !confirmingRemove && (
        <button type="button" className="link-button" onClick={() => setConfirmingRemove(true)}>
          Remove Key
        </button>
      )}
      {confirmingRemove && (
        <div className="confirm-remove">
          <span>Remove license key?</span>
          <button type="button" onClick={handleRemove}>
            Yes, remove
          </button>
          <button type="button" onClick={() => setConfirmingRemove(false)}>
            Cancel
          </button>
        </div>
      )}

      <a
        className="get-license-link"
        href="https://accessible-ai.example.com/pricing"
        target="_blank"
        rel="noreferrer"
      >
        Get a License Key
      </a>

      <hr />

      <h2>Claude API Key</h2>
      <p className="anthropic-key-note">
        Deep Analysis calls Claude directly using your own Anthropic API key — it's billed to your account, sent only
        to your locally running MCP server, and never shared with AccessibleAI.
      </p>

      {anthropicStatus?.hasKey && <p className="license-key-preview">Key: {anthropicStatus.keyPreview}</p>}

      <div className="license-input-row">
        <input
          type="password"
          placeholder="Paste Anthropic API key (sk-ant-...)"
          value={anthropicInputValue}
          onChange={(e) => setAnthropicInputValue(e.target.value)}
        />
        <button type="button" onClick={handleSaveAnthropicKey} disabled={!anthropicInputValue.trim()}>
          Save
        </button>
      </div>

      {anthropicStatus?.hasKey && !confirmingAnthropicRemove && (
        <button type="button" className="link-button" onClick={() => setConfirmingAnthropicRemove(true)}>
          Remove Key
        </button>
      )}
      {confirmingAnthropicRemove && (
        <div className="confirm-remove">
          <span>Remove Anthropic API key?</span>
          <button type="button" onClick={handleRemoveAnthropicKey}>
            Yes, remove
          </button>
          <button type="button" onClick={() => setConfirmingAnthropicRemove(false)}>
            Cancel
          </button>
        </div>
      )}

      <a className="get-license-link" href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
        Get a Claude API Key
      </a>
    </div>
  );
}
