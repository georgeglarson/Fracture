/**
 * Global type declarations for client-side TypeScript
 * Provides types for webpack's require functionality
 */

// Declare require for webpack's CommonJS require
declare function require(module: string): any;

// Declare require.context for webpack
declare namespace require {
  function context(
    directory: string,
    useSubdirectories?: boolean,
    regExp?: RegExp
  ): any;
}

// Declare module for JSON imports
declare module '*.json' {
  const value: any;
  export default value;
}
