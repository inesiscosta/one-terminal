import nextra from 'nextra';

const withNextra = nextra({
  latex: true,
  defaultShowCopyCode: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = withNextra({
  output: 'export',
  reactStrictMode: true,
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
  turbopack: {
    resolveAlias: {
      'next-mdx-import-source-file': './src/mdx-components.ts',
    },
  },
});

export default nextConfig;
