import { createRoot } from 'react-dom/client';

function SidePanel() {
  return <div>AccessibleAI — Loading...</div>;
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<SidePanel />);
}
