import { describe, it, expect } from 'vitest';
import { buildQueryString, createRequestBody } from '../../src/utils/http.js';

describe('buildQueryString', () => {
  it('builds query string from object', () => {
    const result = buildQueryString({
      param1: 'value1',
      param2: 'value2'
    });

    expect(result).toBe('?param1=value1&param2=value2');
  });

  it('handles arrays by repeating keys', () => {
    const result = buildQueryString({
      status: ['Active', 'Pending', 'Failed']
    });

    expect(result).toBe('?status=Active&status=Pending&status=Failed');
  });

  it('omits undefined values', () => {
    const result = buildQueryString({
      included: 'yes',
      excluded: undefined
    });

    expect(result).toBe('?included=yes');
    expect(result).not.toContain('excluded');
  });

  it('omits null values', () => {
    const result = buildQueryString({
      included: 'yes',
      excluded: null
    });

    expect(result).toBe('?included=yes');
    expect(result).not.toContain('excluded');
  });

  it('returns empty string when no params', () => {
    const result = buildQueryString({});
    expect(result).toBe('');
  });

  it('returns empty string when all params are undefined', () => {
    const result = buildQueryString({
      a: undefined,
      b: null
    });
    expect(result).toBe('');
  });

  it('converts numbers to strings', () => {
    const result = buildQueryString({
      pageSize: 50,
      pageOffset: 100
    });

    expect(result).toBe('?pageSize=50&pageOffset=100');
  });

  it('converts booleans to strings', () => {
    const result = buildQueryString({
      enabled: true,
      disabled: false
    });

    expect(result).toBe('?enabled=true&disabled=false');
  });

  it('URL encodes special characters', () => {
    const result = buildQueryString({
      query: 'hello world',
      special: 'a=b&c=d'
    });

    expect(result).toContain('query=hello+world');
    expect(result).toContain('special=a%3Db%26c%3Dd');
  });

  it('handles mixed array and scalar values', () => {
    const result = buildQueryString({
      single: 'value',
      multiple: ['a', 'b']
    });

    expect(result).toContain('single=value');
    expect(result).toContain('multiple=a');
    expect(result).toContain('multiple=b');
  });

  it('handles empty array', () => {
    const result = buildQueryString({
      empty: []
    });

    expect(result).toBe('');
  });
});

describe('createRequestBody', () => {
  it('returns string input unchanged', () => {
    const input = '{"already":"json"}';
    const result = createRequestBody(input);
    expect(result).toBe(input);
  });

  it('returns XML string unchanged', () => {
    const xml = '<Request><Data>test</Data></Request>';
    const result = createRequestBody(xml);
    expect(result).toBe(xml);
  });

  it('JSON stringifies object input', () => {
    const input = { key: 'value', nested: { a: 1 } };
    const result = createRequestBody(input);
    expect(result).toBe('{"key":"value","nested":{"a":1}}');
  });

  it('handles arrays', () => {
    const input = [1, 2, 3];
    const result = createRequestBody(input);
    expect(result).toBe('[1,2,3]');
  });

  it('handles null', () => {
    const result = createRequestBody(null);
    expect(result).toBe('null');
  });

  it('handles numbers', () => {
    const result = createRequestBody(42);
    expect(result).toBe('42');
  });

  it('handles booleans', () => {
    expect(createRequestBody(true)).toBe('true');
    expect(createRequestBody(false)).toBe('false');
  });

  it('produces compact JSON without whitespace', () => {
    const input = {
      a: 1,
      b: 2,
      c: { d: 3 }
    };
    const result = createRequestBody(input);
    
    // Should not contain newlines or extra spaces
    expect(result).not.toContain('\n');
    expect(result).not.toMatch(/:\s+/);
    expect(result).toBe('{"a":1,"b":2,"c":{"d":3}}');
  });

  it('handles complex nested objects', () => {
    const input = {
      contextIdentifier: { type: 'Nip', value: '1234567890' },
      permissions: [
        { permissionType: 'InvoiceRead' },
        { permissionType: 'InvoiceWrite' }
      ]
    };
    const result = createRequestBody(input);
    const parsed = JSON.parse(result);

    expect(parsed.contextIdentifier.type).toBe('Nip');
    expect(parsed.permissions).toHaveLength(2);
  });

  it('handles special characters in strings', () => {
    const input = {
      description: 'Test with "quotes" and \\backslash'
    };
    const result = createRequestBody(input);
    const parsed = JSON.parse(result);

    expect(parsed.description).toBe('Test with "quotes" and \\backslash');
  });

  it('handles unicode characters', () => {
    const input = {
      name: 'Łukasz Kowalski',
      city: 'Wrocław'
    };
    const result = createRequestBody(input);
    const parsed = JSON.parse(result);

    expect(parsed.name).toBe('Łukasz Kowalski');
    expect(parsed.city).toBe('Wrocław');
  });
});

