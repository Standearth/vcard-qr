// eslint.config.js
import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';

export default [
  // Global ignores
  {
    ignores: [
      'dist',
      'node_modules',
      '.turbo',
      'coverage',
      'eslint.config.js',
      'frontend/vite.config.ts',
      'packages/shared-utils/dist',
      'server/dist',
      'frontend/dist',
      'scripts/', // Ignore scripts from typed linting
    ],
  },
  // Base Recommended Config
  pluginJs.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  // Prettier config to disable conflicting rules
  eslintPluginPrettierRecommended,
  // New section for JS/MJS files
  {
    files: ['**/*.{js,mjs}'],
    ...pluginJs.configs.recommended,
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // Add any specific JS rules here if needed
    },
  },
  // Frontend Config
  {
    files: ['frontend/src/**/*.ts'],
    languageOptions: {
      globals: globals.browser,
      parser: tseslint.parser,
      parserOptions: {
        project: './frontend/tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  // Server Config
  {
    files: ['server/src/**/*.ts'],
    languageOptions: {
      globals: globals.node,
      parser: tseslint.parser,
      parserOptions: {
        project: './server/tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  // Shared Package Config
  {
    files: ['packages/shared-utils/src/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './packages/shared-utils/tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
];
