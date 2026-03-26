/**
 * StateAuditLog - Ephemeral per-player ring buffer for state mutation forensics
 *
 * Captures before/after snapshots on every equipment, inventory, combat, and HP
 * mutation. Kept in memory; flushed to disk only on anomaly (death, disconnect,
 * bug report). Zero I/O cost during normal play.
 */

import { createModuleLogger } from './logger.js';
import * as fs from 'fs';
import * as path from 'path';

const log = createModuleLogger('StateAudit');

export type AuditDomain = 'equipment' | 'inventory' | 'combat' | 'hp';
export type FlushTrigger = 'death' | 'disconnect' | 'bug_report';

export interface AuditEntry {
  ts: number;
  domain: AuditDomain;
  action: string;
  before: unknown;
  after: unknown;
  meta?: Record<string, unknown>;
}

const DEFAULT_CAPACITY = 64;

export class StateAuditLog {
  private buffer: (AuditEntry | null)[];
  private head: number = 0;
  private count: number = 0;
  private readonly capacity: number;
  readonly playerId: number | string;
  playerName: string;

  constructor(playerId: number | string, playerName: string, capacity = DEFAULT_CAPACITY) {
    this.playerId = playerId;
    this.playerName = playerName;
    this.capacity = capacity;
    this.buffer = new Array(capacity).fill(null);
  }

  /**
   * Record a before/after snapshot. Hot path — no I/O.
   */
  record(domain: AuditDomain, action: string, before: unknown, after: unknown, meta?: Record<string, unknown>): void {
    this.buffer[this.head] = { ts: Date.now(), domain, action, before, after, meta };
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
  }

  /**
   * Flush ring buffer to disk. Called only on anomaly.
   */
  flush(trigger: FlushTrigger): void {
    if (this.count === 0) return;

    const entries = this.drain();
    const filename = `${this.playerId}-${Date.now()}.json`;
    const dir = path.resolve(process.cwd(), 'logs', 'audit');

    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, filename),
        JSON.stringify({
          playerId: this.playerId,
          playerName: this.playerName,
          trigger,
          flushedAt: new Date().toISOString(),
          entries
        }, null, 2)
      );
      log.info({ playerId: this.playerId, playerName: this.playerName, trigger, entryCount: entries.length, filename }, 'Audit log flushed');
      pruneAuditDir(dir);
    } catch (err) {
      log.error({ err, playerId: this.playerId }, 'Failed to flush audit log');
    }
  }

  /**
   * Return entries in chronological order and reset buffer.
   */
  private drain(): AuditEntry[] {
    const result: AuditEntry[] = [];
    const start = this.count < this.capacity ? 0 : this.head;
    for (let i = 0; i < this.count; i++) {
      const idx = (start + i) % this.capacity;
      if (this.buffer[idx]) result.push(this.buffer[idx]!);
    }
    this.head = 0;
    this.count = 0;
    this.buffer.fill(null);
    return result;
  }

  /**
   * Get current entry count (for testing).
   */
  getCount(): number {
    return this.count;
  }
}

// ============================================================================
// Snapshot helpers — shallow, allocation-light
// ============================================================================

export function snapEquipment(equipped: Map<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of equipped) out[k] = v;
  return out;
}

export function snapSlot(slot: { kind: number; count: number; properties?: unknown } | null): unknown {
  if (!slot) return null;
  return { kind: slot.kind, count: slot.count, hasProps: !!slot.properties };
}

// ============================================================================
// Log rotation — keep at most MAX_AUDIT_FILES, delete oldest by mtime
// ============================================================================

const MAX_AUDIT_FILES = 200;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function pruneAuditDir(dir: string): void {
  try {
    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const filePath = path.join(dir, f);
        const stat = fs.statSync(filePath);
        return { filePath, mtimeMs: stat.mtimeMs };
      })
      .sort((a, b) => a.mtimeMs - b.mtimeMs); // oldest first

    const now = Date.now();

    // Delete files older than MAX_AGE_MS or exceeding MAX_AUDIT_FILES
    const toDelete: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const tooOld = (now - files[i].mtimeMs) > MAX_AGE_MS;
      const tooMany = (files.length - toDelete.length) > MAX_AUDIT_FILES;
      if (tooOld || tooMany) {
        toDelete.push(files[i].filePath);
      } else {
        break; // sorted oldest-first, so remaining are newer and within count
      }
    }

    for (const filePath of toDelete) {
      fs.unlinkSync(filePath);
    }

    if (toDelete.length > 0) {
      log.debug({ deleted: toDelete.length, remaining: files.length - toDelete.length }, 'Pruned audit logs');
    }
  } catch (err) {
    log.debug({ err }, 'Audit log pruning failed (non-fatal)');
  }
}
