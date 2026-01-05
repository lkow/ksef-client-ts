/**
 * Common types and interfaces for KSeF API
 */

export interface StatusInfo {
  processingCode: number;
  processingDescription: string;
  referenceNumber: string;
  timestamp: string;
}

export interface ContextIdentifier {
  type: 'onip' | 'pesel';
  value: string;
}

export interface SubjectIdentifier extends ContextIdentifier {}

export enum IpAddressPolicy {
  STRICT = 'STRICT',
  NONE = 'NONE'
}

export interface KsefEnvironmentConfig {
  baseUrl: string;
  name: 'test' | 'demo' | 'prod';
}

export const KSEF_ENVIRONMENTS: Record<string, KsefEnvironmentConfig> = {
  test: {
    baseUrl: 'https://api-test.ksef.mf.gov.pl/v2',
    name: 'test'
  },
  demo: {
    baseUrl: 'https://api-demo.ksef.mf.gov.pl/v2',
    name: 'demo'
  },
  prod: {
    baseUrl: 'https://api.ksef.mf.gov.pl/v2',
    name: 'prod'
  }
};

export interface KsefError extends Error {
  code?: string;
  statusCode?: number;
  referenceNumber?: string;
  processingCode?: number;
}

export class KsefApiError extends Error implements KsefError {
  public readonly code?: string;
  public readonly statusCode?: number;
  public readonly referenceNumber?: string;
  public readonly processingCode?: number;

  constructor(
    message: string,
    options?: {
      code?: string;
      statusCode?: number;
      referenceNumber?: string;
      processingCode?: number;
    }
  ) {
    super(message);
    this.name = 'KsefApiError';
    if (options?.code !== undefined) this.code = options.code;
    if (options?.statusCode !== undefined) this.statusCode = options.statusCode;
    if (options?.referenceNumber !== undefined) this.referenceNumber = options.referenceNumber;
    if (options?.processingCode !== undefined) this.processingCode = options.processingCode;
  }
}

export class AuthenticationError extends KsefApiError {
  constructor(message: string, options?: { statusCode?: number }) {
    super(message, options);
    this.name = 'AuthenticationError';
  }
}

export class ValidationError extends KsefApiError {
  constructor(message: string, options?: { statusCode?: number; code?: string }) {
    super(message, options);
    this.name = 'ValidationError';
  }
}

export class ProcessError extends KsefApiError {
  constructor(message: string, options?: { referenceNumber?: string; processingCode?: number }) {
    super(message, options);
    this.name = 'ProcessError';
  }
} 
