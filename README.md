# はてなブックマーク音声化システム

このシステムは、ユーザーのはてなブックマークから記事やPDFを取得し、内容を要約して1人のナレーターによる解説形式の音声ファイル（MP3）を生成するTypeScriptアプリケーションです。また、生成された音声ファイルをPodcastとして配信する機能も備えています。

## 機能

- はてなブックマークのRSSフィードからブックマーク情報を取得
- Webページやからの記事本文抽出
- PDFからのテキスト抽出
- OpenAI APIを使用した要約生成
- OpenAI APIを使用したナレーション生成
- Google Cloud TTSを使用した音声合成
- 複数の音声ファイルを一つのMP3ファイルに結合（音声ファイル間に2.5秒の無音を挿入）
- ラジオ風の挨拶と結びを自動的に追加（process-allコマンド実行時）
- **音声ファイルをCloudflare R2にアップロードしてPodcastとして配信**
- **Podcast用のRSSフィードを自動生成**
- **過去の配信を一覧表示するWebサイトの自動生成とデプロイ**

## 必要条件

- Node.js 18.x以上
- npm または yarn
- OpenAI APIキー
- Google Cloud TTSの認証情報
- はてなブックマークのアカウント
- **Cloudflareアカウント（R2ストレージとPagesを使用）**

## セットアップ

1. リポジトリをクローンまたはダウンロードします。

2. 依存関係をインストールします。

```bash
npm install
```

3. `.env.example`をコピーして`.env`ファイルを作成し、必要な環境変数を設定します。

```bash
cp .env.example .env
```

4. `.env`ファイルを編集して、以下の環境変数を設定します。

- `.env`ファイルをコピーして`src/website/.env`ファイルを作成します。

5. データベースを初期化します。

```bash
npm run db:init
```

6. Cloudflareの設定を行います。

   a. Cloudflareダッシュボードで、R2バケットを作成します。
   b. R2バケットの公開アクセスを設定します。
   c. Cloudflare Pagesプロジェクトを作成します。
   d. APIトークンを生成し、アクセスキーとシークレットキーを取得します。

## 使用方法

### 音声の作成/feed作成/websiteの更新を一気に行うコマンド

```bash
npm run podcast:all
```

### コマンドラインインターフェース

以下のコマンドを使用して、システムの各機能を実行できます。

```bash
# 開発モードで実行
npm run dev

# ビルドして実行
npm run build
npm start
```

### 対話型モード

引数なしでコマンドを実行すると、対話型モードが起動します。

```bash
npm run dev
```

### 音声生成コマンド

```bash
# はてなブックマークからブックマーク情報を取得して保存
npm run dev -- fetch-bookmarks

# 未処理のブックマークからコンテンツを抽出して保存
npm run dev -- extract-contents

# 未処理の要約からナレーションを生成して保存
npm run dev -- generate-narrations

# 未処理のナレーションから音声ファイルを生成して保存
npm run dev -- generate-audio-files

# 指定した音声ファイルを一つのMP3ファイルに結合
npm run dev -- merge-audio-files --ids=1,2,3 --name="結合ファイル名"

# 未処理の音声ファイル（まだマージされていない音声ファイル）を自動でマージ
npm run dev -- merge-unprocessed --name="結合ファイル名"

# ブックマーク取得から音声ファイル生成・結合までの全処理を実行（ラジオ風の挨拶と結びを追加）
npm run dev -- process-all

# ヘルプを表示
npm run dev -- help
```

### Podcast配信コマンド

```bash
# 音声ファイルをアップロードしてPodcastエピソードとして公開（メタデータ自動生成）
npm run dev -- publish-episode --file-id=1 --auto-metadata

# メタデータを手動で指定する場合
npm run dev -- publish-episode --file-id=1 --title="エピソードタイトル" --description="説明文"

# Podcastの設定を更新
npm run dev -- update-podcast-settings

# RSSフィードを生成
npm run dev -- generate-feed

# Webサイトをビルド
npm run dev -- build-website

# Webサイトをデプロイ
npm run dev -- deploy-website

# 全てのPodcast関連処理を実行（アップロード、メタデータ自動生成、フィード生成、Webサイトビルド、デプロイ）
npm run dev -- publish-podcast --file-id=1
```

### オプション

各コマンドには以下のオプションを指定できます。

```bash
# はてなユーザー名を指定（環境変数より優先）
npm run dev -- fetch-bookmarks --username=your_hatena_username

# 処理する最大件数を指定
npm run dev -- fetch-bookmarks --limit=10
```

### websiteの開発

```bash
npm run dev:website
```

#### .envのシンボリックリンク作成

```bash
ln -s .env src/website/.env
```

### ラジオ風の挨拶と結び

process-allコマンドを実行すると、結合された音声ファイルの前後に以下のような挨拶と結びが自動的に追加されます：

- 開始時: "こんにちは、はてなブックマークラジオへようこそ。今回のブックマークをご紹介します。"
- 終了時: "以上で今回のはてなブックマークラジオを終わります。お聴きいただきありがとうございました。"

これらの音声ファイルは初回のみ生成され、以降は再利用されます。音声ファイルは ./data/audio ディレクトリに以下のファイル名で保存されます：

- radio_intro.mp3: 開始時の挨拶
- radio_outro.mp3: 終了時の結び

## Podcast配信の設定

### Cloudflare R2の設定

1. Cloudflareダッシュボードにログインします。
2. R2を選択し、新しいバケットを作成します。
3. バケット名を設定します（例：`hatebu-audio-podcast`）。
4. 「公開アクセス」を有効にします。
5. 「APIトークン」から新しいAPIトークンを生成し、アクセスキーとシークレットキーを取得します。

### Cloudflare Pagesの設定

1. Cloudflareダッシュボードで「Pages」を選択します。
2. 「プロジェクトを作成」をクリックします。
3. プロジェクト名を設定します（例：`hatebu-audio-podcast`）。
4. デプロイ方法として「Direct Upload」を選択します。

### 環境変数の設定

`.env`ファイルに以下の環境変数を追加します：

```
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
CLOUDFLARE_ACCESS_KEY_ID=your_cloudflare_access_key_id
CLOUDFLARE_SECRET_ACCESS_KEY=your_cloudflare_secret_access_key
CLOUDFLARE_R2_BUCKET=your_r2_bucket_name
CLOUDFLARE_R2_PUBLIC_URL=https://your-public-bucket-url.example.com
CLOUDFLARE_PAGES_PROJECT=your_pages_project_name
PODCAST_WEBSITE_URL=https://your-podcast-website.pages.dev
PODCAST_FEED_URL=https://your-podcast-website.pages.dev/feed.xml
```

## 動作確認手順

### 音声ファイル生成

1. 環境変数を設定します。

```bash
# .envファイルを作成
cp .env.example .env

# .envファイルを編集して必要な情報を設定
# - OpenAI APIキー
# - Google Cloud TTSの認証情報
# - はてなユーザー名
```

2. データベースを初期化します。

```bash
npm run db:init
```

3. 全処理を実行します。

```bash
# 対話型モードで実行
npm run dev

# または直接全処理を実行
npm run dev -- process-all --username=your_hatena_username --limit=5
```

4. 生成された音声ファイルを確認します。

```bash
# 音声ファイルは以下のディレクトリに保存されます
ls -la ./data/audio
```

### Podcast配信

1. 音声ファイルをPodcastエピソードとして公開します。

```bash
# 音声ファイルをアップロードしてPodcastエピソードとして公開
npm run dev -- publish-podcast --file-id=1
```

2. 生成されたWebサイトとRSSフィードを確認します。

```bash
# WebサイトURL
echo $PODCAST_WEBSITE_URL

# フィードURL
echo $PODCAST_FEED_URL
```

## トラブルシューティング

### OpenAI APIキーの設定

OpenAI APIキーが正しく設定されていない場合、要約やナレーションの生成に失敗します。APIキーは[OpenAIのダッシュボード](https://platform.openai.com/account/api-keys)から取得できます。

### Google Cloud TTSの認証情報

Google Cloud TTSの認証情報が正しく設定されていない場合、音声ファイルの生成に失敗します。認証情報は[Google Cloudコンソール](https://console.cloud.google.com/)から取得できます。

1. Google Cloudプロジェクトを作成します。
2. Cloud Text-to-Speech APIを有効にします。
3. サービスアカウントを作成し、JSONキーをダウンロードします。
4. ダウンロードしたJSONキーのパスを`GOOGLE_APPLICATION_CREDENTIALS`環境変数に設定します。

### はてなユーザー名の設定

はてなユーザー名が正しく設定されていない場合、ブックマーク情報の取得に失敗します。はてなブックマークのユーザー名は、はてなブックマークのURLから確認できます（例：`https://b.hatena.ne.jp/username/`）。

### Cloudflare設定の問題

Cloudflareの設定に問題がある場合、以下を確認してください：

1. アカウントIDとAPIトークンが正しく設定されているか
2. R2バケットが正しく作成され、公開アクセスが有効になっているか
3. Pagesプロジェクトが正しく設定されているか
4. ネットワーク接続に問題がないか
