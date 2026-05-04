import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['@ibizz/supabase', '@ibizz/storage', '@ibizz/ai-image', '@ibizz/ui'],
};

export default nextConfig;
