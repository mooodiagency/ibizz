import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['@ibizz/supabase', '@ibizz/ui', '@ibizz/storage', '@ibizz/ai-video'],
};

export default nextConfig;
