import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

// The simulation must stay pure and deterministic (SPEC §6): no DOM, no three.js,
// no React, no wall-clock time and no unseeded randomness.
const simPurityRules = {
  'no-restricted-imports': [
    'error',
    {
      paths: ['three', 'react', 'react-dom', 'zustand', 'idb-keyval'],
      patterns: ['three/*', '**/render/*', '**/input/*', '**/audio/*', '**/app/*', '**/store/*'],
    },
  ],
  'no-restricted-globals': ['error', 'window', 'document', 'navigator', 'performance', 'Date'],
  'no-restricted-properties': [
    'error',
    { object: 'Math', property: 'random', message: 'Use the seeded Rng from sim/rng.ts.' },
  ],
};

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'coverage', 'playwright-report', 'test-results'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  { files: ['src/game/sim/**/*.ts'], rules: simPurityRules },
  {
    files: ['scripts/**', '*.config.{js,ts}', 'tests/**'],
    languageOptions: { globals: globals.node },
  },
);
