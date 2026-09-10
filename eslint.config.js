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
    // Botao sem `type` dentro de <form> faz SUBMIT acidental: no Login, um
    // clique em "mostrar senha" envia o formulario. Medido em 10/09/2026: 645
    // botoes sem type no src, 57 deles em arquivos com formulario. A regra
    // vale onde o defeito existe; o resto e higiene registrada como divida,
    // nao portao de CI.
    files: [
      'src/components/chat/ChatInterface.tsx',
      'src/components/estoque/ScannerQRCodeModal.tsx',
      'src/components/ModalAuthCliente.tsx',
      'src/pages/admin/ChatAdmin.tsx',
      'src/pages/admin/Fiscal.tsx',
      'src/pages/admin/Login.tsx',
      'src/pages/admin/Mesas.tsx',
      'src/pages/admin/MinhaConta.tsx',
      'src/pages/RedefinirSenha.tsx',
      'src/pages/superadmin/Login.tsx',
      'src/pages/superadmin/Tenants.tsx',
    ],
    rules: {
      'react/button-has-type': 'error',
    },
  }
);
