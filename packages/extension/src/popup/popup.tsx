import { createRoot } from 'react-dom/client';

function Popup() {
  return <div>AccessibleAI — Loading...</div>;
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<Popup />);
}
