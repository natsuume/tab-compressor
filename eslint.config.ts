import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', '.vite/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.serviceworker,
        chrome: 'readonly',
      },
    },
    plugins: {
      '@stylistic': stylistic,
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@stylistic/semi': ['error', 'always'],
      '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
      '@stylistic/indent': ['error', 2, { SwitchCase: 1 }],
      '@stylistic/comma-dangle': ['error', 'always-multiline'],
      '@stylistic/no-trailing-spaces': 'error',
      '@stylistic/eol-last': ['error', 'always'],
      '@stylistic/object-curly-spacing': ['error', 'always'],
      '@stylistic/arrow-parens': ['error', 'always'],
      'prefer-arrow-callback': 'error',
      'func-style': ['error', 'expression', { allowArrowFunctions: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['vite.config.ts', 'manifest.config.ts', 'eslint.config.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
);
