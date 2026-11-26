import type { NextConfig } from 'next';
const config: NextConfig = {
  agentRules: false,
  async rewrites() {
    const origin = process.env.API_ORIGIN ?? 'http://127.0.0.1:4000';
    return [
      { source: '/api/v1/:path*', destination: origin + '/api/v1/:path*' },
    ];
  },
};
export default config;
