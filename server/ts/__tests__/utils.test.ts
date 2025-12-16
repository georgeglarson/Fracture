/**
 * Tests for Utils class
 * Covers: sanitization, random functions, clamp, distance calculation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Utils } from '../utils';

describe('Utils', () => {
  describe('sanitize', () => {
    it('should escape HTML entities', () => {
      const result = Utils.sanitize('<script>alert("xss")</script>');
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('</script>');
    });

    it('should handle normal text unchanged', () => {
      const result = Utils.sanitize('Hello World');
      expect(result).toBe('Hello World');
    });

    it('should escape ampersands', () => {
      const result = Utils.sanitize('A & B');
      expect(result).toContain('&amp;');
    });

    it('should escape quotes', () => {
      const result = Utils.sanitize('Say "hello"');
      // sanitizer uses numeric entity &#34; instead of &quot;
      expect(result).toContain('&#34;');
    });

    it('should handle empty string', () => {
      expect(Utils.sanitize('')).toBe('');
    });
  });

  describe('random', () => {
    it('should return values in range [0, range)', () => {
      // Run multiple times to check range
      for (let i = 0; i < 100; i++) {
        const result = Utils.random(10);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThan(10);
        expect(Number.isInteger(result)).toBe(true);
      }
    });

    it('should return 0 for range of 1', () => {
      expect(Utils.random(1)).toBe(0);
    });
  });

  describe('randomRange', () => {
    it('should return values in range [min, max)', () => {
      for (let i = 0; i < 100; i++) {
        const result = Utils.randomRange(5, 10);
        expect(result).toBeGreaterThanOrEqual(5);
        expect(result).toBeLessThan(10);
      }
    });

    it('should return min when min equals max', () => {
      const result = Utils.randomRange(5, 5);
      expect(result).toBe(5);
    });

    it('should work with negative numbers', () => {
      for (let i = 0; i < 100; i++) {
        const result = Utils.randomRange(-10, -5);
        expect(result).toBeGreaterThanOrEqual(-10);
        expect(result).toBeLessThan(-5);
      }
    });
  });

  describe('randomInt', () => {
    it('should return integers in range [min, max] inclusive', () => {
      const results = new Set<number>();
      for (let i = 0; i < 1000; i++) {
        const result = Utils.randomInt(1, 5);
        results.add(result);
        expect(result).toBeGreaterThanOrEqual(1);
        expect(result).toBeLessThanOrEqual(5);
        expect(Number.isInteger(result)).toBe(true);
      }
      // Should eventually hit all values 1-5
      expect(results.size).toBe(5);
    });

    it('should return the only value when min equals max', () => {
      expect(Utils.randomInt(5, 5)).toBe(5);
    });

    it('should work with zero', () => {
      for (let i = 0; i < 100; i++) {
        const result = Utils.randomInt(0, 3);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(3);
      }
    });
  });

  describe('clamp', () => {
    it('should return value when within range', () => {
      expect(Utils.clamp(0, 100, 50)).toBe(50);
    });

    it('should return min when value is below min', () => {
      expect(Utils.clamp(0, 100, -10)).toBe(0);
    });

    it('should return max when value is above max', () => {
      expect(Utils.clamp(0, 100, 150)).toBe(100);
    });

    it('should handle edge cases at boundaries', () => {
      expect(Utils.clamp(0, 100, 0)).toBe(0);
      expect(Utils.clamp(0, 100, 100)).toBe(100);
    });

    it('should work with negative ranges', () => {
      expect(Utils.clamp(-100, -50, -75)).toBe(-75);
      expect(Utils.clamp(-100, -50, -200)).toBe(-100);
      expect(Utils.clamp(-100, -50, 0)).toBe(-50);
    });

    it('should work with floating point numbers', () => {
      expect(Utils.clamp(0.5, 1.5, 1.0)).toBe(1.0);
      expect(Utils.clamp(0.5, 1.5, 0.2)).toBe(0.5);
    });
  });

  describe('distanceTo', () => {
    it('should return 0 when points are the same', () => {
      expect(Utils.distanceTo(5, 5, 5, 5)).toBe(0);
    });

    it('should return horizontal distance when larger than vertical', () => {
      expect(Utils.distanceTo(0, 0, 10, 3)).toBe(10);
    });

    it('should return vertical distance when larger than horizontal', () => {
      expect(Utils.distanceTo(0, 0, 3, 10)).toBe(10);
    });

    it('should handle negative coordinates', () => {
      expect(Utils.distanceTo(-5, -5, 5, 5)).toBe(10);
    });

    it('should be symmetric', () => {
      const d1 = Utils.distanceTo(0, 0, 5, 3);
      const d2 = Utils.distanceTo(5, 3, 0, 0);
      expect(d1).toBe(d2);
    });

    it('should use Chebyshev distance (max of x/y distance)', () => {
      // Diagonal of 5,5 should be 5, not ~7 (euclidean)
      expect(Utils.distanceTo(0, 0, 5, 5)).toBe(5);
    });
  });

  describe('randomOrientation', () => {
    it('should return valid orientations', () => {
      const validOrientations = [1, 2, 3, 4]; // LEFT, RIGHT, UP, DOWN from Types
      for (let i = 0; i < 100; i++) {
        const result = Utils.randomOrientation();
        expect(validOrientations).toContain(result);
      }
    });
  });

  describe('Mixin', () => {
    it('should copy properties from source to target', () => {
      const target = { a: 1 };
      const source = { b: 2, c: 3 };
      const result = Utils.Mixin(target, source);

      expect(result).toBe(target);
      expect(result.a).toBe(1);
      expect(result.b).toBe(2);
      expect(result.c).toBe(3);
    });

    it('should override existing properties', () => {
      const target = { a: 1 };
      const source = { a: 2 };
      Utils.Mixin(target, source);

      expect(target.a).toBe(2);
    });

    it('should handle null/undefined source', () => {
      const target = { a: 1 };
      Utils.Mixin(target, null as any);
      Utils.Mixin(target, undefined as any);

      expect(target.a).toBe(1);
    });

    it('should return target unchanged for empty source', () => {
      const target = { a: 1 };
      const result = Utils.Mixin(target, {});

      expect(result).toBe(target);
      expect(Object.keys(result)).toEqual(['a']);
    });
  });
});
