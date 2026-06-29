import type { NextConfig } from "next";
import { execSync } from "child_process";

let buildNumber = "0";
try {
  buildNumber = execSync("git rev-list --count HEAD").toString().trim();
} catch {
  buildNumber = Date.now().toString();
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_NUMBER: buildNumber,
  },
  experimental: {
    serverActions: { bodySizeLimit: "50mb" },
  },
};

export default nextConfig;
