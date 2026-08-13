export function ClickableCard({ onSelect }) {
  return (
    <div className="card" onClick={onSelect}>
      Select this plan
    </div>
  );
}
