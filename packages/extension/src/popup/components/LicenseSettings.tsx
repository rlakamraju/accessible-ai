import { useState } from 'react';
import { useLicense } from '../hooks/useLicense';

interface LicenseSettingsProps {
  onClose: () => void;
}

export function LicenseSettings({ onClose }: LicenseSettingsProps) {
  const { licenseStatus, isLoading, saveLicenseKey, removeLicenseKey } = useLicense();
  const [inputValue, setInputValue] = useState('');
  const [confirmingRemove, setConfirmingRemove] = useState(false);

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
    </div>
  );
}
