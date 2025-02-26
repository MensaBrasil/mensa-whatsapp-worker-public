module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js', '**/?(*.)+(spec|test).js?(x)'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/temp_test/'],
  passWithNoTests: true,
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.mjs'],
  setupFiles: ['<rootDir>/tests/setEnvVars.js']
};