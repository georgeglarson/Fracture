/**
 * Tests for VeniceClient
 * Covers: basic calls, error classification via metrics, circuit breaker,
 *         retry logic, metrics snapshots, health check, response cleaning
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock VeniceAI SDK ───────────────────────────────────────────────
const mockCreate = vi.fn();

vi.mock('@venice-dev-tools/core', () => {
  function MockVeniceAI() {
    return {
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    };
  }
  return { VeniceAI: MockVeniceAI };
});

vi.mock('../utils/logger.js', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('@opentelemetry/api', () => {
  const mockSpan = {
    setAttributes: vi.fn(),
    setAttribute: vi.fn(),
    setStatus: vi.fn(),
    end: vi.fn(),
  };
  return {
    trace: {
      getTracer: () => ({
        startActiveSpan: (_name: string, fn: (span: any) => any) => fn(mockSpan),
      }),
    },
    SpanStatusCode: { ERROR: 2 },
  };
});

import { VeniceClient } from '../ai/venice-client';

// ── Helpers ─────────────────────────────────────────────────────────

/** Build a successful API response object */
function okResponse(text: string, tokens = 10) {
  return {
    choices: [{ message: { content: text } }],
    usage: { total_tokens: tokens },
  };
}

/** Build an error with an HTTP-like `status` field */
function httpError(message: string, status: number): Error & { status: number } {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

// ─────────────────────────────────────────────────────────────────────

describe('VeniceClient', () => {
  let client: VeniceClient;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    client = new VeniceClient('test-api-key', { model: 'test-model', timeout: 500 });
  });

  // ---------------------------------------------------------------
  // Basic call behaviour
  // ---------------------------------------------------------------
  describe('basic call', () => {
    it('should return cleaned text on a successful API response', async () => {
      mockCreate.mockResolvedValueOnce(okResponse('Hello adventurer!'));

      const result = await client.call('Greet me');

      expect(result).toBe('Hello adventurer!');
      expect(mockCreate).toHaveBeenCalledOnce();
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'test-model',
          messages: [{ role: 'user', content: 'Greet me' }],
          max_tokens: 100,
        }),
      );
    });

    it('should strip surrounding quotes from response', async () => {
      mockCreate.mockResolvedValueOnce(okResponse('"Quoted text"'));

      const result = await client.call('quote test');
      expect(result).toBe('Quoted text');
    });

    it('should handle array content (text blocks)', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{
          message: {
            content: [
              { type: 'text', text: 'Part one. ' },
              { type: 'image', data: '...' },
              { type: 'text', text: 'Part two.' },
            ],
          },
        }],
        usage: { total_tokens: 5 },
      });

      const result = await client.call('multi');
      expect(result).toBe('Part one. Part two.');
    });

    it('should return null when response has no content', async () => {
      mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: null } }] });

      const result = await client.call('empty');
      expect(result).toBeNull();
    });

    it('should return null when content is a non-string, non-array type', async () => {
      mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: 12345 } }] });

      const result = await client.call('bad content');
      expect(result).toBeNull();
    });

    it('should return null when choices array is empty', async () => {
      mockCreate.mockResolvedValueOnce({ choices: [] });

      const result = await client.call('empty choices');
      expect(result).toBeNull();
    });

    it('should use default maxTokens of 100', async () => {
      mockCreate.mockResolvedValueOnce(okResponse('ok'));

      await client.call('test');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ max_tokens: 100 }),
      );
    });

    it('should forward a custom maxTokens', async () => {
      mockCreate.mockResolvedValueOnce(okResponse('ok'));

      await client.call('test', 250);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ max_tokens: 250 }),
      );
    });

    it('should use default model and timeout when no options supplied', () => {
      const defaults = new VeniceClient('key');
      expect(defaults.getModel()).toBe('llama-3.3-70b');
      expect(defaults.getTimeout()).toBe(5000);
    });

    it('should return null on timeout', async () => {
      // Simulate a call that never resolves within the timeout window
      mockCreate.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(okResponse('late')), 10_000)),
      );

      vi.useFakeTimers();
      const callPromise = client.call('slow prompt');

      // Advance past the retry backoff (1s) + both attempt timeouts (500ms + 750ms)
      await vi.advanceTimersByTimeAsync(15_000);

      const result = await callPromise;
      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------
  // Error classification (tested through metrics)
  // ---------------------------------------------------------------
  describe('error classification', () => {
    it('should classify timeout errors', async () => {
      mockCreate.mockRejectedValue(new Error('Request timeout after 5000ms'));

      await client.call('t1');
      // Timeout is retryable so it will be called twice (initial + retry)
      const m = client.getMetrics();
      expect(m.timeoutCount).toBe(1);
      expect(m.lastErrorCategory).toBe('timeout');
    });

    it('should classify 401 as auth error', async () => {
      mockCreate.mockRejectedValue(httpError('Unauthorized', 401));

      await client.call('t2');
      const m = client.getMetrics();
      expect(m.authErrorCount).toBe(1);
      expect(m.lastErrorCategory).toBe('auth');
    });

    it('should classify 403 as auth error', async () => {
      mockCreate.mockRejectedValue(httpError('Forbidden', 403));

      await client.call('t3');
      const m = client.getMetrics();
      expect(m.authErrorCount).toBe(1);
    });

    it('should classify "authentication" message as auth', async () => {
      mockCreate.mockRejectedValue(new Error('Authentication failed'));

      await client.call('t3b');
      expect(client.getMetrics().authErrorCount).toBe(1);
    });

    it('should classify 429 as rate_limit', async () => {
      mockCreate.mockRejectedValue(httpError('Too Many Requests', 429));

      await client.call('t4');
      const m = client.getMetrics();
      expect(m.rateLimitCount).toBe(1);
      expect(m.lastErrorCategory).toBe('rate_limit');
    });

    it('should classify "rate" keyword in message as rate_limit', async () => {
      mockCreate.mockRejectedValue(new Error('rate limit exceeded'));

      await client.call('t4b');
      expect(client.getMetrics().rateLimitCount).toBe(1);
    });

    it('should classify 500 as server_error', async () => {
      mockCreate.mockRejectedValue(httpError('Internal Server Error', 500));

      await client.call('t5');
      const m = client.getMetrics();
      expect(m.serverErrorCount).toBe(1);
      expect(m.lastErrorCategory).toBe('server_error');
    });

    it('should classify 502 as server_error', async () => {
      mockCreate.mockRejectedValue(httpError('Bad Gateway', 502));

      await client.call('t5b');
      expect(client.getMetrics().serverErrorCount).toBe(1);
    });

    it('should classify ECONNREFUSED as network error', async () => {
      mockCreate.mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:443'));

      await client.call('t6');
      const m = client.getMetrics();
      expect(m.networkErrorCount).toBe(1);
      expect(m.lastErrorCategory).toBe('network');
    });

    it('should classify ENOTFOUND as network error', async () => {
      mockCreate.mockRejectedValue(new Error('getaddrinfo ENOTFOUND api.venice.ai'));

      await client.call('t6b');
      expect(client.getMetrics().networkErrorCount).toBe(1);
    });

    it('should classify "socket hang up" as network error', async () => {
      mockCreate.mockRejectedValue(new Error('socket hang up'));

      await client.call('t6c');
      expect(client.getMetrics().networkErrorCount).toBe(1);
    });

    it('should classify unknown errors as unknown', async () => {
      mockCreate.mockRejectedValue(new Error('Something completely unexpected'));

      await client.call('t7');
      const m = client.getMetrics();
      expect(m.unknownErrorCount).toBe(1);
      expect(m.lastErrorCategory).toBe('unknown');
    });
  });

  // ---------------------------------------------------------------
  // Circuit breaker
  // ---------------------------------------------------------------
  describe('circuit breaker', () => {
    async function failNTimes(n: number) {
      mockCreate.mockRejectedValue(httpError('Unauthorized', 401));
      for (let i = 0; i < n; i++) {
        await client.call(`fail-${i}`);
      }
    }

    it('should open after 5 consecutive failures', async () => {
      await failNTimes(5);

      const m = client.getMetrics();
      expect(m.circuitState).toBe('open');
      expect(m.circuitBreakerTrips).toBe(1);
    });

    it('should reject calls while open (returning null without API call)', async () => {
      await failNTimes(5);
      mockCreate.mockClear();

      const result = await client.call('should be rejected');

      expect(result).toBeNull();
      expect(mockCreate).not.toHaveBeenCalled();
      expect(client.getMetrics().circuitBreakerRejects).toBeGreaterThanOrEqual(1);
    });

    it('should transition to half-open after recovery period', async () => {
      vi.useFakeTimers();

      await failNTimes(5);
      expect(client.getMetrics().circuitState).toBe('open');

      // Advance past the 30s recovery window
      vi.advanceTimersByTime(30_001);

      // getMetrics checks getState() which auto-transitions open -> half-open
      expect(client.getMetrics().circuitState).toBe('half-open');
    });

    it('should close circuit on success in half-open state', async () => {
      vi.useFakeTimers();

      await failNTimes(5);
      vi.advanceTimersByTime(30_001);

      // Next call should be allowed (half-open) and succeed
      mockCreate.mockResolvedValueOnce(okResponse('recovered'));

      const result = await client.call('recovery probe');

      expect(result).toBe('recovered');
      expect(client.getMetrics().circuitState).toBe('closed');
    });

    it('should re-open circuit on failure in half-open state', async () => {
      vi.useFakeTimers();

      await failNTimes(5);
      vi.advanceTimersByTime(30_001);

      // Half-open probe fails — 500 is retryable so both attempts must reject
      mockCreate
        .mockRejectedValueOnce(httpError('Still down', 500))
        .mockRejectedValueOnce(httpError('Still down', 500));

      // Start the call (don't await yet — the retry backoff uses setTimeout)
      const callPromise = client.call('half-open probe');
      await vi.advanceTimersByTimeAsync(2000);

      await callPromise;

      // Should be open again (with a second trip counted)
      expect(client.getMetrics().circuitState).toBe('open');
      expect(client.getMetrics().circuitBreakerTrips).toBe(2);
    });

    it('should stay closed when failures are below threshold', async () => {
      await failNTimes(4);
      expect(client.getMetrics().circuitState).toBe('closed');
    });

    it('should count totalCalls even when circuit rejects', async () => {
      await failNTimes(5);
      const countAfterTrip = client.getMetrics().totalCalls;

      await client.call('rejected');
      expect(client.getMetrics().totalCalls).toBe(countAfterTrip + 1);
    });
  });

  // ---------------------------------------------------------------
  // Retry logic
  // ---------------------------------------------------------------
  describe('retry logic', () => {
    it('should retry once on timeout (retryable)', async () => {
      vi.useFakeTimers();
      mockCreate
        .mockRejectedValueOnce(new Error('Request timeout'))
        .mockResolvedValueOnce(okResponse('success after retry'));

      const callPromise = client.call('retry-timeout');

      // Advance past the 1s backoff
      await vi.advanceTimersByTimeAsync(1500);

      const result = await callPromise;
      expect(result).toBe('success after retry');
      expect(mockCreate).toHaveBeenCalledTimes(2);
      expect(client.getMetrics().retryCount).toBe(1);
    });

    it('should retry once on server_error (retryable)', async () => {
      vi.useFakeTimers();
      mockCreate
        .mockRejectedValueOnce(httpError('Internal Server Error', 500))
        .mockResolvedValueOnce(okResponse('recovered'));

      const callPromise = client.call('retry-500');
      await vi.advanceTimersByTimeAsync(1500);

      const result = await callPromise;
      expect(result).toBe('recovered');
      expect(mockCreate).toHaveBeenCalledTimes(2);
      expect(client.getMetrics().retryCount).toBe(1);
    });

    it('should retry once on network error (retryable)', async () => {
      vi.useFakeTimers();
      mockCreate
        .mockRejectedValueOnce(new Error('connect ECONNREFUSED'))
        .mockResolvedValueOnce(okResponse('back online'));

      const callPromise = client.call('retry-net');
      await vi.advanceTimersByTimeAsync(1500);

      const result = await callPromise;
      expect(result).toBe('back online');
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('should NOT retry auth errors', async () => {
      mockCreate.mockRejectedValueOnce(httpError('Unauthorized', 401));

      const result = await client.call('no-retry-auth');

      expect(result).toBeNull();
      expect(mockCreate).toHaveBeenCalledOnce();
      expect(client.getMetrics().retryCount).toBe(0);
    });

    it('should NOT retry rate_limit errors', async () => {
      mockCreate.mockRejectedValueOnce(httpError('Too Many Requests', 429));

      const result = await client.call('no-retry-ratelimit');

      expect(result).toBeNull();
      expect(mockCreate).toHaveBeenCalledOnce();
      expect(client.getMetrics().retryCount).toBe(0);
    });

    it('should NOT retry unknown errors', async () => {
      mockCreate.mockRejectedValueOnce(new Error('Mysterious failure'));

      const result = await client.call('no-retry-unknown');

      expect(result).toBeNull();
      expect(mockCreate).toHaveBeenCalledOnce();
      expect(client.getMetrics().retryCount).toBe(0);
    });

    it('should return null when retry also fails', async () => {
      vi.useFakeTimers();
      mockCreate
        .mockRejectedValueOnce(new Error('timeout attempt 1'))
        .mockRejectedValueOnce(new Error('timeout attempt 2'));

      const callPromise = client.call('both-fail');
      await vi.advanceTimersByTimeAsync(1500);

      const result = await callPromise;
      expect(result).toBeNull();
      expect(mockCreate).toHaveBeenCalledTimes(2);
      expect(client.getMetrics().retryCount).toBe(1);
      expect(client.getMetrics().failureCount).toBe(1);
    });
  });

  // ---------------------------------------------------------------
  // Metrics
  // ---------------------------------------------------------------
  describe('metrics', () => {
    it('should start with zeroed counts', () => {
      const m = client.getMetrics();
      expect(m.totalCalls).toBe(0);
      expect(m.successCount).toBe(0);
      expect(m.failureCount).toBe(0);
      expect(m.retryCount).toBe(0);
      expect(m.timeoutCount).toBe(0);
      expect(m.authErrorCount).toBe(0);
      expect(m.rateLimitCount).toBe(0);
      expect(m.serverErrorCount).toBe(0);
      expect(m.networkErrorCount).toBe(0);
      expect(m.unknownErrorCount).toBe(0);
      expect(m.circuitBreakerTrips).toBe(0);
      expect(m.circuitBreakerRejects).toBe(0);
      expect(m.circuitState).toBe('closed');
      expect(m.lastSuccessTime).toBeNull();
      expect(m.lastFailureTime).toBeNull();
      expect(m.lastError).toBeNull();
      expect(m.lastErrorCategory).toBeNull();
    });

    it('should increment success metrics after a good call', async () => {
      mockCreate.mockResolvedValueOnce(okResponse('hi'));

      await client.call('hello');

      const m = client.getMetrics();
      expect(m.totalCalls).toBe(1);
      expect(m.successCount).toBe(1);
      expect(m.failureCount).toBe(0);
      expect(m.lastSuccessTime).toBeTypeOf('number');
    });

    it('should increment failure metrics after a bad call', async () => {
      mockCreate.mockRejectedValueOnce(httpError('Unauthorized', 401));

      await client.call('bad');

      const m = client.getMetrics();
      expect(m.totalCalls).toBe(1);
      expect(m.successCount).toBe(0);
      expect(m.failureCount).toBe(1);
      expect(m.lastFailureTime).toBeTypeOf('number');
      expect(m.lastError).toContain('Unauthorized');
    });

    it('should accumulate counts across multiple calls', async () => {
      mockCreate
        .mockResolvedValueOnce(okResponse('a'))
        .mockResolvedValueOnce(okResponse('b'))
        .mockRejectedValueOnce(httpError('Unauthorized', 401));

      await client.call('1');
      await client.call('2');
      await client.call('3');

      const m = client.getMetrics();
      expect(m.totalCalls).toBe(3);
      expect(m.successCount).toBe(2);
      expect(m.failureCount).toBe(1);
      expect(m.authErrorCount).toBe(1);
    });

    it('should track latency (avg, p95, max)', async () => {
      mockCreate.mockResolvedValue(okResponse('fast'));

      await client.call('a');
      await client.call('b');
      await client.call('c');

      const m = client.getMetrics();
      expect(m.avgLatencyMs).toBeGreaterThanOrEqual(0);
      expect(m.p95LatencyMs).toBeGreaterThanOrEqual(0);
      expect(m.maxLatencyMs).toBeGreaterThanOrEqual(0);
      expect(m.maxLatencyMs).toBeGreaterThanOrEqual(m.avgLatencyMs);
    });

    it('should include startTime', () => {
      const m = client.getMetrics();
      expect(m.startTime).toBeTypeOf('number');
      expect(m.startTime).toBeLessThanOrEqual(Date.now());
    });
  });

  // ---------------------------------------------------------------
  // Health check
  // ---------------------------------------------------------------
  describe('healthCheck', () => {
    it('should return ok:true when API responds with content', async () => {
      mockCreate.mockResolvedValueOnce(okResponse('pong'));

      const result = await client.healthCheck();

      expect(result.ok).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.model).toBe('test-model');
      expect(result.circuitState).toBe('closed');
      expect(result.error).toBeUndefined();
    });

    it('should return ok:false with error info when API throws', async () => {
      mockCreate.mockRejectedValueOnce(httpError('Server Error', 503));

      const result = await client.healthCheck();

      expect(result.ok).toBe(false);
      expect(result.error).toContain('Server Error');
      expect(result.errorCategory).toBe('server_error');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.model).toBe('test-model');
    });

    it('should return ok:false with "Empty response" when content is missing', async () => {
      mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: null } }] });

      const result = await client.healthCheck();

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Empty response');
      expect(result.errorCategory).toBe('unknown');
    });

    it('should report circuit state from the breaker', async () => {
      // Trip the circuit
      mockCreate.mockRejectedValue(httpError('Unauthorized', 401));
      for (let i = 0; i < 5; i++) await client.call(`trip-${i}`);

      const result = await client.healthCheck();
      expect(result.circuitState).toBe('open');
    });

    it('should classify health check timeout error', async () => {
      mockCreate.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(okResponse('late')), 20_000)),
      );

      vi.useFakeTimers();
      const hcPromise = client.healthCheck();

      // Health check has a 10s timeout
      await vi.advanceTimersByTimeAsync(10_001);

      const result = await hcPromise;
      expect(result.ok).toBe(false);
      expect(result.errorCategory).toBe('timeout');
    });
  });
});
