/* global require, describe, beforeEach, afterEach, it, expect, jest, process, global */

const { Client } = require('whatsapp-web.js');
const {
  printChats,
  getGroupParticipants,
  getGroupIdByName,
  removeParticipantByPhoneNumber,
  sendMessageToNumber,
  sendMessageToNumberAPI
} = require('../src/utils/chat');

describe('Chat Management Functions', () => {
  let client;
  const mockGroup = {
    id: { _serialized: 'mock-group-id' },
    name: 'Test Group',
    isGroup: true,
    participants: [
      { id: { _serialized: '1234567890@c.us', user: '1234567890' }, isAdmin: false },
      { id: { _serialized: '0987654321@c.us', user: '0987654321' }, isAdmin: true }
    ]
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock client implementation
    Client.mockImplementation(() => ({
      initialize: jest.fn().mockResolvedValue(),
      getChats: jest.fn().mockResolvedValue([mockGroup]),
      getChatById: jest.fn().mockResolvedValue(mockGroup),
      on: jest.fn()
    }));

    client = new Client();
  });

  describe('getGroupIdByName', () => {
    it('should return group ID when group exists', async () => {
      const groupId = await getGroupIdByName(client, 'Test Group');
      expect(groupId).toBe('mock-group-id');
      expect(client.getChats).toHaveBeenCalled();
    });

    it('should return null when group does not exist', async () => {
      client.getChats.mockResolvedValueOnce([{
        ...mockGroup,
        name: 'Different Group'
      }]);
      const groupId = await getGroupIdByName(client, 'Non-existent Group');
      expect(groupId).toBeNull();
    });
  });

  describe('getGroupParticipants', () => {
    it('should return list of participants with their details', async () => {
      const participants = await getGroupParticipants(client, 'mock-group-id');
      expect(participants).toHaveLength(2);
      expect(participants[0]).toEqual({
        phone: '1234567890',
        isAdmin: false
      });
      expect(participants[1]).toEqual({
        phone: '0987654321',
        isAdmin: true
      });
    });

    it('should return empty array for non-group chat', async () => {
      client.getChatById.mockResolvedValueOnce({ isGroup: false });
      const participants = await getGroupParticipants(client, 'non-group-id');
      expect(participants).toEqual([]);
    });
  });

  describe('removeParticipantByPhoneNumber', () => {
    it('should successfully remove participant when phone number matches', async () => {
      const mockChat = {
        ...mockGroup,
        removeParticipants: jest.fn().mockResolvedValue(true)
      };
      client.getChatById.mockResolvedValueOnce(mockChat);

      const result = await removeParticipantByPhoneNumber(client, 'mock-group-id', '1234567890');
      expect(result).toBe(true);
      expect(mockChat.removeParticipants).toHaveBeenCalledWith(['1234567890@c.us']);
    });

    it('should return false when participant not found', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
      const mockChat = {
        ...mockGroup,
        participants: [] // Empty participants list
      };
      client.getChatById.mockResolvedValueOnce(mockChat);
      const result = await removeParticipantByPhoneNumber(client, 'mock-group-id', 'nonexistent');
      expect(result).toBe(false);
      consoleSpy.mockRestore();
    });

    it('should handle removal errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
      const mockChat = {
        ...mockGroup,
        removeParticipants: jest.fn().mockRejectedValue(new Error('Failed to remove'))
      };
      client.getChatById.mockResolvedValueOnce(mockChat);

      const result = await removeParticipantByPhoneNumber(client, 'mock-group-id', '1234567890');
      expect(result).toBe(false);
      consoleSpy.mockRestore();
    });

    // Testing the actual includes() behavior
    it('should match participant when phone number is part of serialized ID', async () => {
      const mockChat = {
        ...mockGroup,
        removeParticipants: jest.fn().mockResolvedValue(true)
      };
      client.getChatById.mockResolvedValueOnce(mockChat);

      // This should match because '234567890' is included in '1234567890@c.us'
      const result = await removeParticipantByPhoneNumber(client, 'mock-group-id', '234567890');
      expect(result).toBe(true);
      expect(mockChat.removeParticipants).toHaveBeenCalled();
    });

    it('should not match when phone number is not part of any serialized ID', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
      const mockChat = {
        ...mockGroup,
        removeParticipants: jest.fn().mockResolvedValue(true)
      };
      client.getChatById.mockResolvedValueOnce(mockChat);

      // This should not match because '99999' is not included in any participant ID
      const result = await removeParticipantByPhoneNumber(client, 'mock-group-id', '99999');
      expect(result).toBe(false);
      expect(mockChat.removeParticipants).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should return false if groupChat.participants is undefined', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
      // Simulate a case where participants is missing
      const mockChat = {
        removeParticipants: jest.fn().mockResolvedValue(true)
        // participants property is intentionally undefined
      };
      client.getChatById.mockResolvedValueOnce(mockChat);
      const result = await removeParticipantByPhoneNumber(client, 'mock-group-id', '1234567890');
      expect(result).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  describe('sendMessageToNumber', () => {
    it('should send message successfully when chat exists', async () => {
      const mockChat = {
        sendMessage: jest.fn().mockResolvedValue(true)
      };
      client.getChatById.mockResolvedValueOnce(mockChat);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await sendMessageToNumber(client, '1234567890', 'Test message');

      expect(mockChat.sendMessage).toHaveBeenCalledWith('Test message');
      expect(consoleSpy).toHaveBeenCalledWith('Message sent to 1234567890');
      consoleSpy.mockRestore();
    });

    it('should log failure when chat is not found', async () => {
      client.getChatById.mockResolvedValueOnce(null);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await sendMessageToNumber(client, '1234567890', 'Test message');

      expect(consoleSpy).toHaveBeenCalledWith('Failed to send message to 1234567890: Chat not found.');
      consoleSpy.mockRestore();
    });

    it('should handle error when getChatById fails', async () => {
      client.getChatById.mockRejectedValueOnce(new Error('Failed to get chat'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await sendMessageToNumber(client, '1234567890', 'Test message');

      expect(consoleSpy).toHaveBeenCalledWith('Error sending message to 1234567890: Failed to get chat');
      consoleSpy.mockRestore();
    });

    it('should handle error when sendMessage fails', async () => {
      const mockChat = {
        sendMessage: jest.fn().mockRejectedValue(new Error('Send failed'))
      };
      client.getChatById.mockResolvedValueOnce(mockChat);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await sendMessageToNumber(client, '1234567890', 'Test message');

      expect(consoleSpy).toHaveBeenCalledWith('Error sending message to 1234567890: Send failed');
      consoleSpy.mockRestore();
    });
  });

  describe('printChats', () => {
    it('should print all chats', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await printChats(client);
      expect(client.getChats).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.any(Array));
      consoleSpy.mockRestore();
    });
  });

  describe('sendMessageToNumberAPI', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      global.fetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve({ success: true })
      });
      process.env.FB_TOKEN = 'test-token';
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('should send message through API successfully', async () => {
      await sendMessageToNumberAPI(client, '1234567890', 'template_name');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('graph.facebook.com'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json'
          }),
          body: expect.stringContaining('"name":"1234567890"')
        })
      );
    });


    it('should skip API call when in staging', async () => {
      process.env.FB_TOKEN = 'staging';
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await sendMessageToNumberAPI(client, '1234567890', 'template_name');

      expect(global.fetch).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Staging token. Mensagem não enviada');

      consoleSpy.mockRestore();
    });

    it('should handle API errors gracefully', async () => {
      global.fetch.mockRejectedValueOnce(new Error('API Error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      await expect(sendMessageToNumberAPI(client, '1234567890', 'template_name')).rejects.toThrow('API Error');
      expect(consoleSpy).toHaveBeenCalledWith('Error sending message:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('sendMessageToNumberAPI logging', () => {
    it('should log "Staging token. Mensagem não enviada" when token is staging', async () => {
      process.env.FB_TOKEN = 'staging';
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await sendMessageToNumberAPI('1234567890', 'template_name');
      expect(consoleSpy).toHaveBeenCalledWith('Staging token. Mensagem não enviada');
      consoleSpy.mockRestore();
    });
  });

  describe('removeParticipantByPhoneNumber logging', () => {
    it('should log attempting and successful removal messages', async () => {
      const mockChat = {
        ...mockGroup,
        removeParticipants: jest.fn().mockResolvedValue(true)
      };
      client.getChatById.mockResolvedValueOnce(mockChat);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await removeParticipantByPhoneNumber(client, 'mock-group-id', '1234567890');

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/^Attempting to remove participant: /));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/^Successfully removed participant: /));
      expect(result).toBe(true);
      consoleSpy.mockRestore();
    });

    it('should log error when participant not found', async () => {
      const mockChat = {
        ...mockGroup,
        participants: [] // Empty participants list
      };
      client.getChatById.mockResolvedValueOnce(mockChat);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await removeParticipantByPhoneNumber(client, 'mock-group-id', '1234567890');

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to remove participant with phone number 1234567890 from group mock-group-id.',
        new TypeError('Cannot read properties of undefined (reading \'id\')')
      );
      expect(result).toBe(false);
      consoleSpy.mockRestore();
    });
  });
});