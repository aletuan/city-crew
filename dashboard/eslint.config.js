// The dashboard's lint gate. Same doctrine as the app's (see
// app/eslint.config.js), a smaller surface: 1,900 lines of plain JavaScript
// with no typecheck behind it, which makes lint the *only* automated reader
// this package has for anything but its three tested modules.
//
// The first run found 12 problems, none of them a bug — the same result the
// app gave, and the same conclusion: this exists to catch the next one.

import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import hooks from 'eslint-plugin-react-hooks';

export default [
  // `.vite/` is the dep pre-bundle. It usually sits inside `node_modules` and
  // is covered by the first rule, but a dev run that predates the install
  // writes it at the package root — where `dashboard/.gitignore` hides it from
  // git and nothing hid it from here. Lint then read 500 lines of minified
  // React and failed the gate on vendor code that no one in this repo wrote.
  { ignores: ['node_modules/**', 'dist/**', '.vite/**'] },

  js.configs.recommended,

  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    plugins: { react, 'react-hooks': hooks },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...hooks.configs.recommended.rules,

      // Vite's JSX transform is automatic; nothing here imports React to
      // render, and prop-types is a runtime checker this package does not use.
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',

      // Apostrophes and quotes inside JSX text. The rule guards against a
      // stray brace being read as an expression, which is not what these are:
      // they are Vietnamese and English prose in a heading, and escaping them
      // would make the source harder to read than the thing it prevents.
      'react/no-unescaped-entities': 'off',

      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',

      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
    },
  },

  // The tests run under `node --test`, not in a browser.
  {
    files: ['tests/**/*.mjs'],
    languageOptions: { globals: { ...globals.node } },
  },
];
