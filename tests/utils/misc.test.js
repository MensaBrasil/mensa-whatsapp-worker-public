const { convertTimestampToDate } = require('../../src/utils/misc.cjs');

describe('convertTimestampToDate', () => {
    test('converts unix timestamp to Date object', async () => {
        const timestamp = 1633046400; // Oct 1, 2021 00:00:00 GMT
        const result = await convertTimestampToDate(timestamp);
        expect(result).toBeInstanceOf(Date);
        expect(result.getTime()).toBe(timestamp * 1000);
    });

    test('handles zero timestamp', async () => {
        const timestamp = 0; // Jan 1, 1970 00:00:00 GMT
        const result = await convertTimestampToDate(timestamp);
        expect(result).toBeInstanceOf(Date);
        expect(result.getTime()).toBe(0);
    });

    test('handles current timestamp', async () => {
        const now = Math.floor(Date.now() / 1000);
        const result = await convertTimestampToDate(now);
        expect(result).toBeInstanceOf(Date);
        expect(result.getTime()).toBe(now * 1000);
    });
});