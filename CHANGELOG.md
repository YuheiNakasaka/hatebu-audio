# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

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
