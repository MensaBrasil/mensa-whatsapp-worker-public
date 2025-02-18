const convertTimestampToDate = require('../../src/utils/misc');

describe('convertTimestampToDate', () => {
    test('should correctly convert a Unix timestamp to a Date object', async () => {
        // Define a Unix timestamp (in seconds)
        const timestamp = 1672531199; // Example: December 31, 2022, 23:59:59 UTC

        // Expected Date object
        const expectedDate = new Date(1672531199 * 1000);

        // Call the function and assert the result
        const result = await convertTimestampToDate(timestamp);
        expect(result).toEqual(expectedDate);
    });

    test('should handle invalid timestamps gracefully', async () => {
        // Invalid timestamp (e.g., negative value)
        const invalidTimestamp = -123456789;

        // Expected behavior: Should still return a Date object
        const expectedDate = new Date(invalidTimestamp * 1000);

        // Call the function and assert the result
        const result = await convertTimestampToDate(invalidTimestamp);
        expect(result).toEqual(expectedDate);
    });

    test('should handle zero timestamp', async () => {
        // Zero timestamp (Unix epoch)
        const zeroTimestamp = 0;

        // Expected Date object (January 1, 1970, 00:00:00 UTC)
        const expectedDate = new Date(0);

        // Call the function and assert the result
        const result = await convertTimestampToDate(zeroTimestamp);
        expect(result).toEqual(expectedDate);
    });
});