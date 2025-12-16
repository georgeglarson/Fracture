/**
 * Tests for Rate Limiter middleware
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkRateLimit,
  authRateLimiter,
  shopRateLimiter,
  chatRateLimiter,
  checkAuthLimit,
  checkShopLimit,
  checkChatLimit,
} from '../middleware/rate-limiter';

describe('Rate Limiter', () => {
  describe('checkRateLimit', () => {
    it('should allow requests under the limit', async () => {
      const testKey = `test-${Date.now()}`;
      const result = await checkRateLimit(authRateLimiter, testKey);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeDefined();
    });

    it('should block requests over the limit', async () => {
      const testKey = `test-block-${Date.now()}`;

      // Exhaust the limit (5 for auth)
      for (let i = 0; i < 5; i++) {
        await checkRateLimit(authRateLimiter, testKey);
      }

      // 6th request should be blocked
      const result = await checkRateLimit(authRateLimiter, testKey);
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should track remaining points correctly', async () => {
      const testKey = `test-remaining-${Date.now()}`;

      const result1 = await checkRateLimit(authRateLimiter, testKey);
      expect(result1.remaining).toBe(4); // Started with 5, used 1

      const result2 = await checkRateLimit(authRateLimiter, testKey);
      expect(result2.remaining).toBe(3);
    });
  });

  describe('authRateLimiter', () => {
    it('should have 5 points limit', async () => {
      const testKey = `auth-${Date.now()}`;
      let allowed = 0;

      for (let i = 0; i < 10; i++) {
        const result = await checkAuthLimit(testKey);
        if (result.allowed) allowed++;
      }

      expect(allowed).toBe(5);
    });
  });

  describe('shopRateLimiter', () => {
    it('should have 10 points limit', async () => {
      const testKey = `shop-${Date.now()}`;
      let allowed = 0;

      for (let i = 0; i < 15; i++) {
        const result = await checkShopLimit(testKey);
        if (result.allowed) allowed++;
      }

      expect(allowed).toBe(10);
    });
  });

  describe('chatRateLimiter', () => {
    it('should have 5 points limit', async () => {
      const testKey = `chat-${Date.now()}`;
      let allowed = 0;

      for (let i = 0; i < 10; i++) {
        const result = await checkChatLimit(testKey);
        if (result.allowed) allowed++;
      }

      expect(allowed).toBe(5);
    });
  });

  describe('different keys are independent', () => {
    it('should not share limits between different keys', async () => {
      const key1 = `independent-1-${Date.now()}`;
      const key2 = `independent-2-${Date.now()}`;

      // Exhaust key1
      for (let i = 0; i < 5; i++) {
        await checkAuthLimit(key1);
      }

      // key2 should still work
      const result = await checkAuthLimit(key2);
      expect(result.allowed).toBe(true);
    });
  });
});
