/** @type {import('next').NextConfig} */
const nextConfig = {
  // React 19互換性設定
  reactStrictMode: true,
  
  // Next.js の Image コンポーネントで外部ホストを許可（新しい形式）
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ykodiivanzutyivkguza.supabase.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  
  transpilePackages: ['mapbox-gl', 'react-map-gl'],
  
  // Webpack設定の更新
  webpack: (config, { isServer }) => {
    // pnpm/npmの互換性問題を解決
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    };
    
    // React 19対応 - JSX runtime aliases removed to prevent webpack conflicts
    
    return config;
  },
  
  // 実験的機能（React 19対応）
  experimental: {
    // サーバーアクションの設定
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
}

export default nextConfig
