const { addMembersToGroups } = require('../../src/core/addQueue.cjs');
const { getWhatsappQueue } = require('../../src/database/pgsql.cjs');
const { send_to_queue, get_all_queue_itens } = require('../../src/database/redis.cjs');

jest.mock('../../src/database/pgsql.cjs');
jest.mock('../../src/database/redis.cjs');

describe('addMembersToGroups', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should successfully add members to groups and send requests to the queue', async () => {        
        const groups = [
            { id: { _serialized: '1235456484321@g.us' }, name: 'MB | Matemática' },
            { id: { _serialized: '1276648894894@g.us' }, name: 'MB | Signos' },
        ];

        const data1 = {
            rows: [
                { registration_id: '456' },
                { registration_id: '789' },
            ],
        };

        const data2 = {
            rows: [
                { registration_id: '123' },
            ],
        };

        const currentQueue = ['{"type":"add","registration_id":"456","group_id":"1235456484321@g.us"}'];
        
        getWhatsappQueue.mockImplementation((groupId) => {
            if (groupId === '1235456484321@g.us') return Promise.resolve(data1);
            if (groupId === '1276648894894@g.us') return Promise.resolve(data2);
        });

        get_all_queue_itens.mockResolvedValue(currentQueue);
        send_to_queue.mockResolvedValue();
        
        await addMembersToGroups(groups);
        
        expect(get_all_queue_itens).toHaveBeenCalledTimes(1);
        expect(getWhatsappQueue).toHaveBeenCalledTimes(2);
        expect(getWhatsappQueue).toHaveBeenCalledWith('1235456484321@g.us');
        expect(getWhatsappQueue).toHaveBeenCalledWith('1276648894894@g.us');

        expect(send_to_queue).toHaveBeenCalledTimes(2);
        expect(send_to_queue).toHaveBeenCalledWith({
            type: 'add',
            registration_id: '789',
            group_id: '1235456484321@g.us',
        });
        expect(send_to_queue).toHaveBeenCalledWith({
            type: 'add',
            registration_id: '123',
            group_id: '1276648894894@g.us',
        });
    });

    it('should handle errors when fetching the WhatsApp queue', async () => {        
        const groups = [
            { id: { _serialized: '1235456484321@g.us' }, name: 'MB | Matemática' },
        ];

        getWhatsappQueue.mockRejectedValue(new Error('Database error'));
        get_all_queue_itens.mockResolvedValue([]);

        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

        await addMembersToGroups(groups);

        expect(get_all_queue_itens).toHaveBeenCalledTimes(1);
        expect(getWhatsappQueue).toHaveBeenCalledTimes(1);
        expect(getWhatsappQueue).toHaveBeenCalledWith('1235456484321@g.us');

        expect(consoleErrorSpy).toHaveBeenCalledWith(
            'Error adding members to group MB | Matemática: Database error',
        );

        consoleErrorSpy.mockRestore();
    });

    it('should handle errors when sending requests to the queue', async () => {
        const groups = [
            { id: { _serialized: '1235456484321@g.us' }, name: 'MB | Matemática' },
        ];

        const data1 = {
            rows: [
                { registration_id: '456' },
            ],
        };

        const currentQueue = [];

        getWhatsappQueue.mockResolvedValue(data1);
        get_all_queue_itens.mockResolvedValue(currentQueue);
        send_to_queue.mockRejectedValue(new Error('Queue error'));

        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

        await addMembersToGroups(groups);
        
        expect(get_all_queue_itens).toHaveBeenCalledTimes(1);
        expect(getWhatsappQueue).toHaveBeenCalledTimes(1);
        expect(getWhatsappQueue).toHaveBeenCalledWith('1235456484321@g.us');

        expect(send_to_queue).toHaveBeenCalledTimes(1);
        expect(send_to_queue).toHaveBeenCalledWith({
            type: 'add',
            registration_id: '456',
            group_id: '1235456484321@g.us',
        });

        expect(consoleErrorSpy).toHaveBeenCalledWith(
            'Error sending request to add: 456 to group: 1235456484321@g.us - Queue error',
        );
        
        consoleErrorSpy.mockRestore();
    });

    it('should skip duplicate requests already in the queue', async () => {        
        const groups = [
            { id: { _serialized: '1235456484321@g.us' }, name: 'MB | Matemática' },
        ];

        const data1 = {
            rows: [
                { registration_id: '456' },
            ],
        };

        const currentQueue = ['{"type":"add","registration_id":"456","group_id":"1235456484321@g.us"}'];
        
        getWhatsappQueue.mockResolvedValue(data1);
        get_all_queue_itens.mockResolvedValue(currentQueue);
        send_to_queue.mockResolvedValue();
        
        await addMembersToGroups(groups);
        
        expect(get_all_queue_itens).toHaveBeenCalledTimes(1);
        expect(getWhatsappQueue).toHaveBeenCalledTimes(1);
        expect(getWhatsappQueue).toHaveBeenCalledWith('1235456484321@g.us');

    expect(send_to_queue).not.toHaveBeenCalled(); 
    });
});