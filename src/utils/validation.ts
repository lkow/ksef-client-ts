/**
 * Validation utilities for KSeF operations
 */

import { ValidationError } from '@/types/common.js';
import type { ContextIdentifier } from '@/types/common.js';
import type {
  ContextIdentifier as ApiV2ContextIdentifier,
  SubjectIdentifier as ApiV2SubjectIdentifier,
  EntityIdentifier as ApiV2EntityIdentifier
} from '@/api2/types/common.js';
import type { IndirectTargetIdentifier, IdDocument, PersonIdentifier } from '@/api2/types/permissions.js';

const NIP_CORE_PATTERN = '[1-9]((\\d[1-9])|([1-9]\\d))\\d{7}';
const VAT_UE_CORE_PATTERN = '(ATU\\d{8}|BE[01]{1}\\d{9}|BG\\d{9,10}|CY\\d{8}[A-Z]|CZ\\d{8,10}|DE\\d{9}|DK\\d{8}|EE\\d{9}|EL\\d{9}|ES([A-Z]\\d{8}|\\d{8}[A-Z]|[A-Z]\\d{7}[A-Z])|FI\\d{8}|FR[A-Z0-9]{2}\\d{9}|HR\\d{11}|HU\\d{8}|IE(\\d{7}[A-Z]{2}|\\d[A-Z0-9+*]\\d{5}[A-Z])|IT\\d{11}|LT(\\d{9}|\\d{12})|LU\\d{8}|LV\\d{11}|MT\\d{8}|NL[A-Z0-9+*]{12}|PT\\d{9}|RO\\d{2,10}|SE\\d{12}|SI\\d{8}|SK\\d{10}|XI((\\d{9}|\\d{12})|(GD|HA)\\d{3}))';

const NIP_REGEX = new RegExp(`^${NIP_CORE_PATTERN}$`);
const INTERNAL_ID_REGEX = new RegExp(`^${NIP_CORE_PATTERN}-\\d{5}$`);
const NIP_VAT_UE_REGEX = new RegExp(`^${NIP_CORE_PATTERN}-${VAT_UE_CORE_PATTERN}$`);
const PESEL_REGEX = /^\d{2}(?:0[1-9]|1[0-2]|2[1-9]|3[0-2]|4[1-9]|5[0-2]|6[1-9]|7[0-2]|8[1-9]|9[0-2])\d{7}$/;
const PEPPOL_ID_REGEX = /^P[A-Z]{2}[0-9]{6}$/;
const FINGERPRINT_REGEX = /^[0-9A-F]{64}$/;
const ISO_COUNTRY_CODE_REGEX = /^[A-Z]{2}$/;
const ISO_3166_ALPHA2 = new Set([
  'AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AW', 'AX', 'AZ',
  'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS',
  'BT', 'BV', 'BW', 'BY', 'BZ', 'CA', 'CC', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN',
  'CO', 'CR', 'CU', 'CV', 'CW', 'CX', 'CY', 'CZ', 'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ', 'EC', 'EE',
  'EG', 'EH', 'ER', 'ES', 'ET', 'FI', 'FJ', 'FK', 'FM', 'FO', 'FR', 'GA', 'GB', 'GD', 'GE', 'GF',
  'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ', 'GR', 'GS', 'GT', 'GU', 'GW', 'GY', 'HK', 'HM',
  'HN', 'HR', 'HT', 'HU', 'ID', 'IE', 'IL', 'IM', 'IN', 'IO', 'IQ', 'IR', 'IS', 'IT', 'JE', 'JM',
  'JO', 'JP', 'KE', 'KG', 'KH', 'KI', 'KM', 'KN', 'KP', 'KR', 'KW', 'KY', 'KZ', 'LA', 'LB', 'LC',
  'LI', 'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 'LY', 'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MH', 'MK',
  'ML', 'MM', 'MN', 'MO', 'MP', 'MQ', 'MR', 'MS', 'MT', 'MU', 'MV', 'MW', 'MX', 'MY', 'MZ', 'NA',
  'NC', 'NE', 'NF', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NU', 'NZ', 'OM', 'PA', 'PE', 'PF', 'PG',
  'PH', 'PK', 'PL', 'PM', 'PN', 'PR', 'PS', 'PT', 'PW', 'PY', 'QA', 'RE', 'RO', 'RS', 'RU', 'RW',
  'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS',
  'ST', 'SV', 'SX', 'SY', 'SZ', 'TC', 'TD', 'TF', 'TG', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO',
  'TR', 'TT', 'TV', 'TW', 'TZ', 'UA', 'UG', 'UM', 'US', 'UY', 'UZ', 'VA', 'VC', 'VE', 'VG', 'VI',
  'VN', 'VU', 'WF', 'WS', 'YE', 'YT', 'ZA', 'ZM', 'ZW'
]);

/**
 * Validate NIP (Polish tax identification number)
 */
export function validateNIP(nip: string): boolean {
  if (!nip || !NIP_REGEX.test(nip)) {
    return false;
  }

  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  let sum = 0;

  for (let i = 0; i < 9; i++) {
    sum += Number(nip[i]!) * weights[i]!;
  }

  const checksum = sum % 11;
  const lastDigit = Number(nip[9]);

  return checksum !== 10 && checksum === lastDigit;
}

/**
 * Validate PESEL (Polish personal identification number)
 */
export function validatePESEL(pesel: string): boolean {
  if (!pesel || !PESEL_REGEX.test(pesel)) {
    return false;
  }

  const weights = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
  let sum = 0;

  for (let i = 0; i < 10; i++) {
    sum += Number(pesel[i]!) * weights[i]!;
  }

  const checksum = (10 - (sum % 10)) % 10;
  const lastDigit = Number(pesel[10]);

  return checksum === lastDigit;
}

export function validateNipVatUe(nipVatUe: string): boolean {
  if (!nipVatUe || !NIP_VAT_UE_REGEX.test(nipVatUe)) {
    return false;
  }

  const [nip] = nipVatUe.split('-');
  return validateNIP(nip ?? '');
}

export function validateInternalId(internalId: string): boolean {
  if (!internalId || !INTERNAL_ID_REGEX.test(internalId)) {
    return false;
  }

  const [nip] = internalId.split('-');
  // TODO: Add suffix checksum validation once the official algorithm is available.
  return validateNIP(nip ?? '');
}

export function validatePeppolId(peppolId: string): boolean {
  return Boolean(peppolId) && PEPPOL_ID_REGEX.test(peppolId);
}

export function validateFingerprint(fingerprint: string): boolean {
  return Boolean(fingerprint) && FINGERPRINT_REGEX.test(fingerprint);
}

export function validateIsoCountryCode(countryCode: string): boolean {
  if (!countryCode || !ISO_COUNTRY_CODE_REGEX.test(countryCode)) {
    return false;
  }

  return ISO_3166_ALPHA2.has(countryCode);
}

export function validateIdDocument(document: IdDocument): void {
  if (!document || !document.type || !document.number || !document.country) {
    throw new ValidationError('IdDocument must have type, number, and country');
  }

  if (!validateIsoCountryCode(document.country)) {
    throw new ValidationError(`Invalid IdDocument country: ${document.country}`);
  }
}

export function validatePersonIdentifier(identifier: PersonIdentifier): void {
  if (!identifier || !identifier.type || !identifier.value) {
    throw new ValidationError('Person identifier must have type and value');
  }

  switch (identifier.type) {
    case 'Nip':
      if (!validateNIP(identifier.value)) {
        throw new ValidationError(`Invalid NIP: ${identifier.value}`);
      }
      break;
    case 'Pesel':
      if (!validatePESEL(identifier.value)) {
        throw new ValidationError(`Invalid PESEL: ${identifier.value}`);
      }
      break;
    default:
      throw new ValidationError(`Unknown person identifier type: ${identifier.type}`);
  }
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

export function validateApiV2ContextIdentifier(identifier: ApiV2ContextIdentifier): void {
  if (!identifier || !identifier.type || !identifier.value) {
    throw new ValidationError('Context identifier must have type and value');
  }

  switch (identifier.type) {
    case 'Nip':
      if (!validateNIP(identifier.value)) {
        throw new ValidationError(`Invalid NIP: ${identifier.value}`);
      }
      break;
    case 'InternalId':
      if (!validateInternalId(identifier.value)) {
        throw new ValidationError(`Invalid InternalId: ${identifier.value}`);
      }
      break;
    case 'NipVatUe':
      if (!validateNipVatUe(identifier.value)) {
        throw new ValidationError(`Invalid NipVatUe: ${identifier.value}`);
      }
      break;
    case 'PeppolId':
      if (!validatePeppolId(identifier.value)) {
        throw new ValidationError(`Invalid PeppolId: ${identifier.value}`);
      }
      break;
    default:
      throw new ValidationError(`Unknown context identifier type: ${identifier.type}`);
  }
}

export function validateApiV2SubjectIdentifier(identifier: ApiV2SubjectIdentifier): void {
  if (!identifier || !identifier.type || !identifier.value) {
    throw new ValidationError('Subject identifier must have type and value');
  }

  switch (identifier.type) {
    case 'Nip':
      if (!validateNIP(identifier.value)) {
        throw new ValidationError(`Invalid NIP: ${identifier.value}`);
      }
      break;
    case 'Pesel':
      if (!validatePESEL(identifier.value)) {
        throw new ValidationError(`Invalid PESEL: ${identifier.value}`);
      }
      break;
    case 'Fingerprint':
      if (!validateFingerprint(identifier.value)) {
        throw new ValidationError(`Invalid Fingerprint: ${identifier.value}`);
      }
      break;
    default:
      throw new ValidationError(`Unknown subject identifier type: ${identifier.type}`);
  }
}

export function validateApiV2EntityIdentifier(identifier: ApiV2EntityIdentifier): void {
  if (!identifier || !identifier.type || !identifier.value) {
    throw new ValidationError('Entity identifier must have type and value');
  }

  switch (identifier.type) {
    case 'Nip':
      if (!validateNIP(identifier.value)) {
        throw new ValidationError(`Invalid NIP: ${identifier.value}`);
      }
      break;
    case 'InternalId':
      if (!validateInternalId(identifier.value)) {
        throw new ValidationError(`Invalid InternalId: ${identifier.value}`);
      }
      break;
    case 'NipVatUe':
      if (!validateNipVatUe(identifier.value)) {
        throw new ValidationError(`Invalid NipVatUe: ${identifier.value}`);
      }
      break;
    case 'PeppolId':
      if (!validatePeppolId(identifier.value)) {
        throw new ValidationError(`Invalid PeppolId: ${identifier.value}`);
      }
      break;
    default:
      throw new ValidationError(`Unknown entity identifier type: ${identifier.type}`);
  }
}

export function validateApiV2IndirectTargetIdentifier(identifier?: IndirectTargetIdentifier | null): void {
  if (!identifier) {
    return;
  }

  switch (identifier.type) {
    case 'AllPartners':
      if (identifier.value) {
        throw new ValidationError('AllPartners identifier must not include a value');
      }
      break;
    case 'Nip':
      if (!identifier.value || !validateNIP(identifier.value)) {
        throw new ValidationError(`Invalid NIP: ${identifier.value ?? ''}`);
      }
      break;
    case 'InternalId':
      if (!identifier.value || !validateInternalId(identifier.value)) {
        throw new ValidationError(`Invalid InternalId: ${identifier.value ?? ''}`);
      }
      break;
    default:
      throw new ValidationError(`Unknown indirect target identifier type: ${identifier.type}`);
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
