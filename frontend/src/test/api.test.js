import { describe, expect, it, vi } from 'vitest';
import { ApiError, createClient, decode } from '../api/client';
import { createApi, loadSnapshot, mapLimited } from '../api/resources';

describe('API contracts and precision', () => {
  it('retains BigDecimal money and long identifiers without rounding', () => {
    const result = decode(
      '{"id":9223372036854775806,"balance":99999999999999999.99,"riskScore":45,"totalPages":2}',
    );
    expect(result).toEqual({
      id: '9223372036854775806',
      balance: '99999999999999999.99',
      riskScore: 45,
      totalPages: 2,
    });
  });
  it('uses the configured base URL and omits cookies on cross-origin requests', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"id":7}', { status: 201 })));
    await createClient('http://localhost:8080/api/')('/customers', {
      method: 'POST',
      body: { name: 'Demo', email: 'demo@example.test' },
    });
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8080/api/customers',
      expect.objectContaining({
        method: 'POST',
        credentials: 'omit',
        body: '{"name":"Demo","email":"demo@example.test"}',
      }),
    );
  });
  it('preserves backend validation fields and duplicate conflicts', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response('{"message":"Validation failed","fields":{"email":"must be valid"}}', {
            status: 400,
          }),
        ),
    );
    await expect(createClient('http://localhost/api')('/customers')).rejects.toMatchObject({
      status: 400,
      fields: { email: 'must be valid' },
    });
  });
  it('warns against retrying an ambiguous POST after connection failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network')));
    await expect(
      createClient('http://localhost/api')('/transactions', { method: 'POST', body: {} }),
    ).rejects.toThrow('may have completed');
  });
  it('accepts pending detection responses without inventing a risk score', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response('{"status":"PENDING","transactionId":8}', { status: 202 })),
    );
    expect(await createClient('http://localhost/api')('/transactions/8/risk')).toEqual({
      status: 'PENDING',
      transactionId: '8',
    });
  });
  it('loads every server page with the actual account-history route', async () => {
    const call = vi
      .fn()
      .mockResolvedValueOnce({ content: [{ id: '2' }], totalPages: 2 })
      .mockResolvedValueOnce({ content: [{ id: '1' }], totalPages: 2 });
    expect(await createApi(call).transactions('3')).toEqual([{ id: '2' }, { id: '1' }]);
    expect(call.mock.calls.map(([path]) => path)).toEqual([
      '/transactions?accountId=3&page=0&size=100',
      '/transactions?accountId=3&page=1&size=100',
    ]);
  });
  it('assembles complete customer/account feeds and assessment pages for a snapshot', async () => {
    const client = {
      health: vi.fn().mockResolvedValue({ status: 'UP' }),
      customers: vi.fn().mockResolvedValue([{ id: '1' }]),
      accounts: vi.fn().mockResolvedValue([{ id: '2', customerId: '1' }]),
      transactions: vi.fn().mockResolvedValue([{ id: '3', accountId: '2' }]),
      alerts: vi.fn().mockResolvedValue([]),
    };
    const result = await loadSnapshot(client);
    expect(result.transactions).toHaveLength(1);
    expect(client.accounts).toHaveBeenCalledWith('1', undefined);
    expect(client.transactions).toHaveBeenCalledWith('2', undefined);
    expect(result.fetchedAt).toBeInstanceOf(Date);
  });
  it('does not return silently incomplete snapshots when one account feed fails', async () => {
    const client = {
      health: async () => ({ status: 'UP' }),
      customers: async () => [{ id: '1' }],
      accounts: async () => [{ id: '2' }],
      transactions: async () => {
        throw new ApiError('Unavailable');
      },
      alerts: async () => [],
    };
    await expect(loadSnapshot(client)).rejects.toThrow('Unavailable');
  });
  it('limits request concurrency while preserving result order', async () => {
    let active = 0;
    let maximum = 0;
    const result = await mapLimited(
      [1, 2, 3, 4, 5],
      async (value) => {
        active++;
        maximum = Math.max(maximum, active);
        await new Promise((resolve) => setTimeout(resolve, 2));
        active--;
        return value * 2;
      },
      2,
    );
    expect(maximum).toBe(2);
    expect(result).toEqual([2, 4, 6, 8, 10]);
  });
});
