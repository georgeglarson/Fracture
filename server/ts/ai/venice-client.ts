/**
 * Venice AI Client - Core API wrapper
 * Single Responsibility: Handle all Venice API communication
 */

import { VeniceAI } from '@venice-dev-tools/core';

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
   * Make a call to the Venice AI API
   * @param prompt - The prompt to send
   * @param maxTokens - Maximum tokens in response (default 100)
   * @returns The response text or null on error
   */
  async call(prompt: string, maxTokens: number = 100): Promise<string | null> {
    try {
      const response = await this.venice.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.9,
        stream: false
      });

      const content = (response as any).choices?.[0]?.message?.content;
      if (content) {
        return this.cleanResponse(content);
      }
      return null;
    } catch (error) {
      console.error('Venice API error:', error);
      return null;
    }
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
