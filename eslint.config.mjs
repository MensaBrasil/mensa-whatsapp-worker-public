import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      sourceType: 'module',
      ecmaVersion: 'latest',
      globals: {
        ...globals.node,
        ...globals.es2025
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
      'camelcase': 'off',
      'eqeqeq': ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'warn',
      'semi': ['error', 'always'],
      'quotes': ['warn', 'single'],
    },
  },
];