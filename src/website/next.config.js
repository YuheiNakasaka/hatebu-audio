/** @type {import('next').NextConfig} */
// .envファイルから環境変数をロード
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

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
    PODCAST_WEBSITE_URL: process.env.PODCAST_WEBSITE_URL || 'https://your-podcast-website.pages.dev',
  },
};

module.exports = nextConfig;
