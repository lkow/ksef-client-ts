/**
 * Type declarations for saxon-js
 */

declare module 'saxon-js' {
  export interface TransformOptions {
    stylesheetLocation?: string;
    stylesheetText?: string;
    stylesheetInternal?: any;
    sourceText?: string;
    sourceLocation?: string;
    destination?: 'serialized' | 'dom';
    outputProperties?: Record<string, string | boolean>;
  }

  export interface TransformResult {
    principalResult: string;
    resultDocuments?: Record<string, string>;
  }

  export interface SaxonJS {
    transform: (options: TransformOptions) => TransformResult;
  }

  const SaxonJS: SaxonJS;
  export default SaxonJS;
}
