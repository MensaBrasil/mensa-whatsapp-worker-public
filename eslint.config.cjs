const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  {
    files: ['**/*.js', '**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      ecmaVersion: 'latest',
      globals: {
        ...globals.node,
        ...globals.es2021
      },
    },
    plugins: {},
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': 'warn',
      'no-console': 'off',
      'no-undef': 'error',
      'no-duplicate-imports': 'error',
      'no-constant-condition': 'warn',
      'no-unreachable': 'error',
      'no-extra-semi': 'warn',
      'no-undef-init': 'error',
      'no-unused-expressions': 'error',
      'no-use-before-define': 'error',
      'no-var': 'error',
      'camelcase': 'off',
      'eqeqeq': ['error', 'always'],
      'prefer-const': 'warn',
      'semi': ['error', 'always'],
      'quotes': ['warn', 'single'],
    },
  },
];
