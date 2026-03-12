/**
 * Venice AI Client - Core API wrapper with observability and resilience
 *
 * Features:
 * - Call metrics: success/failure counts, latency histogram, error categorization
 * - Circuit breaker: stops hammering a broken API, auto-recovers
 * - Retry with backoff: retries transient failures (timeouts, 5xx)
 * - Diagnostic snapshot: full API health state for debug CLI
 */

import { VeniceAI } from '@venice-dev-tools/core';
import { createModuleLogger } from '../utils/logger.js';
import { trace, SpanStatusCode } from '@opentelemetry/api';

const log = createModuleLogger('VeniceClient');
const tracer = trace.getTracer('fracture-server');

export interface VeniceClientOptions {
  model?: string;
  timeout?: number;
}

// ─── Error Classification ────────────────────────────────────

type ErrorCategory = 'timeout' | 'auth' | 'rate_limit' | 'server_error' | 'network' | 'unknown';

function classifyError(error: any): ErrorCategory {
  const msg = (error?.message || String(error)).toLowerCase();
  const status = error?.status || error?.response?.status;

  if (msg.includes('timeout')) return 'timeout';
  if (msg.includes('authentication') || msg.includes('unauthorized') || status === 401 || status === 403) return 'auth';
  if (msg.includes('rate') || msg.includes('too many') || status === 429) return 'rate_limit';
  if (status >= 500 && status < 600) return 'server_error';
  if (msg.includes('econnrefused') || msg.includes('enotfound') || msg.includes('socket hang up') || msg.includes('network')) return 'network';
  return 'unknown';
}

function isRetryable(category: ErrorCategory): boolean {
  return category === 'timeout' || category === 'server_error' || category === 'network';
}

// ─── Metrics ─────────────────────────────────────────────────

export interface VeniceMetrics {
  totalCalls: number;
  successCount: number;
  failureCount: number;
  timeoutCount: number;
  authErrorCount: number;
  rateLimitCount: number;
  serverErrorCount: number;
  networkErrorCount: number;
  unknownErrorCount: number;
  retryCount: number;
  circuitBreakerTrips: number;
  circuitBreakerRejects: number;
  // Latency tracking (exponentially decayed moving averages)
  avgLatencyMs: number;
  p95LatencyMs: number;
  maxLatencyMs: number;
  lastSuccessTime: number | null;
  lastFailureTime: number | null;
  lastError: string | null;
  lastErrorCategory: ErrorCategory | null;
  // Uptime
  startTime: number;
  // Circuit breaker state
  circuitState: 'closed' | 'open' | 'half-open';
}

// ─── Circuit Breaker ─────────────────────────────────────────

interface CircuitBreakerConfig {
  failureThreshold: number;    // failures before opening (default 5)
  recoveryTimeMs: number;      // ms before trying again (default 30s)
  halfOpenMaxAttempts: number;  // test calls in half-open (default 2)
}

class CircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failureCount = 0;
  private lastFailureTime = 0;
  private halfOpenAttempts = 0;
  tripCount = 0;
  rejectCount = 0;

  constructor(private config: CircuitBreakerConfig) {}

  canExecute(): boolean {
    if (this.state === 'closed') return true;

    if (this.state === 'open') {
      // Check if recovery time has passed
      if (Date.now() - this.lastFailureTime >= this.config.recoveryTimeMs) {
        this.state = 'half-open';
        this.halfOpenAttempts = 0;
        log.info('Circuit breaker entering half-open state');
        return true;
      }
      this.rejectCount++;
      return false;
    }

    // half-open: allow limited attempts
    if (this.halfOpenAttempts < this.config.halfOpenMaxAttempts) {
      this.halfOpenAttempts++;
      return true;
    }
    this.rejectCount++;
    return false;
  }

  recordSuccess(): void {
    if (this.state === 'half-open') {
      log.info('Circuit breaker closing — API recovered');
    }
    this.state = 'closed';
    this.failureCount = 0;
    this.halfOpenAttempts = 0;
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'half-open') {
      // Failed during recovery test — reopen
      this.state = 'open';
      this.tripCount++;
      log.warn({ recoveryTimeMs: this.config.recoveryTimeMs }, 'Circuit breaker re-opened — half-open test failed');
      return;
    }

    if (this.failureCount >= this.config.failureThreshold) {
      this.state = 'open';
      this.tripCount++;
      log.warn({ failures: this.failureCount, recoveryTimeMs: this.config.recoveryTimeMs }, 'Circuit breaker opened');
    }
  }

  getState(): 'closed' | 'open' | 'half-open' {
    // Check for auto-transition from open to half-open
    if (this.state === 'open' && Date.now() - this.lastFailureTime >= this.config.recoveryTimeMs) {
      return 'half-open';
    }
    return this.state;
  }
}

// ─── Latency Tracker ─────────────────────────────────────────

class LatencyTracker {
  private samples: number[] = [];
  private static readonly MAX_SAMPLES = 100;

  record(ms: number): void {
    this.samples.push(ms);
    if (this.samples.length > LatencyTracker.MAX_SAMPLES) {
      this.samples.shift();
    }
  }

  getAvg(): number {
    if (this.samples.length === 0) return 0;
    return Math.round(this.samples.reduce((a, b) => a + b, 0) / this.samples.length);
  }

  getP95(): number {
    if (this.samples.length === 0) return 0;
    const sorted = [...this.samples].sort((a, b) => a - b);
    const idx = Math.ceil(sorted.length * 0.95) - 1;
    return sorted[idx];
  }

  getMax(): number {
    if (this.samples.length === 0) return 0;
    return Math.max(...this.samples);
  }
}

// ─── Venice Client ───────────────────────────────────────────

export class VeniceClient {
  private venice: VeniceAI;
  private model: string;
  private timeout: number;

  // Metrics
  private totalCalls = 0;
  private successCount = 0;
  private failureCount = 0;
  private errorCounts: Record<ErrorCategory, number> = {
    timeout: 0, auth: 0, rate_limit: 0, server_error: 0, network: 0, unknown: 0
  };
  private retryCount = 0;
  private lastSuccessTime: number | null = null;
  private lastFailureTime: number | null = null;
  private lastError: string | null = null;
  private lastErrorCategory: ErrorCategory | null = null;
  private startTime = Date.now();

  // Resilience
  private circuitBreaker: CircuitBreaker;
  private latency = new LatencyTracker();

  constructor(apiKey: string, options?: VeniceClientOptions) {
    this.venice = new VeniceAI({ apiKey });
    this.model = options?.model || 'llama-3.3-70b';
    this.timeout = options?.timeout || 5000;

    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      recoveryTimeMs: 30_000,
      halfOpenMaxAttempts: 2,
    });

    log.info({ model: this.model, timeout: this.timeout }, 'Venice client initialized');
  }

  /**
   * Make a call to the Venice AI API with timeout, retry, and circuit breaker
   */
  async call(prompt: string, maxTokens: number = 100): Promise<string | null> {
    this.totalCalls++;

    // Circuit breaker check
    if (!this.circuitBreaker.canExecute()) {
      log.debug('Venice call rejected — circuit breaker open');
      return null;
    }

    return tracer.startActiveSpan('ai.venice', async (span) => {
      span.setAttributes({
        'ai.model': this.model,
        'ai.prompt_length': prompt.length,
        'ai.max_tokens': maxTokens,
        'ai.circuit_state': this.circuitBreaker.getState(),
      });

      // Try with one retry for retryable errors
      const maxAttempts = 2;
      let lastError: any = null;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const startMs = Date.now();
        const attemptTimeout = attempt === 1 ? this.timeout : this.timeout * 1.5; // longer timeout on retry

        try {
          const apiCall = this.venice.chat.completions.create({
            model: this.model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: maxTokens,
            temperature: 0.9,
            stream: false
          });

          const timeoutPromise = new Promise<null>((_, reject) => {
            setTimeout(() => reject(new Error(`Venice API timeout after ${attemptTimeout}ms`)), attemptTimeout);
          });

          const response = await Promise.race([apiCall, timeoutPromise]);
          const elapsed = Date.now() - startMs;

          // Success
          this.latency.record(elapsed);
          this.successCount++;
          this.lastSuccessTime = Date.now();
          this.circuitBreaker.recordSuccess();

          span.setAttributes({
            'ai.response_time_ms': elapsed,
            'ai.attempt': attempt,
            'ai.success': true,
          });

          const content = (response as any)?.choices?.[0]?.message?.content;
          if (content) {
            const tokens = (response as any)?.usage?.total_tokens;
            if (tokens) span.setAttribute('ai.total_tokens', tokens);

            span.end();
            log.debug({ elapsed, attempt, tokens, promptLen: prompt.length }, 'Venice API success');
            return this.cleanResponse(content);
          }

          span.end();
          return null;

        } catch (error: any) {
          const elapsed = Date.now() - startMs;
          lastError = error;

          const category = classifyError(error);
          const errMsg = error?.message || String(error);

          // Log with full context
          log.warn({
            errMsg,
            category,
            attempt,
            maxAttempts,
            elapsed,
            status: error?.status || error?.response?.status,
          }, `Venice API ${category} (attempt ${attempt}/${maxAttempts})`);

          // Retry only for retryable errors and not last attempt
          if (attempt < maxAttempts && isRetryable(category)) {
            this.retryCount++;
            const backoff = attempt * 1000; // 1s, 2s, etc.
            log.info({ backoff, category }, 'Retrying Venice API call');
            await new Promise(r => setTimeout(r, backoff));
            continue;
          }

          // Final failure
          this.failureCount++;
          this.errorCounts[category]++;
          this.lastFailureTime = Date.now();
          this.lastError = errMsg;
          this.lastErrorCategory = category;
          this.latency.record(elapsed);
          this.circuitBreaker.recordFailure();

          span.setAttributes({
            'ai.response_time_ms': elapsed,
            'ai.attempt': attempt,
            'ai.success': false,
            'ai.error_category': category,
            'ai.error_message': errMsg.substring(0, 200),
          });
          span.setStatus({ code: SpanStatusCode.ERROR, message: errMsg });
          span.end();

          return null;
        }
      }

      // Should not reach here
      span.end();
      return null;
    });
  }

  /**
   * Quick connectivity check — calls the Venice API with minimal payload
   * Returns diagnostic info, not just pass/fail
   */
  async healthCheck(): Promise<{
    ok: boolean;
    latencyMs: number;
    error?: string;
    errorCategory?: ErrorCategory;
    circuitState: string;
    model: string;
  }> {
    const start = Date.now();
    try {
      const response = await Promise.race([
        this.venice.chat.completions.create({
          model: this.model,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
          stream: false
        }),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('Health check timeout (10s)')), 10_000)
        ),
      ]);

      const latencyMs = Date.now() - start;
      const hasContent = !!(response as any)?.choices?.[0]?.message?.content;
      return {
        ok: hasContent,
        latencyMs,
        circuitState: this.circuitBreaker.getState(),
        model: this.model,
        ...(!hasContent ? { error: 'Empty response', errorCategory: 'unknown' as ErrorCategory } : {}),
      };
    } catch (error: any) {
      const latencyMs = Date.now() - start;
      const category = classifyError(error);
      return {
        ok: false,
        latencyMs,
        error: error?.message || String(error),
        errorCategory: category,
        circuitState: this.circuitBreaker.getState(),
        model: this.model,
      };
    }
  }

  /**
   * Full metrics snapshot for debug CLI and dashboards
   */
  getMetrics(): VeniceMetrics {
    const uptime = Date.now() - this.startTime;
    return {
      totalCalls: this.totalCalls,
      successCount: this.successCount,
      failureCount: this.failureCount,
      timeoutCount: this.errorCounts.timeout,
      authErrorCount: this.errorCounts.auth,
      rateLimitCount: this.errorCounts.rate_limit,
      serverErrorCount: this.errorCounts.server_error,
      networkErrorCount: this.errorCounts.network,
      unknownErrorCount: this.errorCounts.unknown,
      retryCount: this.retryCount,
      circuitBreakerTrips: this.circuitBreaker.tripCount,
      circuitBreakerRejects: this.circuitBreaker.rejectCount,
      avgLatencyMs: this.latency.getAvg(),
      p95LatencyMs: this.latency.getP95(),
      maxLatencyMs: this.latency.getMax(),
      lastSuccessTime: this.lastSuccessTime,
      lastFailureTime: this.lastFailureTime,
      lastError: this.lastError,
      lastErrorCategory: this.lastErrorCategory,
      startTime: this.startTime,
      circuitState: this.circuitBreaker.getState(),
    };
  }

  /**
   * Clean and normalize API response text
   */
  private cleanResponse(content: any): string | null {
    let text: string;

    if (typeof content === 'string') {
      text = content;
    } else if (Array.isArray(content)) {
      text = content
        .filter((item: any) => item.type === 'text')
        .map((item: any) => item.text)
        .join('');
    } else {
      return null;
    }

    text = text.trim();
    if (text.startsWith('"') && text.endsWith('"')) {
      text = text.slice(1, -1);
    }

    return text;
  }

  getModel(): string { return this.model; }
  getTimeout(): number { return this.timeout; }
}
