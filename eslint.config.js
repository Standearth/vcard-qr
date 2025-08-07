import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  // Configuration for Frontend TypeScript (src/**/*.ts)
  {
    ignores: ['dist/'],
    files: ['src/**/*.ts'],
    languageOptions: {
      globals: globals.browser,
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      ...pluginJs.configs.recommended.rules,
      ...tseslint.configs.recommendedTypeChecked.rules,
      // You can add custom rules here
    },
  },
  // NEW: Configuration for Backend TypeScript (server/src/**/*.ts)
  {
    files: ['server/src/**/*.ts'],
    languageOptions: {
      globals: globals.node,
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './server/tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      ...pluginJs.configs.recommended.rules,
      ...tseslint.configs.recommendedTypeChecked.rules,
    },
  },
];
