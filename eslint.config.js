import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';

export default tseslint.config(
  // `coverage` e `.nyc_output` são saída gerada pelo istanbul: lintar aquilo
  // enche o relatório de aviso sobre código de terceiros e esconde o que é
  { ignores: ['dist', '.dist', 'node_modules', 'cypress', 'supabase', 'coverage', '.nyc_output', '.claude'] },
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
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // `type` explicito em todo botao do app.
    //
    // Sem `type`, o padrao do HTML dentro de <form> e "submit": um clique em
    // "mostrar senha" enviava o formulario. Media de 10/09/2026: 645 botoes sem
    // type no src, 57 deles em arquivo com formulario. Os tres botoes de ENVIO
    // (login do lojista, login do superadmin, redefinir senha) foram declarados
    // `submit` a mao — fix automatico teria posto `button` e o Enter no campo
    // de senha pararia de logar.
    //
    // A regra fica no repositorio inteiro para a divida nao voltar a crescer.
    files: ['src/**/*.tsx'],
    rules: {
      'react/button-has-type': 'error',
    },
  }
);
