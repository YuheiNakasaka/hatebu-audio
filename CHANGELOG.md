# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- タイムコードジャンプ機能の追加
  - エピソード概要に含まれるタイムコード（00:00:00形式）をクリックすると該当部分にジャンプする機能
  - AudioPlayerコンポーネントに特定時間位置への移動機能を実装
  - タイムコードを自動検出してクリック可能なリンクに変換する機能
  - クリック時に該当部分から再生を開始する機能

### Added

- エピソードメタデータ更新機能の追加
  - 指定したエピソードIDのタイトルと説明文を再生成する機能
  - `update-episode-metadata`コマンドの実装
  - エピソードに関連するブックマーク情報を使ってAIでタイトルと説明文を生成
  - 既存のエピソードメタデータを更新する機能

### Added

- AudioPlayerコンポーネントに倍速再生機能を追加
  - カスタムオーディオプレイヤーに再生速度変更機能を実装
  - 0.5x, 0.75x, 1.0x, 1.25x, 1.5x, 2.0xの再生速度選択ボタンを追加
  - 現在選択中の再生速度を強調表示する機能

### Fixed

- Webサイトビルド失敗問題の修正
  - Next.jsの静的エクスポート（output: 'export'）とISR（Incremental Static Regeneration）機能の互換性問題を解決
  - ページコンポーネントから`revalidate`オプションを削除
  - 動的ルーティングの`fallback: 'blocking'`設定を静的エクスポート互換の`fallback: false`に変更

### Fixed

- OpenAI APIのバージョンアップ（v4）に対応
  - NarrationServiceのOpenAI API呼び出し部分を修正
  - 古いConfiguration, OpenAIApiクラスの使用から新しいOpenAIクラスの使用に変更
  - createChatCompletionメソッドからchat.completions.createメソッドへの変更
  - レスポンス構造の変更に対応

### Added

- Podcast配信用Webサイトの実装
  - Next.jsを使用したWebサイトの実装
  - エピソード一覧ページと詳細ページの実装
  - 音声プレイヤーコンポーネントの実装
  - レスポンシブデザインの適用
  - SQLiteデータベースからのデータ取得機能
  - 静的サイト生成（SSG）の設定

- Cloudflare Pagesデプロイ機能の修正
  - デプロイスクリプトのバグ修正
  - エラーハンドリングの強化
  - ビルドスクリプトの最適化

- 音声ファイル結合時に無音を挿入する機能の追加
  - 音声ファイル間に2.5秒の無音を自動的に挿入
  - FFmpegのcomplexFilterを使用して効率的に実装
  - 無音の長さをパラメータで設定可能（デフォルト: 2.5秒）

### Added

- 未処理の音声ファイル自動マージ機能の実装
  - 未処理の音声ファイル（まだマージされていない音声ファイル）を自動でマージする機能
  - process-allコマンドの最後にファイル結合処理を追加
  - 未処理の音声ファイルを結合するための専用コマンド（merge-unprocessed）の追加
  - 対話型モードに「未処理の音声ファイルを結合」オプションを追加

### Added

- 音声ファイル結合機能の実装
  - 複数の音声ファイルを一つのMP3ファイルに結合する機能
  - プレイリストの音声ファイルを結合する機能
  - 指定した音声ファイルIDを結合する機能
  - 結合音声ファイル情報をデータベースに保存する機能
  - コマンドラインインターフェースの拡張（merge-playlist, merge-audio-files）
  - 対話型モードの拡張

### Added

- コマンドラインインターフェース(CLI)の実装
  - 対話型モードの実装
  - 各種コマンドの実装（fetch-bookmarks, extract-contents, generate-summaries, generate-narrations, generate-audio-files, process-all）
  - コマンドラインオプションの実装（--username, --limit）
  - 処理状況の表示機能
  - エラーハンドリング機能

- READMEの作成
  - セットアップ手順
  - 使用方法
  - 動作確認手順
  - トラブルシューティング

### Added

- ナレーション生成サービス(NarrationService)の実装
  - OpenAI APIを使用して要約からナレーションテキストを生成する機能
  - 生成したナレーションテキストをデータベースに保存する機能
  - 未処理の要約からナレーションテキストを生成して保存する機能

- 音声合成サービス(TTSService)の実装
  - Google Cloud TTSを使用してナレーションテキストから音声ファイルを生成する機能
  - 生成した音声ファイルをデータベースに保存する機能
  - 未処理のナレーションから音声ファイルを生成して保存する機能

- プレイリスト管理サービス(PlaylistService)の実装
  - プレイリストの作成、取得、更新、削除機能
  - プレイリストへの音声ファイルの追加、削除機能
  - プレイリスト内の音声ファイルの順序変更機能
  - プレイリスト内の音声ファイルの取得機能

- 各サービスのテストを追加
  - ナレーション生成サービスのテスト
  - 音声合成サービスのテスト
  - プレイリスト管理サービスのテスト

- 型定義の拡張
  - Playlistインターフェースにdescriptionフィールドを追加
  - PlaylistItemインターフェースにaudio_fileとbookmarkフィールドを追加

## [0.1.0] - 2025-03-09

### Added

- データベースサービス(DatabaseService)の実装
- ブックマーク取得サービス(BookmarkService)の実装
- コンテンツ抽出サービス(ContentService)の実装
- 要約生成サービス(SummaryService)の実装
- 各種モデルの実装
  - BookmarkModel
  - ContentModel
  - SummaryModel
  - NarrationModel
  - AudioFileModel
  - PlaylistModel
- データベース初期化スクリプト(initDb.ts)の実装
