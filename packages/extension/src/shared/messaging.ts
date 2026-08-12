import type { ComplianceScore, ProcessedAuditResult, StandardId, ViolationNode } from './types';

export type Message = { type: string };

export function sendMessage<TResponse = unknown>(message: Message): Promise<TResponse> {
  return chrome.runtime.sendMessage(message);
}

export interface StartAuditMessage {
  type: 'START_AUDIT';
  standard: StandardId;
}

export interface AuditCompleteMessage {
  type: 'AUDIT_COMPLETE';
  result: ProcessedAuditResult;
  score: ComplianceScore;
}

export interface AuditErrorMessage {
  type: 'AUDIT_ERROR';
  error: string;
}

export interface ShowOverlayMessage {
  type: 'SHOW_OVERLAY';
  violations: ViolationNode[];
  score: number;
  violationCount: number;
}

export interface HighlightSingleMessage {
  type: 'HIGHLIGHT_SINGLE';
  cssSelector: string;
}

export interface ClearOverlayMessage {
  type: 'CLEAR_OVERLAY';
}

export type ExtensionMessage =
  | StartAuditMessage
  | AuditCompleteMessage
  | AuditErrorMessage
  | ShowOverlayMessage
  | HighlightSingleMessage
  | ClearOverlayMessage;
