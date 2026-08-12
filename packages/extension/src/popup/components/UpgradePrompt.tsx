interface UpgradePromptProps {
  feature: string;
  reason?: string;
  onOpenSettings: () => void;
}

export function UpgradePrompt({ feature, reason, onOpenSettings }: UpgradePromptProps) {
  return (
    <div className="upgrade-prompt" role="status">
      <p>
        This feature (<strong>{feature}</strong>) requires a license.
        {reason ? ` ${reason}.` : ''}
      </p>
      <div className="upgrade-actions">
        <button type="button" onClick={onOpenSettings}>
          Enter License Key
        </button>
        <a href="https://accessible-ai.example.com/pricing" target="_blank" rel="noreferrer">
          Get a License Key
        </a>
      </div>
    </div>
  );
}
