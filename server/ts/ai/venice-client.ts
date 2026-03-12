/**
 * Venice AI Client - Core API wrapper
 * Single Responsibility: Handle all Venice API communication
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

export class VeniceClient {
  private venice: VeniceAI;
  private model: string;
  private timeout: number;

  constructor(apiKey: string, options?: VeniceClientOptions) {
    this.venice = new VeniceAI({ apiKey });
    this.model = options?.model || 'llama-3.3-70b';
    this.timeout = options?.timeout || 5000;
  }

  /**
   * Make a call to the Venice AI API with timeout
   * @param prompt - The prompt to send
   * @param maxTokens - Maximum tokens in response (default 100)
   * @returns The response text or null on error/timeout
   */
  async call(prompt: string, maxTokens: number = 100): Promise<string | null> {
    return tracer.startActiveSpan('ai.venice', async (span) => {
      span.setAttributes({
        'ai.model': this.model,
        'ai.prompt_length': prompt.length,
        'ai.max_tokens': maxTokens,
      });

      const startMs = Date.now();
      try {
        // Wrap API call with timeout
        const apiCall = this.venice.chat.completions.create({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: maxTokens,
          temperature: 0.9,
          stream: false
        });

        const timeoutPromise = new Promise<null>((_, reject) => {
          setTimeout(() => reject(new Error(`Venice API timeout after ${this.timeout}ms`)), this.timeout);
        });

        const response = await Promise.race([apiCall, timeoutPromise]);

        span.setAttribute('ai.response_time_ms', Date.now() - startMs);

        const content = (response as any)?.choices?.[0]?.message?.content;
        if (content) {
          span.end();
          return this.cleanResponse(content);
        }
        span.end();
        return null;
      } catch (error: any) {
        span.setAttribute('ai.response_time_ms', Date.now() - startMs);
        span.setStatus({ code: SpanStatusCode.ERROR, message: error?.message || String(error) });
        span.end();
        log.error({ err: error }, 'Venice API error');
        return null;
      }
    });
  }

  /**
   * Clean and normalize API response text
   */
  private cleanResponse(content: any): string | null {
    let text: string;

    if (typeof content === 'string') {
      text = content;
    } else if (Array.isArray(content)) {
      // Extract text from ContentItem array
      text = content
        .filter((item: any) => item.type === 'text')
        .map((item: any) => item.text)
        .join('');
    } else {
      return null;
    }

    text = text.trim();

    // Remove surrounding quotes if present
    if (text.startsWith('"') && text.endsWith('"')) {
      text = text.slice(1, -1);
    }

    return text;
  }

  /**
   * Get the configured model name
   */
  getModel(): string {
    return this.model;
  }

  /**
   * Get the configured timeout
   */
  getTimeout(): number {
    return this.timeout;
  }
}
