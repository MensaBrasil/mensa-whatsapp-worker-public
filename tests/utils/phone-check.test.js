const { preprocessPhoneNumbers, checkPhoneNumber } = require('../../src/utils/phone-check.cjs');

describe('preprocessPhoneNumbers', () => {
    test('should normalize phone numbers with a + sign and add Brazilian variations', () => {
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
        const withoutNinth = normalized.slice(0, 4) + normalized.slice(5);
        const withNinth = normalized.slice(0, 4) + '9' + normalized.slice(4);

        expect(phoneMap.has(normalized)).toBe(true);
        expect(phoneMap.has(withoutNinth)).toBe(true);
        expect(phoneMap.has(withNinth)).toBe(true);
        [normalized, withoutNinth, withNinth].forEach(num => {
            expect(phoneMap.get(num)).toEqual([entries[0]]);
        });
    });

    test('should normalize local Brazilian numbers without +', () => {
        const entries = [{
            phone_number: '011 98765-4321',
            status: 'inactive',
            registration_id: '5678',
            jb_under_10: false,
            jb_over_10: true,
            is_adult: false
        }];
        const phoneMap = preprocessPhoneNumbers(entries);
        const normalized = '5511987654321';
        const withoutNinth = '551187654321';
        const withNinth = '5511987654321';

        expect(phoneMap.has(normalized)).toBe(true);
        expect(phoneMap.has(withoutNinth)).toBe(true);
        expect(phoneMap.has(withNinth)).toBe(true);
        [normalized, withoutNinth, withNinth].forEach(num => {
            expect(phoneMap.get(num)).toEqual([entries[0]]);
        });
    });


    test('should handle non-Brazilian numbers without variations', () => {
        const entries = [{
            phone_number: '+1 (555) 123-4567',
            status: 'active',
            registration_id: '9999',
            jb_under_10: false,
            jb_over_10: false,
            is_adult: true
        }];
        const phoneMap = preprocessPhoneNumbers(entries);
        const normalized = '15551234567';
        expect(phoneMap.has(normalized)).toBe(true);
        expect(phoneMap.get(normalized)).toEqual([entries[0]]);
    });
});

describe('checkPhoneNumber', () => {
    let phoneNumberMap;

    beforeEach(() => {
        const entries = [
            {
                phone_number: '11987654321',
                status: 'active',
                registration_id: '123',
                jb_under_10: true,
                jb_over_10: false,
                is_adult: true
            },
            {
                phone_number: '5511987654321',
                status: 'inactive',
                registration_id: '456',
                jb_under_10: false,
                jb_over_10: true,
                is_adult: false
            }
        ];
        phoneNumberMap = preprocessPhoneNumbers(entries);
    });

    test('matches exact normalized number and returns flags', () => {
        const result = checkPhoneNumber(phoneNumberMap, '5511987654321');
        expect(result.found).toBe(true);
        expect(result.status).toBe('active');
        expect(result.jb_under_10).toBe(true);
        expect(result.jb_over_10).toBe(false);
    });

    test('matches variation without ninth digit', () => {
        const result = checkPhoneNumber(phoneNumberMap, '551187654321');
        expect(result.found).toBe(true);
        expect(result.status).toBe('active');
    });

    test('aggregates flags from multiple entries', () => {
        const entries = [
            { phone_number: '11987654321', jb_under_10: true },
            { phone_number: '11987654321', jb_over_10: true }
        ];
        const map = preprocessPhoneNumbers(entries);
        const result = checkPhoneNumber(map, '55119987654321');
        expect(result.jb_under_10).toBe(true);
        expect(result.jb_over_10).toBe(true);
    });

    test('returns not found for non-existent number', () => {
        const result = checkPhoneNumber(phoneNumberMap, '9999999999');
        expect(result.found).toBe(false);
    });

    test('handles non-Brazilian number correctly', () => {
        const entry = { phone_number: '+1234567890', jb_over_10: true };
        const map = preprocessPhoneNumbers([entry]);
        const result = checkPhoneNumber(map, '1234567890');
        expect(result.jb_over_10).toBe(true);
    });
});