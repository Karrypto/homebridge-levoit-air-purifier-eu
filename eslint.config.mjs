import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2018,
      sourceType: 'module',
    },
    rules: {
      semi: ['error', 'always'],
      'space-before-function-paren': 'off',
      'object-curly-newline': 'off',
      'comma-dangle': 'off',
      'no-console': 'error',
      quotes: ['error', 'single'],
      'generator-star-spacing': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  }
);
