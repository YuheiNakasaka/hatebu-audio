/**
 * ブックマーク情報の型定義
 */
export interface Bookmark {
  id?: number;
  url: string;
  title: string;
  description?: string;
  bookmark_date: Date;
  tags?: string;
  content_type?: string;
  processed: boolean;
  created_at?: Date;
}

/**
 * コンテンツの型定義
 */
export interface Content {
  id?: number;
  bookmark_id: number;
  raw_content: string;
  extracted_at?: Date;
}

/**
 * ナレーションの型定義
 */
export interface Narration {
  id?: number;
  bookmark_id: number;
  narration_text: string;
  generated_at?: Date;
}

/**
 * 音声ファイルの型定義
 */
export interface AudioFile {
  id?: number;
  bookmark_id: number;
  file_path: string;
  duration?: number;
  generated_at?: Date;
}

/**
 * プレイリストの型定義
 */
export interface Playlist {
  id?: number;
  name: string;
  description?: string;
  created_at?: Date;
}

/**
 * プレイリスト項目の型定義
 */
export interface PlaylistItem {
  id?: number;
  playlist_id: number;
  audio_file_id: number;
  position: number;
  audio_file?: AudioFile;
  bookmark?: Bookmark;
}

/**
 * はてなブックマークのRSSアイテムの型定義
 */
export interface HatenaBookmarkItem {
  title: string;
  link: string;
  pubDate: string;
  description?: string;
  categories?: string[];
}

/**
 * 処理結果のステータス型定義
 */
export enum ProcessStatus {
  SUCCESS = "success",
  ERROR = "error",
  SKIPPED = "skipped",
}

/**
 * 処理結果の型定義
 */
export interface ProcessResult<T> {
  status: ProcessStatus;
  data?: T;
  message?: string;
  error?: Error;
}
