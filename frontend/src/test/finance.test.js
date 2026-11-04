import { describe, expect, it } from 'vitest';
import { inRange, money, recentFirst, sum, summarize } from '../lib/finance';

describe('financial aggregation', () => {
  it('adds cents and maximum ledger values exactly', () => {
    expect(sum([{ amount: '99999999999999999.99' }, { amount: '0.01' }]).toFixed(2)).toBe(
      '100000000000000000.00',
    );
    expect(money('99999999999999999.99')).toBe('₹99,999,999,999,999,999.99');
    expect(sum([{ amount: '0.10' }, { amount: '0.20' }]).toFixed(2)).toBe('0.30');
  });
  it('uses UTC date boundaries and excludes future postings from relative ranges', () => {
    const now = new Date('2026-11-05T12:00:00Z');
    expect(inRange({ createdAt: '2026-10-30T00:00:00' }, '7', now)).toBe(true);
    expect(inRange({ createdAt: '2026-10-29T23:59:59' }, '7', now)).toBe(false);
    expect(inRange({ createdAt: '2026-11-06T00:00:00' }, '7', now)).toBe(false);
  });
  it('sorts large IDs correctly when timestamps tie', () => {
    const rows = [
      { id: '9223372036854775805', createdAt: '2026-01-01T12:00:00' },
      { id: '9223372036854775806', createdAt: '2026-01-01T12:00:00' },
    ];
    expect(rows.sort(recentFirst)[0].id).toBe('9223372036854775806');
  });
  it('separates pending detection from low risk and computes gross volume', () => {
    const snapshot = {
      transactions: [
        { id: '1', amount: '100.10', type: 'CREDIT', createdAt: '2026-01-01T12:00:00' },
        { id: '2', amount: '30.05', type: 'DEBIT', createdAt: '2026-01-01T13:00:00' },
        { id: '3', amount: '1.00', type: 'DEBIT', createdAt: '2026-01-02T12:00:00' },
      ],
      alerts: [
        { transactionId: '1', riskScore: 0, status: 'NOT_REQUIRED' },
        { transactionId: '2', riskScore: 70, status: 'IN_REVIEW' },
      ],
    };
    const result = summarize(snapshot);
    expect(result.total.toFixed(2)).toBe('131.15');
    expect(result.pending).toBe(1);
    expect(result.open).toBe(1);
    expect(result.risk.map((row) => row.value)).toEqual([1, 0, 1]);
    expect(result.trend).toHaveLength(2);
  });
});
