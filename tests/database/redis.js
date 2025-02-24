// # TODO: Fix this test


// redis.test.js
// const { createClient } = require('redis');
// const { send_to_queue, get_all_queue_itens } = require('../../src/database/redis.cjs');

// jest.mock('redis', () => ({
//     createClient: jest.fn(() => ({
//         connect: jest.fn(),
//         disconnect: jest.fn(),
//         rPush: jest.fn(),
//         lRange: jest.fn(),
//         on: jest.fn(),
//     })),
// }));

// describe('Redis Client Tests', () => {
//     let client;

//     beforeAll(() => {
//         client = createClient.mock.results[0].value;
//     });

//     afterEach(() => {
//         jest.clearAllMocks();
//     });

//     test('should create client with REDIS_PASSWORD', () => {
//         expect(createClient).toHaveBeenCalledWith({
//             password: 'testpass',
//         });
//     });

//     test('should set up error handler on client', () => {
//         expect(client.on).toHaveBeenCalledWith('error', expect.any(Function));
//     });

//     describe('send_to_queue', () => {
//         test('should log object, connect, push item, and disconnect', async () => {
//             const testObject = { data: 'test' };
//             const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => { });

//             await send_to_queue(testObject);

//             // Verify console.log and Redis methods
//             expect(consoleSpy).toHaveBeenCalledWith(testObject);
//             expect(client.connect).toHaveBeenCalled();
//             expect(client.rPush).toHaveBeenCalledWith('queue', JSON.stringify(testObject));
//             expect(client.disconnect).toHaveBeenCalled();

//             consoleSpy.mockRestore();
//         });

//         test('should handle errors and exit process', async () => {
//             const mockError = new Error('Connection failed');
//             client.connect.mockRejectedValue(mockError);
//             const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => { });
//             const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => { });

//             await send_to_queue({});

//             expect(consoleSpy).toHaveBeenCalledWith('Error sending data to queue', mockError);

//             exitSpy.mockRestore();
//             consoleSpy.mockRestore();
//         });
//     });

//     describe('get_all_queue_itens', () => {
//         test('should connect, retrieve items, and disconnect', async () => {
//             const mockItems = ['{"id":1}', '{"id":2}'];
//             client.lRange.mockResolvedValue(mockItems);

//             const result = await get_all_queue_itens();

//             expect(client.connect).toHaveBeenCalled();
//             expect(client.lRange).toHaveBeenCalledWith('queue', 0, -1);
//             expect(client.disconnect).toHaveBeenCalled();
//             expect(result).toEqual(mockItems);
//         });

//         test('should return empty array if no items', async () => {
//             client.lRange.mockResolvedValue([]);

//             const result = await get_all_queue_itens();

//             expect(result).toEqual([]);
//         });

//         test('should handle errors and exit process', async () => {
//             const mockError = new Error('Fetch error');
//             client.connect.mockRejectedValue(mockError);
//             const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => { });
//             const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => { });

//             await get_all_queue_itens();

//             expect(consoleSpy).toHaveBeenCalledWith('Error receiving data from queue', mockError);

//             exitSpy.mockRestore();
//             consoleSpy.mockRestore();
//         });
//     });
// });