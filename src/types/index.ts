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

/**
 * 結合音声ファイルの型定義
 */
export interface MergedAudioFile {
  id?: number;
  name: string;
  file_path: string;
  source_files: number[]; // 元の音声ファイルIDの配列
  duration?: number;
  created_at?: Date;
}

/**
 * Podcastエピソードの型定義
 */
export interface PodcastEpisode {
  id?: number;
  merged_audio_file_id: number;
  title: string;
  description?: string;
  source_bookmarks?: number[]; // 元のブックマークIDの配列
  published_at?: string;
  duration?: number;
  file_size?: number;
  storage_url?: string;
  is_published?: boolean;
}

/**
 * Podcast設定の型定義
 */
export interface PodcastSettings {
  id?: number;
  title: string;
  description?: string;
  author?: string;
  email?: string;
  language?: string;
  category?: string;
  explicit?: boolean;
  image_url?: string;
  website_url?: string;
  feed_url?: string;
  updated_at?: Date;
}
