// Module declarations for packages without type definitions
declare module 'sanitizer' {
  export function sanitize(input: string): string;
  export function escape(input: string): string;
}

declare module 'memcache' {
  export class Client {
    constructor(port: number, host: string);
    connect(): void;
    on(event: string, callback: (...args: any[]) => void): void;
    set(key: string, value: any, callback?: () => void): void;
    get(key: string, callback: (error: any, result: any) => void): void;
  }
}

declare module 'express' {
  const express: any;
  export = express;
}
