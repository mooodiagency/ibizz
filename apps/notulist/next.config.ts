import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['@ibizz/supabase', '@ibizz/pdf', '@ibizz/ui'],
};

export default nextConfig;
