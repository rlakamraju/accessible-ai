interface AuditButtonProps {
  isAuditing: boolean;
  onAudit: () => void;
}

export function AuditButton({ isAuditing, onAudit }: AuditButtonProps) {
  return (
    <button type="button" className="audit-button" onClick={onAudit} disabled={isAuditing}>
      {isAuditing ? (
        <>
          <span className="spinner" aria-hidden="true" />
          Auditing…
        </>
      ) : (
        'Audit This Page'
      )}
    </button>
  );
}
