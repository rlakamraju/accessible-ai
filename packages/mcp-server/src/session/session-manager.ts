import { randomUUID } from 'node:crypto';
import type { AuditSession, AuditConfig } from '../config/types.js';

const SESSION_TTL_MS = 60 * 60 * 1000;

/** In-memory registry of audit sessions, keyed by session ID. Auto-evicts sessions older than one hour. */
export class SessionManager {
  private sessions = new Map<string, AuditSession>();

  createSession(config: AuditConfig): string {
    this.evictExpired();
    const id = randomUUID();
    this.sessions.set(id, {
      id,
      config,
      createdAt: Date.now(),
    });
    return id;
  }

  getSession(id: string): AuditSession | undefined {
    this.evictExpired();
    return this.sessions.get(id);
  }

  updateSession(id: string, patch: Partial<Omit<AuditSession, 'id' | 'createdAt'>>): AuditSession | undefined {
    const session = this.getSession(id);
    if (!session) return undefined;
    Object.assign(session, patch);
    return session;
  }

  deleteSession(id: string): void {
    this.sessions.delete(id);
  }

  size(): number {
    this.evictExpired();
    return this.sessions.size;
  }

  private evictExpired(): void {
    const cutoff = Date.now() - SESSION_TTL_MS;
    for (const [id, session] of this.sessions) {
      if (session.createdAt < cutoff) this.sessions.delete(id);
    }
  }
}
