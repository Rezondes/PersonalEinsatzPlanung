module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  // Injected by vite.config.ts (see the define block there); without this no-undef flags them.
  globals: {
    __APP_BUILD_TIME__: 'readonly',
    __APP_COMMIT__: 'readonly',
    __APP_IS_CI__: 'readonly',
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  plugins: ['react-refresh', 'import'],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    'import/no-restricted-paths': [
      'error',
      {
        zones: [
          {
            target: './src/domain',
            from: ['./src/application', './src/infrastructure', './src/ui'],
            message: 'domain darf niemals application/infrastructure/ui importieren (reine Domänenschicht).',
          },
          {
            target: './src/application',
            from: ['./src/infrastructure', './src/ui'],
            message: 'application darf infrastructure/ui nicht direkt importieren, nur über application/ports/* Interfaces.',
          },
        ],
      },
    ],
  },
};
