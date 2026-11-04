import { parse, isLosslessNumber } from 'lossless-json';

const moneyKeys = new Set(['amount', 'balance', 'balanceAfter', 'baseline_mean']);
const idKeys = new Set(['id', 'customerId', 'accountId', 'transactionId', 'alertId']);

export function decode(text) {
  return parse(text, (key, value) => {
    if (!isLosslessNumber(value)) return value;
    if (moneyKeys.has(key) || idKeys.has(key)) return value.toString();
    const number = Number(value.toString());
    return Number.isSafeInteger(number) || !Number.isInteger(number) ? number : value.toString();
  });
}

export class ApiError extends Error {
  constructor(message, status = 0, fields = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fields = fields;
  }
}

export function createClient(
  baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api',
) {
  const base = baseUrl.replace(/\/+$/, '');
  return async function request(path, { method = 'GET', body, signal } = {}) {
    const timeout = AbortSignal.timeout(20000);
    try {
      const response = await fetch(`${base}${path}`, {
        method,
        credentials: 'omit',
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const text = await response.text();
      let result;
      try {
        result = text ? decode(text) : null;
      } catch {
        throw new ApiError(
          'The API returned an unreadable response. Check the API URL and server.',
          response.status,
        );
      }
      if (!response.ok)
        throw new ApiError(
          result?.message || `Request failed (HTTP ${response.status}).`,
          response.status,
          result?.fields || {},
        );
      return result;
    } catch (error) {
      if (signal?.aborted) throw error;
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        method === 'POST'
          ? 'The response was interrupted. The request may have completed. Refresh and inspect the record before submitting again.'
          : 'Cannot reach the API. Check that Spring Boot is running and the API URL and CORS origin are configured.',
      );
    }
  };
}

export const request = createClient();
