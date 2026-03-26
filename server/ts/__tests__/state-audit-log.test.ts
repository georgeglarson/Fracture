import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StateAuditLog } from '../utils/state-audit-log';

// Mock fs at module level for ESM compatibility
vi.mock('fs', () => ({
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

import * as fs from 'fs';

describe('StateAuditLog', () => {
  let log: StateAuditLog;

  beforeEach(() => {
    log = new StateAuditLog(42, 'testplayer', 4);
    vi.clearAllMocks();
  });

  describe('ring buffer', () => {
    it('should record entries and track count', () => {
      log.record('equipment', 'equip', { before: 1 }, { after: 2 });
      expect(log.getCount()).toBe(1);
    });

    it('should wrap around at capacity', () => {
      for (let i = 0; i < 6; i++) {
        log.record('combat', `hit${i}`, { i }, { i: i + 1 });
      }
      // Capacity is 4, so only 4 entries retained
      expect(log.getCount()).toBe(4);
    });

    it('should not flush when empty', () => {
      log.flush('disconnect');
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });

    it('should flush entries in chronological order', () => {
      // Fill past capacity to test wrap-around ordering
      log.record('combat', 'hit0', {}, {});
      log.record('combat', 'hit1', {}, {});
      log.record('combat', 'hit2', {}, {});
      log.record('combat', 'hit3', {}, {});
      log.record('combat', 'hit4', {}, {}); // overwrites hit0
      log.record('combat', 'hit5', {}, {}); // overwrites hit1

      log.flush('death');

      expect(fs.writeFileSync).toHaveBeenCalledOnce();
      const written = JSON.parse((fs.writeFileSync as any).mock.calls[0][1]);
      expect(written.trigger).toBe('death');
      expect(written.playerName).toBe('testplayer');
      expect(written.entries).toHaveLength(4);
      // Should be chronological: hit2, hit3, hit4, hit5
      expect(written.entries[0].action).toBe('hit2');
      expect(written.entries[3].action).toBe('hit5');
    });

    it('should reset buffer after flush', () => {
      log.record('equipment', 'equip', {}, {});
      log.flush('disconnect');
      expect(log.getCount()).toBe(0);
    });

    it('should store domain, action, before, after, and meta', () => {
      log.record('hp', 'hurt', { hp: 100 }, { hp: 85 }, { mobId: 7, dmg: 15 });
      log.flush('death');

      const written = JSON.parse((fs.writeFileSync as any).mock.calls[0][1]);
      const entry = written.entries[0];
      expect(entry.domain).toBe('hp');
      expect(entry.action).toBe('hurt');
      expect(entry.before).toEqual({ hp: 100 });
      expect(entry.after).toEqual({ hp: 85 });
      expect(entry.meta).toEqual({ mobId: 7, dmg: 15 });
      expect(entry.ts).toBeTypeOf('number');
    });
  });
});
