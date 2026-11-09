import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const config = [
  ...nextVitals,
  ...nextTs,
  { ignores: ['.next/**', 'out/**', 'public/_pagefind/**', 'next-env.d.ts'] },
  // Nextra's _meta files are default-exported object literals by convention
  { files: ['**/_meta.{ts,tsx}'], rules: { 'import/no-anonymous-default-export': 'off' } },
];

export default config;
