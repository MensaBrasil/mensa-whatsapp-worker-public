const originalArgv = process.argv;
const originalExit = process.exit;
const originalLog = console.log;
const originalError = console.error;

describe('CLI Argument Handling', () => {
    beforeEach(() => {
        jest.resetModules();
        console.log = jest.fn();
        console.error = jest.fn();
        process.exit = jest.fn();
    });

    afterEach(() => {
        process.argv = originalArgv;
        process.exit = originalExit;
        console.log = originalLog;
        console.error = originalError;
    });

    it('should exit when no mode specified', () => {
        require('../../dispatcher/src/main');
        expect(process.exit).toHaveBeenCalledWith(1);
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('You should select at least 1 service'));
    });

    it('should recognize multiple modes', () => {
        process.argv.push('--add', '--scan', '--remove', '--fetch', '--report');
        require('../../dispatcher/src/main');
        const logArgs = console.log.mock.calls[0];
        expect(logArgs[0]).toEqual(expect.stringContaining("Services selected:"));
        expect(logArgs[1]).toEqual(expect.stringContaining('Add'));
        expect(logArgs[1]).toEqual(expect.stringContaining('Scan'));
        expect(logArgs[1]).toEqual(expect.stringContaining('Remove'));
        expect(logArgs[1]).toEqual(expect.stringContaining('Fetch Messages'));
        expect(logArgs[1]).toEqual(expect.stringContaining('Report'));
    });
});

describe('Client Initialization', () => {
    it('should create client with correct config', () => {
        process.argv.push('--scan');
        const { Client, LocalAuth } = require('whatsapp-web.js');
        require('../../dispatcher/src/main');

        expect(Client).toHaveBeenCalledWith({
            authStrategy: expect.any(LocalAuth),
            puppeteer: {
                headless: "new",
                args: ["--no-sandbox", '--disable-setuid-sandbox', "--disable-gpu"],
                protocolTimeout: 1200000
            }
        });
    });
});