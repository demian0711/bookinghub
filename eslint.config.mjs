import js from '@eslint/js';
import ts from 'typescript-eslint';
import next from 'eslint-config-next/core-web-vitals';
import { defineConfig, globalIgnores } from 'eslint/config';
export default defineConfig([
  globalIgnores([
    '**/.next/**',
    '**/dist/**',
    '**/coverage/**',
    '**/generated/**',
    '**/next-env.d.ts',
  ]),
  js.configs.recommended,
  { files: ['**/*.{ts,tsx}'], extends: [ts.configs.recommended] },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    extends: [next],
    settings: { next: { rootDir: 'apps/web' } },
  },
  {
    files: ['apps/api/test/**/*.cjs'],
    languageOptions: { globals: { process: 'readonly', fetch: 'readonly' } },
  },
]);
