const { send_to_queue, get_all_queue_itens } = require('../../src/database/redis.cjs');
const { getGroupParticipants } = require('../../src/utils/chat.cjs');
const { checkPhoneNumber } = require('../../src/utils/phone-check.cjs');
const { triggerTwilioOrRemove } = require('../../src/utils/twilio.cjs');
const { removeMembersFromGroups } = require('../../src/core/removeQueue.cjs');

jest.mock('../../src/database/redis.cjs', () => ({
    send_to_queue: jest.fn().mockResolvedValue(true),
    get_all_queue_itens: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../src/utils/chat.cjs', () => ({
    getGroupParticipants: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../src/utils/phone-check.cjs', () => ({
    checkPhoneNumber: jest.fn().mockReturnValue({ found: false }),
}));

jest.mock('../../src/utils/twilio.cjs', () => ({
    triggerTwilioOrRemove: jest.fn().mockResolvedValue(true),
}));

jest.mock('dotenv', () => ({
    configDotenv: jest.fn(),
}));

describe('removeMembersFromGroups', () => {
    let mockClient;
    const groups = [
        { id: { _serialized: 'group1' }, name: 'M.JB Test Group' },
        { id: { _serialized: 'group2' }, name: 'JB Test Group' },
        { id: { _serialized: 'group3' }, name: 'MB | Test Group' }
    ];

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.DONT_REMOVE_NUMBERS = 'dont_remove_me';
    });

    test('should queue removal for JB over 10 in M.JB group', async () => {
        getGroupParticipants.mockResolvedValue([{ id: { _serialized: '123' } }]);
        checkPhoneNumber.mockReturnValue({
            found: true,
            jb_over_10: true,
            jb_under_10: false,
            is_adult: false,
            status: 'Active',
        });

        await removeMembersFromGroups(mockClient, [groups[0]], new Map());
        expect(send_to_queue).toHaveBeenCalledWith(expect.objectContaining({
            reason: 'User is JB over 10 in M.JB group',
        }));
    });

    test('should queue removal for JB under 10 in JB group', async () => {
        getGroupParticipants.mockResolvedValue([{ id: { _serialized: '456' } }]);
        checkPhoneNumber.mockReturnValue({
            found: true,
            jb_over_10: false,
            jb_under_10: true,
            is_adult: false,
            status: 'Active',
        });

        await removeMembersFromGroups(mockClient, [groups[1]], new Map());
        expect(send_to_queue).toHaveBeenCalledWith(expect.objectContaining({
            reason: 'User is JB under 10 in JB group',
        }));
    });

    test('should queue removal for JB member in non-JB group', async () => {
        getGroupParticipants.mockResolvedValue([{ id: { _serialized: '789' } }]);
        checkPhoneNumber.mockReturnValue({
            found: true,
            jb_over_10: true,
            jb_under_10: false,
            is_adult: false,
            status: 'Active',
        });

        await removeMembersFromGroups(mockClient, [groups[2]], new Map());
        expect(send_to_queue).toHaveBeenCalledWith(expect.objectContaining({
            reason: 'User is JB in non-JB group',
        }));
    });

    test('should not remove adult members', async () => {
        getGroupParticipants.mockResolvedValue([{ id: { _serialized: '321' } }]);
        checkPhoneNumber.mockReturnValue({
            found: true,
            jb_over_10: true,
            jb_under_10: false,
            is_adult: true,
            status: 'Active',
        });

        await removeMembersFromGroups(mockClient, [groups[0]], new Map());
        expect(send_to_queue).not.toHaveBeenCalled();
    });

    it('should not remove members with both JB flags', async () => {
        getGroupParticipants.mockResolvedValue([{ id: { _serialized: '654' } }]);
        checkPhoneNumber.mockReturnValue({
            found: true,
            jb_over_10: true,
            jb_under_10: true,
            is_adult: false,
            status: 'Active',
        });

        await removeMembersFromGroups(mockClient, [groups[0]], new Map());
        expect(send_to_queue).not.toHaveBeenCalled();
    });

    it('should queue removal for inactive members after Twilio check', async () => {
        getGroupParticipants.mockResolvedValue([{ id: { _serialized: '987' } }]);
        checkPhoneNumber.mockReturnValue({
            found: true,
            jb_over_10: false,
            jb_under_10: false,
            is_adult: true,
            status: 'Inactive',
        });
        triggerTwilioOrRemove.mockResolvedValue(true);

        await removeMembersFromGroups(mockClient, [groups[2]], new Map());
        expect(triggerTwilioOrRemove).toHaveBeenCalledTimes(1);
        expect(triggerTwilioOrRemove).toHaveBeenCalledWith('987', 'mensa_inactive');
        expect(send_to_queue).toHaveBeenCalledWith(expect.objectContaining({
            reason: 'Inactive',
        }));
    });

    test('should queue removal for members not found in DB', async () => {
        getGroupParticipants.mockResolvedValue([{ id: { _serialized: '147' } }]);
        checkPhoneNumber.mockReturnValue({ found: false });

        await removeMembersFromGroups(mockClient, [groups[0]], new Map());
        expect(send_to_queue).toHaveBeenCalledWith(expect.objectContaining({
            reason: 'Not found in DB',
        }));
    });

    test('should protect numbers in DONT_REMOVE_NUMBERS', async () => {
        getGroupParticipants.mockResolvedValue([{ id: { _serialized: '9876543210' } }]);
        checkPhoneNumber.mockReturnValue({ found: false });

        await removeMembersFromGroups(mockClient, [groups[0]], new Map());
        expect(send_to_queue).not.toHaveBeenCalled();
    });

    test('should skip members already in queue', async () => {
        get_all_queue_itens.mockResolvedValue([
            JSON.stringify({
                type: 'remove',
                registration_id: '123456',
                groupId: 'group1',
                phone: '987654321',
            }),
        ]);
        getGroupParticipants.mockResolvedValue([{ id: { _serialized: '987654321' } }]);
        checkPhoneNumber.mockReturnValue({
            found: true,
            mb: '123456',
            phone: '987654321',
            jb_under_10: false,
            jb_over_10: false,
            is_adult: true,
            status: 'Inactive',
        });

        await removeMembersFromGroups(mockClient, [groups[0]], new Map());
        expect(send_to_queue).not.toHaveBeenCalled();
    });

    test('should handle group processing errors gracefully', async () => {
        getGroupParticipants.mockRejectedValue(new Error('Group fetch failed'));
        console.error = jest.fn();

        await removeMembersFromGroups(mockClient, [groups[0]], new Map());
        expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('Error processing group')
        );
    });
});