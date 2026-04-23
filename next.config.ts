import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  turbopack: {
    /**
     * 상위 홈 디렉토리에 우연히 존재하는 lockfile 을 Next 가 workspace root 로 잘못
     * 추정하는 것을 막기 위해 명시적으로 지정한다.
     */
    root: path.resolve(import.meta.dirname),
  },
};

export default nextConfig;
