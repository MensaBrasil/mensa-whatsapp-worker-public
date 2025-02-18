const assert = require('assert');
const { preprocessPhoneNumbers, checkPhoneNumber } = require('../../src/utils/phone-check');

describe('preprocessPhoneNumbers', () => {
    it('should normalize phone numbers with a + sign and add Brazilian variations', () => {
        const entries = [{
            phone_number: '+55 (11) 98765-4321',
            status: 'active',
            registration_id: '1234',
            jb_under_10: false,
            jb_over_10: false,
            is_adult: true
        }];
        const phoneMap = preprocessPhoneNumbers(entries);
        const normalized = '5511987654321';
        const withoutNinth = normalized.slice(0, 4) + normalized.slice(5); // "551187654321"
        const withNinth = normalized.slice(0, 4) + '9' + normalized.slice(4); // "55119987654321"
        
        assert.ok(phoneMap.has(normalized));
        assert.ok(phoneMap.has(withoutNinth));
        assert.ok(phoneMap.has(withNinth));
        // Each key should have the same entry
        [normalized, withoutNinth, withNinth].forEach(num => {
            assert.deepStrictEqual(phoneMap.get(num), [entries[0]]);
        });
    });

    it('should normalize local Brazilian numbers without +', () => {
        const entries = [{
            phone_number: '011 98765-4321',
            status: 'inactive',
            registration_id: '5678',
            jb_under_10: false,
            jb_over_10: true,
            is_adult: false
        }];
        const phoneMap = preprocessPhoneNumbers(entries);
        // local number: remove non-numbers and leading zeros, then prefix with 55. "011987654321" → "55" + "11987654321"
        const normalized = '5511987654321';
        const withoutNinth = normalized.slice(0, 4) + normalized.slice(5);
        const withNinth = normalized.slice(0, 4) + '9' + normalized.slice(4);

        assert.ok(phoneMap.has(normalized));
        assert.ok(phoneMap.has(withoutNinth));
        assert.ok(phoneMap.has(withNinth));
        [normalized, withoutNinth, withNinth].forEach(num => {
            assert.deepStrictEqual(phoneMap.get(num), [entries[0]]);
        });
    });

    it('should handle non-Brazilian numbers without variations', () => {
        const entries = [{
            phone_number: '+1 (555) 123-4567',
            status: 'active',
            registration_id: '9999',
            jb_under_10: false,
            jb_over_10: false,
            is_adult: true
        }];
        const phoneMap = preprocessPhoneNumbers(entries);
        // For non-Brazilian numbers, only one key is added.
        const normalized = '15551234567'; // after removing non-digits
        assert.ok(phoneMap.has(normalized));
        assert.deepStrictEqual(phoneMap.get(normalized), [entries[0]]);
    });
});

describe('checkPhoneNumber', () => {
    it('should return found data with collected flags if entry exists', () => {
        const entry1 = {
            phone_number: '+55 (11) 98765-4321',
            status: 'active',
            registration_id: '1234',
            jb_under_10: true,
            jb_over_10: false,
            is_adult: true
        };
        const entry2 = {
            phone_number: '+55 (11) 98765-4321',
            status: 'active',
            registration_id: '1234',
            jb_under_10: false,
            jb_over_10: true,
            is_adult: false
        };

        const phoneMap = preprocessPhoneNumbers([entry1, entry2]);
        // Using one of the generated keys
        const normalized = '5511987654321';
        const result = checkPhoneNumber(phoneMap, normalized);
        assert.strictEqual(result.found, true);
        assert.strictEqual(result.status, 'active');
        assert.strictEqual(result.mb, '1234');
        // Both flags collected
        assert.strictEqual(result.jb_under_10, true);
        assert.strictEqual(result.jb_over_10, true);
        // is_adult flag true because at least one entry has it true
        assert.strictEqual(result.is_adult, true);
    });

    it('should return { found: false } if no matching entry exists', () => {
        const phoneMap = new Map();
        const result = checkPhoneNumber(phoneMap, 'nonexistent');
        assert.deepStrictEqual(result, { found: false });
    });
});
