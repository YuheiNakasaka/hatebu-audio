# はてなブックマーク音声化システム

このシステムは、ユーザーのはてなブックマークから記事やPDFを取得し、内容を要約して1人のナレーターによる解説形式の音声ファイル（MP3）を生成するTypeScriptアプリケーションです。

## 機能

- はてなブックマークのRSSフィードからブックマーク情報を取得
- Webページやからの記事本文抽出
- PDFからのテキスト抽出
- OpenAI APIを使用した要約生成
- OpenAI APIを使用したナレーション生成
- Google Cloud TTSを使用した音声合成
- プレイリスト管理

## 必要条件

- Node.js 18.x以上
- npm または yarn
- OpenAI APIキー
- Google Cloud TTSの認証情報
- はてなブックマークのアカウント

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

```
# API Keys
OPENAI_API_KEY=your_openai_api_key_here
GOOGLE_APPLICATION_CREDENTIALS=path/to/your/google_credentials.json

# Hatena Bookmark
HATENA_USERNAME=your_hatena_username

# Application Settings
DB_PATH=./data/db/hatebu-audio.db
AUDIO_OUTPUT_DIR=./data/audio
MAX_BOOKMARKS_TO_PROCESS=10
LOG_LEVEL=info
```

5. データベースを初期化します。

```bash
npm run db:init
```

## 使用方法

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

### 個別のコマンド

```bash
# はてなブックマークからブックマーク情報を取得して保存
npm run dev -- fetch-bookmarks

# 未処理のブックマークからコンテンツを抽出して保存
npm run dev -- extract-contents

# 未処理のコンテンツから要約を生成して保存
npm run dev -- generate-summaries

# 未処理の要約からナレーションを生成して保存
npm run dev -- generate-narrations

# 未処理のナレーションから音声ファイルを生成して保存
npm run dev -- generate-audio-files

# ブックマーク取得から音声ファイル生成までの全処理を実行
npm run dev -- process-all

# ヘルプを表示
npm run dev -- help
```

### オプション

各コマンドには以下のオプションを指定できます。

```bash
# はてなユーザー名を指定（環境変数より優先）
npm run dev -- fetch-bookmarks --username=your_hatena_username

# 処理する最大件数を指定
npm run dev -- fetch-bookmarks --limit=10
```

## 動作確認手順

以下の手順で、はてなブックマークから記事を取得し、音声ファイルを生成するまでの一連の流れを確認できます。

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
