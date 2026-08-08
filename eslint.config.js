import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**'],
  },

  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // The project rule is that any needs a written justification. Keeping this an error means
      // reaching for it forces an explicit eslint-disable line, which is exactly the moment the
      // justifying comment gets written.
      '@typescript-eslint/no-explicit-any': 'error',

      // Foundry hooks hand back untyped values constantly. Escape hatches stay available but must
      // be deliberate and described.
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': { descriptionFormat: '^: .+$' },
          'ts-ignore': true,
          'ts-nocheck': true,
        },
      ],

      // Event dispatch is fire and forget in places, but a dropped promise in the settings or
      // canvas paths is a real bug, so it has to be voided explicitly.
      '@typescript-eslint/no-floating-promises': 'error',

      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
      'no-param-reassign': 'error',
    },
  },

  // Test files legitimately poke at internals and build throwaway fixtures.
  {
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },

  // Plain JS tooling files sit outside the typed program and run under node, not the browser.
  {
    files: ['**/*.js', '**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      'no-console': 'off',
    },
  }
);
