// Module declarations for packages without type definitions
declare module 'memcache' {
  export class Client {
    constructor(port: number, host: string);
    connect(): void;
    on(event: string, callback: (...args: unknown[]) => void): void;
    set(key: string, value: unknown, callback?: () => void): void;
    get(key: string, callback: (error: Error | null, result: string | null) => void): void;
  }
}

// Express types - use existing @types/express from package
// No custom declaration needed as express types are provided by the package
