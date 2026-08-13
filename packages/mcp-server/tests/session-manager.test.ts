import { describe, expect, it, vi } from 'vitest';
import { SessionManager } from '../src/session/session-manager';

describe('SessionManager', () => {
  it('creates a session and retrieves it by ID', () => {
    const sessions = new SessionManager();
    const id = sessions.createSession({ standard: 'ada' });
    const session = sessions.getSession(id);

    expect(session).toBeDefined();
    expect(session?.config.standard).toBe('ada');
    expect(session?.id).toBe(id);
  });

  it('returns undefined for an unknown session ID', () => {
    const sessions = new SessionManager();
    expect(sessions.getSession('nonexistent')).toBeUndefined();
  });

  it('updates a session in place', () => {
    const sessions = new SessionManager();
    const id = sessions.createSession({ standard: 'ada' });
    sessions.updateSession(id, { deepAnalysis: undefined });
    const updated = sessions.updateSession(id, {
      resolvedStandard: undefined,
    });
    expect(updated?.id).toBe(id);
  });

  it('deletes a session', () => {
    const sessions = new SessionManager();
    const id = sessions.createSession({ standard: 'ada' });
    sessions.deleteSession(id);
    expect(sessions.getSession(id)).toBeUndefined();
  });

  it('evicts sessions older than the TTL', () => {
    vi.useFakeTimers();
    const sessions = new SessionManager();
    const id = sessions.createSession({ standard: 'ada' });
    expect(sessions.getSession(id)).toBeDefined();

    vi.advanceTimersByTime(61 * 60 * 1000);

    expect(sessions.getSession(id)).toBeUndefined();
    vi.useRealTimers();
  });

  it('reports the number of active sessions', () => {
    const sessions = new SessionManager();
    expect(sessions.size()).toBe(0);
    sessions.createSession({ standard: 'ada' });
    sessions.createSession({ standard: 'section-508' });
    expect(sessions.size()).toBe(2);
  });
});
