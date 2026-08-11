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
        /*
         * Both programs, because the tooling scripts became TypeScript on 2026-08-11 and live in
         * their own tsconfig. `projectService` only knows about files a listed project includes, and
         * a .ts file in no project is a parsing error rather than an unlinted file, so leaving this
         * as a bare `true` failed the lint outright rather than quietly skipping them.
         */
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
      // Asserting on a mock means passing the method itself, unbound, to expect. That is the
      // intended shape of a mock assertion rather than an accidental loss of this.
      '@typescript-eslint/unbound-method': 'off',
    },
  },

  /*
   * Tooling files run under node, not the browser, and report to a terminal rather than a log.
   *
   * The scripts became TypeScript on 2026-08-11 and are checked by their own program,
   * `npm run typecheck:scripts` against tsconfig.scripts.json. Type AWARE lint rules stay off for
   * them, which is a staging decision rather than an exemption: turning them on against 3,795 lines
   * that were untyped JavaScript produces 1,895 findings, a migration of its own. Genuine type
   * errors are still reported, so the files are checked; they are simply not yet held to the
   * stylistic rules the app is.
   */
  {
    files: ['**/*.js', 'scripts/**/*.ts'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      'no-console': 'off',
    },
  },

  // The Foundry tools are genuinely both, added 2026-08-09. They run under node, but every function
  // body handed to page.evaluate executes in the browser inside a live Foundry, so document,
  // KeyboardEvent and Foundry's own globals are all legitimate references in them. Scoped to
  // foundry-*.ts rather than to scripts/**, so no unrelated tool file silently gains browser globals
  // it has no business using.
  {
    files: ['scripts/foundry-*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
        game: 'readonly',
        ui: 'readonly',
        canvas: 'readonly',
        Scene: 'readonly',
        // Added 2026-08-10 for the hover check, which creates a probe Actor to hang tokens on.
        Actor: 'readonly',
        // Added 2026-08-10 for the play probe, which creates a probe player and configures ownership.
        User: 'readonly',
        CONST: 'readonly',
        foundry: 'readonly',
      },
    },
  }
);
