/* global require, describe, it, expect, beforeEach */

const { checkPhoneNumber, preprocessPhoneNumbers } = require('../src/utils/phone-check');

describe('Phone Number Validation', () => {
    describe('checkPhoneNumber', () => {
        let phoneNumberMap;
        
        beforeEach(() => {
            const mockPhoneNumbers = [
                {
                    phone_number: '1234567890',
                    registration_id: '123',
                    status: 'Active',
                    jb_under_10: false,
                    jb_over_10: false
                },
                {
                    phone_number: '0987654321',
                    registration_id: '456',
                    status: 'Inactive',
                    jb_under_10: true,
                    jb_over_10: false
                },
                {
                    phone_number: '5555555555',
                    registration_id: '789',
                    status: 'Active',
                    jb_under_10: false,
                    jb_over_10: true
                }
            ];
            phoneNumberMap = preprocessPhoneNumbers(mockPhoneNumbers);
        });

        it('should find an active number', () => {
            const result = checkPhoneNumber(phoneNumberMap, '551234567890');
            expect(result).toEqual({
                found: true,
                is_adult: false,
                mb: '123',
                status: 'Active',
                jb_under_10: false,
                jb_over_10: false
            });
        });

        it('should find an inactive number', () => {
            const result = checkPhoneNumber(phoneNumberMap, '55987654321');
            expect(result).toEqual({
                found: true,
                is_adult: false,
                mb: '456',
                status: 'Inactive',
                jb_under_10: true,
                jb_over_10: false
            });
        });

        it('should handle JB over 10', () => {
            const result = checkPhoneNumber(phoneNumberMap, '555555555555');
            expect(result).toEqual({
                found: true,
                is_adult: false,
                mb: '789',
                status: 'Active',
                jb_under_10: false,
                jb_over_10: true
            });
        });

        it('should return not found for non-existent number', () => {
            const result = checkPhoneNumber(phoneNumberMap, '559999999999');
            expect(result).toEqual({ found: false });
        });

        it('should handle numbers with different formats', () => {
            const result = checkPhoneNumber(phoneNumberMap, '551234567890');
            expect(result.found).toBe(true);
            expect(result.mb).toBe('123');
        });
    });

    describe('preprocessPhoneNumbers', () => {
        it('should create a Map with phone number variations', () => {
            const input = [
                {
                    phone_number: '1234567890',
                    registration_id: '123',
                    status: 'Active'
                }
            ];
            const result = preprocessPhoneNumbers(input);
            expect(result).toBeInstanceOf(Map);
            expect(result.has('551234567890')).toBe(true);
            expect(result.get('551234567890')).toEqual([input[0]]);
        });

        it('should handle empty array', () => {
            const result = preprocessPhoneNumbers([]);
            expect(result).toBeInstanceOf(Map);
            expect(result.size).toBe(0);
        });

        it('should handle null or undefined input', () => {
            expect(() => preprocessPhoneNumbers(null)).toThrow();
            expect(() => preprocessPhoneNumbers(undefined)).toThrow();
        });

        it('should create variations for Brazilian numbers', () => {
            const input = [
                {
                    phone_number: '11999999999',
                    registration_id: '123',
                    status: 'Active'
                }
            ];
            const result = preprocessPhoneNumbers(input);
            expect(result).toBeInstanceOf(Map);
            expect(result.has('5511999999999')).toBe(true);
            expect(result.has('551199999999')).toBe(true);
            expect(result.has('5511999999999')).toBe(true);
        });
    });
}); 