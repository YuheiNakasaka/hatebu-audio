/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['example.com'], // 必要に応じて画像ドメインを追加
  },
  // 静的エクスポートの設定
  output: 'export',
  // ベースパスの設定（必要に応じて）
  // basePath: '',
  // 環境変数の設定
  env: {
    PODCAST_TITLE: 'はてなブックマークラジオ',
    PODCAST_DESCRIPTION: 'はてなブックマークの記事を要約して音声化したポッドキャスト',
  },
};

module.exports = nextConfig;
