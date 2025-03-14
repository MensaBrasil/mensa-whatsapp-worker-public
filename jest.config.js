export default {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.mjs', '**/?(*.)+(spec|test).mjs'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/temp_test/'],
  passWithNoTests: true,
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.mjs'],
  setupFiles: ['<rootDir>/tests/setEnvVars.mjs']
};