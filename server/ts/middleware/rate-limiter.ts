/**
 * Rate Limiting Middleware
 *
 * Protects against brute force attacks and abuse.
 * Uses in-memory storage (Redis-ready for horizontal scaling).
 */

import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('RateLimiter');

// ============================================================================
// RATE LIMITERS
// ============================================================================

/**
 * Authentication rate limiter
 * Prevents brute force login attempts
 * 5 attempts per minute per IP
 */
export const authRateLimiter = new RateLimiterMemory({
  keyPrefix: 'auth',
  points: 5,          // 5 attempts
  duration: 60,       // per 60 seconds
  blockDuration: 60,  // block for 60 seconds if exceeded
});

/**
 * Shop transaction rate limiter
 * Prevents shop abuse
 * 10 transactions per minute per player
 */
export const shopRateLimiter = new RateLimiterMemory({
  keyPrefix: 'shop',
  points: 10,         // 10 transactions
  duration: 60,       // per 60 seconds
  blockDuration: 30,  // block for 30 seconds if exceeded
});

/**
 * Chat/message rate limiter
 * Prevents spam
 * 5 messages per 10 seconds per player
 */
export const chatRateLimiter = new RateLimiterMemory({
  keyPrefix: 'chat',
  points: 5,          // 5 messages
  duration: 10,       // per 10 seconds
  blockDuration: 10,  // block for 10 seconds if exceeded
});

/**
 * Combat action rate limiter
 * Prevents HIT spam
 * 20 hits per second per player (generous for fast clicking)
 */
export const combatRateLimiter = new RateLimiterMemory({
  keyPrefix: 'combat',
  points: 20,         // 20 hits
  duration: 1,        // per 1 second
  blockDuration: 1,   // block for 1 second if exceeded
});

/**
 * General message flood protection
 * Prevents any message flood
 * 100 messages per second per connection
 */
export const floodRateLimiter = new RateLimiterMemory({
  keyPrefix: 'flood',
  points: 100,        // 100 messages
  duration: 1,        // per 1 second
  blockDuration: 5,   // block for 5 seconds if exceeded
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
  remaining?: number;
}

/**
 * Check rate limit and consume a point
 * @returns Result with allowed status and retry info
 */
export async function checkRateLimit(
  limiter: RateLimiterMemory,
  key: string
): Promise<RateLimitResult> {
  try {
    const result = await limiter.consume(key);
    return {
      allowed: true,
      remaining: result.remainingPoints,
    };
  } catch (error) {
    if (error instanceof RateLimiterRes) {
      const retryAfter = Math.ceil(error.msBeforeNext / 1000);
      log.warn(
        { key, retryAfter, limiter: limiter.keyPrefix },
        'Rate limit exceeded'
      );
      return {
        allowed: false,
        retryAfter,
        remaining: 0,
      };
    }
    // Unexpected error - fail closed for safety
    log.error({ error, key }, 'Rate limiter error');
    return { allowed: false, retryAfter: 1, remaining: 0 };
  }
}

/**
 * Get rate limit status without consuming a point
 */
export async function getRateLimitStatus(
  limiter: RateLimiterMemory,
  key: string
): Promise<{ remaining: number; resetIn: number } | null> {
  try {
    const result = await limiter.get(key);
    if (result) {
      return {
        remaining: result.remainingPoints,
        resetIn: Math.ceil(result.msBeforeNext / 1000),
      };
    }
    return null;
  } catch (err) {
    log.debug({ err }, 'Rate limit status check failed');
    return null;
  }
}

/**
 * Reset rate limit for a key (e.g., after successful auth)
 */
export async function resetRateLimit(
  limiter: RateLimiterMemory,
  key: string
): Promise<void> {
  try {
    await limiter.delete(key);
  } catch (err) {
    log.debug({ err }, 'Rate limit reset failed');
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Check authentication rate limit by IP
 */
export function checkAuthLimit(ip: string): Promise<RateLimitResult> {
  return checkRateLimit(authRateLimiter, ip);
}

/**
 * Check shop rate limit by player ID
 */
export function checkShopLimit(playerId: number | string): Promise<RateLimitResult> {
  return checkRateLimit(shopRateLimiter, String(playerId));
}

/**
 * Check chat rate limit by player ID
 */
export function checkChatLimit(playerId: number | string): Promise<RateLimitResult> {
  return checkRateLimit(chatRateLimiter, String(playerId));
}

/**
 * Check combat rate limit by player ID
 */
export function checkCombatLimit(playerId: number | string): Promise<RateLimitResult> {
  return checkRateLimit(combatRateLimiter, String(playerId));
}

/**
 * Check flood rate limit by connection ID
 */
export function checkFloodLimit(connectionId: string): Promise<RateLimitResult> {
  return checkRateLimit(floodRateLimiter, connectionId);
}
