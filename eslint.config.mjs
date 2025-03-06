import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import nodePlugin from 'eslint-plugin-n';
import globals from 'globals';

export default [
  js.configs.recommended,
  importPlugin.flatConfigs.recommended,
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2021
      }
    },
    plugins: {
      n: nodePlugin,
    },
    settings: {
      'import/resolver': {
        node: {
          extensions: ['.mjs', '.js', '.json'],
          moduleDirectory: ['node_modules', 'src'],
        },
      },
      n: {
        version: '20.18.3',
        tryExtensions: ['.mjs', '.js', '.json'],
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      'strict': 'off',
      'no-console': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

      'no-undef': 'error',
      'no-duplicate-imports': 'error',
      'no-constant-condition': 'warn',
      'no-unreachable': 'error',
      'no-extra-semi': 'warn',
      'no-undef-init': 'error',
      'no-unused-expressions': 'error',
      'no-use-before-define': 'error',
      'no-var': 'error',
      'eqeqeq': ['error', 'always'],
      'prefer-const': 'warn',
      'semi': ['error', 'always'],
      'quotes': ['warn', 'single'],
      'n/no-missing-import': 'error',
      'n/no-unsupported-features/es-syntax': 'error',
      'n/file-extension-in-import': ['error', 'always'],

      'import/extensions': ['error', 'ignorePackages'],
      'import/no-unresolved': ['error', { commonjs: true }],
      'import/order': ['error', {
        'newlines-between': 'always',
        'alphabetize': { order: 'asc', caseInsensitive: true },
      }],
    },
  },
  {
    files: ['**/*.test.mjs', '**/*.spec.mjs'],
    languageOptions: {
      globals: {
        ...globals.jest
      }
    }
  }
];