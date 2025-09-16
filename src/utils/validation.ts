/**
 * Validation utilities for KSeF operations
 */

import { ValidationError } from '@/types/common.js';
import type { ContextIdentifier } from '@/types/common.js';

/**
 * Validate NIP (Polish tax identification number)
 */
export function validateNIP(nip: string): boolean {
  // Remove any non-digit characters
  const cleanNip = nip.replace(/\D/g, '');
  
  // NIP must be exactly 10 digits
  if (cleanNip.length !== 10) {
    return false;
  }

  // Calculate checksum
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  let sum = 0;
  
  for (let i = 0; i < 9; i++) {
    const digit = cleanNip[i];
    const weight = weights[i];
    if (digit && weight) {
      sum += parseInt(digit) * weight;
    }
  }
  
  const checksum = sum % 11;
  const lastDigitStr = cleanNip[9];
  const lastDigit = lastDigitStr ? parseInt(lastDigitStr) : 0;
  
  return checksum === lastDigit;
}

/**
 * Validate PESEL (Polish personal identification number)
 */
export function validatePESEL(pesel: string): boolean {
  // Remove any non-digit characters
  const cleanPesel = pesel.replace(/\D/g, '');
  
  // PESEL must be exactly 11 digits
  if (cleanPesel.length !== 11) {
    return false;
  }

  // Calculate checksum
  const weights = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
  let sum = 0;
  
  for (let i = 0; i < 10; i++) {
    const digit = cleanPesel[i];
    const weight = weights[i];
    if (digit && weight) {
      sum += parseInt(digit) * weight;
    }
  }
  
  const checksum = (10 - (sum % 10)) % 10;
  const lastDigitStr = cleanPesel[10];
  const lastDigit = lastDigitStr ? parseInt(lastDigitStr) : 0;
  
  return checksum === lastDigit;
}

/**
 * Validate context identifier (NIP or PESEL)
 */
export function validateContextIdentifier(identifier: ContextIdentifier): void {
  if (!identifier || !identifier.type || !identifier.value) {
    throw new ValidationError('Context identifier must have type and value');
  }

  const { type, value } = identifier;

  switch (type) {
    case 'onip':
      if (!validateNIP(value)) {
        throw new ValidationError(`Invalid NIP: ${value}`);
      }
      break;
    
    case 'pesel':
      if (!validatePESEL(value)) {
        throw new ValidationError(`Invalid PESEL: ${value}`);
      }
      break;
    
    default:
      throw new ValidationError(`Unknown identifier type: ${type}`);
  }
}

/**
 * Validate XML structure for invoice
 */
export function validateInvoiceXML(xml: string): void {
  if (!xml || typeof xml !== 'string') {
    throw new ValidationError('Invoice XML must be a non-empty string');
  }

  const trimmedXml = xml.trim();
  
  if (trimmedXml.length === 0) {
    throw new ValidationError('Invoice XML cannot be empty');
  }

  // Basic XML structure validation
  if (!trimmedXml.startsWith('<?xml') && !trimmedXml.startsWith('<')) {
    throw new ValidationError('Invoice XML must be valid XML format');
  }

  // Check for required KSeF elements (simplified validation)
  const requiredElements = ['Fa', 'Naglowek', 'Podmiot1', 'Fa1'];
  const missingElements = requiredElements.filter(element => !trimmedXml.includes(`<${element}`));
  
  if (missingElements.length > 0) {
    throw new ValidationError(`Invoice XML missing required elements: ${missingElements.join(', ')}`);
  }
}

/**
 * Validate date format (ISO 8601)
 */
export function validateDateFormat(date: string): boolean {
  const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
  return iso8601Regex.test(date);
}

/**
 * Validate date range
 */
export function validateDateRange(from: string, to: string): void {
  if (!validateDateFormat(from)) {
    throw new ValidationError(`Invalid 'from' date format: ${from}. Expected ISO 8601 format.`);
  }

  if (!validateDateFormat(to)) {
    throw new ValidationError(`Invalid 'to' date format: ${to}. Expected ISO 8601 format.`);
  }

  const fromDate = new Date(from);
  const toDate = new Date(to);

  if (fromDate >= toDate) {
    throw new ValidationError(`'from' date must be before 'to' date. Got: ${from} >= ${to}`);
  }

  // Check if date range is reasonable (not more than 1 year)
  const oneYear = 365 * 24 * 60 * 60 * 1000; // milliseconds
  if (toDate.getTime() - fromDate.getTime() > oneYear) {
    throw new ValidationError('Date range cannot exceed 1 year');
  }
}

/**
 * Sanitize string input
 */
export function sanitizeString(input: string, maxLength = 1000): string {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .trim()
    .substring(0, maxLength)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // Remove control characters
}

/**
 * Validate file size
 */
export function validateFileSize(sizeInBytes: number, maxSizeInMB = 10): void {
  const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
  
  if (sizeInBytes > maxSizeInBytes) {
    throw new ValidationError(
      `File size ${(sizeInBytes / 1024 / 1024).toFixed(2)}MB exceeds maximum allowed size of ${maxSizeInMB}MB`
    );
  }
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number (Polish format)
 */
export function validatePhoneNumber(phone: string): boolean {
  // Remove all non-digit characters
  const cleanPhone = phone.replace(/\D/g, '');
  
  // Polish phone numbers are 9 digits (without country code) or 11 digits (with +48)
  return cleanPhone.length === 9 || 
         (cleanPhone.length === 11 && cleanPhone.startsWith('48'));
}

/**
 * Format NIP for display
 */
export function formatNIP(nip: string): string {
  const cleanNip = nip.replace(/\D/g, '');
  
  if (cleanNip.length === 10) {
    return `${cleanNip.slice(0, 3)}-${cleanNip.slice(3, 6)}-${cleanNip.slice(6, 8)}-${cleanNip.slice(8)}`;
  }
  
  return cleanNip;
}

/**
 * Format PESEL for display
 */
export function formatPESEL(pesel: string): string {
  const cleanPesel = pesel.replace(/\D/g, '');
  
  if (cleanPesel.length === 11) {
    return `${cleanPesel.slice(0, 6)}-${cleanPesel.slice(6)}`;
  }
  
  return cleanPesel;
} 