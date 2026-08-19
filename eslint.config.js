import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';

export default tseslint.config(
  // `coverage` e `.nyc_output` são saída gerada pelo istanbul: lintar aquilo
  // enche o relatório de aviso sobre código de terceiros e esconde o que é
  // seu. `.dist` é build antigo pelo mesmo motivo.
  { ignores: ['dist', '.dist', 'node_modules', 'cypress', 'supabase', 'coverage', '.nyc_output'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'react': react,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react/no-deprecated': 'warn',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // We explicitly disable these TS strict rules for existing patterns to not break the build right now,
      // but strict typings are enforced by tsc.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
    },
  }
);
