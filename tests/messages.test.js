/* global require, describe, it, expect */

const { getInactiveMessage, getNotFoundMessage } = require('../src/utils/messages');

describe('Message Templates', () => {
    describe('getInactiveMessage', () => {
        it('should return a properly formatted inactive message', () => {
            const phoneNumber = '1234567890';
            const message = getInactiveMessage(phoneNumber);
            
            expect(message).toContain('Zelador');
            expect(message).toContain('Mensa Brasil');
            expect(message).toContain(phoneNumber);
            expect(message).toContain('https://mensa.org.br/anuidades/');
            expect(message).toContain('inativo');
        });

        it('should include all required sections', () => {
            const message = getInactiveMessage('1234567890');
            
            // Check for key message components
            expect(message).toMatch(/Olá, mensan!/);
            expect(message).toMatch(/Aqui quem fala é o Zelador/);
            expect(message).toMatch(/cadastro de associado.*inativo/);
            expect(message).toMatch(/removi automaticamente/);
            expect(message).toMatch(/renove sua anuidade/);
            expect(message).toMatch(/Abraços mensans/);
        });
    });

    describe('getNotFoundMessage', () => {
        it('should return a properly formatted not found message', () => {
            const message = getNotFoundMessage();
            
            expect(message).toContain('Zelador');
            expect(message).toContain('Mensa Brasil');
            expect(message).toContain('secretaria@mensa.org.br');
            expect(message).toContain('7 dias');
        });

        it('should include all required sections', () => {
            const message = getNotFoundMessage();
            
            // Check for key message components
            expect(message).toMatch(/Olá, mensan!/);
            expect(message).toMatch(/Aqui quem fala é o Zelador/);
            expect(message).toMatch(/não encontrei este seu número/);
            expect(message).toMatch(/envie um e-mail/);
            expect(message).toMatch(/prazo.*7 dias/);
            expect(message).toMatch(/Abraços mensans/);
        });

        it('should maintain consistent formatting', () => {
            const message = getNotFoundMessage();
            
            // Check message structure and formatting
            expect(message.split('\n').length).toBeGreaterThan(1); // Multiple lines
            expect(message).toMatch(/🤖/); // Contains emoji
            expect(message).toMatch(/\*.*\*/); // Contains bold text (markdown)
        });
    });
}); 