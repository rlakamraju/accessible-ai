import { clearOverlay, highlightSingle, highlightViolations, showBadge } from './overlay';
import type { ExtensionMessage } from '../shared/messaging';

console.log('AccessibleAI content script loaded');

chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
  switch (message.type) {
    case 'SHOW_OVERLAY':
      highlightViolations(message.violations);
      showBadge(message.score, message.violationCount);
      break;
    case 'HIGHLIGHT_SINGLE':
      highlightSingle(message.cssSelector);
      break;
    case 'CLEAR_OVERLAY':
      clearOverlay();
      break;
    default:
      break;
  }
});
