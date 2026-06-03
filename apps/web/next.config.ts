import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@eskwelabs-advisor/server', '@eskwelabs-advisor/ui']
};

export default nextConfig;
