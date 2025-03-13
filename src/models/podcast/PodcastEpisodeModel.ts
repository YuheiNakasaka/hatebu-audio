import sqlite3 from "sqlite3";
import dotenv from "dotenv";
import { PodcastEpisode } from "../../types";

// 環境変数の読み込み
dotenv.config();

/**
 * Podcastエピソードモデルクラス
 */
export class PodcastEpisodeModel {
  private db: sqlite3.Database;

  /**
   * コンストラクタ
   */
  constructor() {
    const dbPath = process.env.DB_PATH || "./data/db/hatebu-audio.db";
    this.db = new sqlite3.Database(dbPath);
  }

  /**
   * Podcastエピソードを作成
   * @param episode Podcastエピソード情報
   * @returns 作成されたエピソードのID
   */
  async create(episode: PodcastEpisode): Promise<number> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO podcast_episodes (
          merged_audio_file_id, title, description, source_bookmarks,
          published_at, duration, file_size, storage_url, is_published
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          episode.merged_audio_file_id,
          episode.title,
          episode.description,
          JSON.stringify(episode.source_bookmarks || []),
          episode.published_at || new Date().toISOString(),
          episode.duration,
          episode.file_size,
          episode.storage_url,
          episode.is_published ? 1 : 0,
        ],
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.lastID);
          }
        }
      );
    });
  }

  /**
   * IDによるPodcastエピソードの取得
   * @param id エピソードID
   * @returns Podcastエピソード情報
   */
  async findById(id: number): Promise<PodcastEpisode | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT * FROM podcast_episodes WHERE id = ?`,
        [id],
        (err, row: any) => {
          if (err) {
            reject(err);
          } else if (!row) {
            resolve(null);
          } else {
            const episode: PodcastEpisode = {
              id: row.id,
              merged_audio_file_id: row.merged_audio_file_id,
              title: row.title,
              description: row.description,
              source_bookmarks: JSON.parse(row.source_bookmarks || "[]"),
              published_at: row.published_at,
              duration: row.duration,
              file_size: row.file_size,
              storage_url: row.storage_url,
              is_published: row.is_published === 1,
            };
            resolve(episode);
          }
        }
      );
    });
  }

  /**
   * 結合音声ファイルIDによるPodcastエピソードの取得
   * @param mergedAudioFileId 結合音声ファイルID
   * @returns Podcastエピソード情報
   */
  async findByMergedAudioFileId(mergedAudioFileId: number): Promise<PodcastEpisode | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT * FROM podcast_episodes WHERE merged_audio_file_id = ?`,
        [mergedAudioFileId],
        (err, row: any) => {
          if (err) {
            reject(err);
          } else if (!row) {
            resolve(null);
          } else {
            const episode: PodcastEpisode = {
              id: row.id,
              merged_audio_file_id: row.merged_audio_file_id,
              title: row.title,
              description: row.description,
              source_bookmarks: JSON.parse(row.source_bookmarks || "[]"),
              published_at: row.published_at,
              duration: row.duration,
              file_size: row.file_size,
              storage_url: row.storage_url,
              is_published: row.is_published === 1,
            };
            resolve(episode);
          }
        }
      );
    });
  }

  /**
   * 全てのPodcastエピソードを取得
   * @param limit 取得する最大件数
   * @param offset 取得開始位置
   * @param publishedOnly 公開済みのみ取得するかどうか
   * @returns Podcastエピソード情報の配列
   */
  async findAll(limit: number = 100, offset: number = 0, publishedOnly: boolean = false): Promise<PodcastEpisode[]> {
    return new Promise((resolve, reject) => {
      const query = publishedOnly
        ? `SELECT * FROM podcast_episodes WHERE is_published = 1 ORDER BY published_at DESC LIMIT ? OFFSET ?`
        : `SELECT * FROM podcast_episodes ORDER BY published_at DESC LIMIT ? OFFSET ?`;

      this.db.all(query, [limit, offset], (err, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          const episodes: PodcastEpisode[] = rows.map((row) => ({
            id: row.id,
            merged_audio_file_id: row.merged_audio_file_id,
            title: row.title,
            description: row.description,
            source_bookmarks: JSON.parse(row.source_bookmarks || "[]"),
            published_at: row.published_at,
            duration: row.duration,
            file_size: row.file_size,
            storage_url: row.storage_url,
            is_published: row.is_published === 1,
          }));
          resolve(episodes);
        }
      });
    });
  }

  /**
   * Podcastエピソードを更新
   * @param id エピソードID
   * @param episode 更新するエピソード情報
   * @returns 更新が成功したかどうか
   */
  async update(id: number, episode: Partial<PodcastEpisode>): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const updateFields: string[] = [];
      const values: any[] = [];

      if (episode.title !== undefined) {
        updateFields.push("title = ?");
        values.push(episode.title);
      }

      if (episode.description !== undefined) {
        updateFields.push("description = ?");
        values.push(episode.description);
      }

      if (episode.source_bookmarks !== undefined) {
        updateFields.push("source_bookmarks = ?");
        values.push(JSON.stringify(episode.source_bookmarks));
      }

      if (episode.published_at !== undefined) {
        updateFields.push("published_at = ?");
        values.push(episode.published_at);
      }

      if (episode.duration !== undefined) {
        updateFields.push("duration = ?");
        values.push(episode.duration);
      }

      if (episode.file_size !== undefined) {
        updateFields.push("file_size = ?");
        values.push(episode.file_size);
      }

      if (episode.storage_url !== undefined) {
        updateFields.push("storage_url = ?");
        values.push(episode.storage_url);
      }

      if (episode.is_published !== undefined) {
        updateFields.push("is_published = ?");
        values.push(episode.is_published ? 1 : 0);
      }

      if (updateFields.length === 0) {
        resolve(false);
        return;
      }

      values.push(id);

      this.db.run(
        `UPDATE podcast_episodes SET ${updateFields.join(", ")} WHERE id = ?`,
        values,
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.changes > 0);
          }
        }
      );
    });
  }

  /**
   * Podcastエピソードを削除
   * @param id エピソードID
   * @returns 削除が成功したかどうか
   */
  async delete(id: number): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `DELETE FROM podcast_episodes WHERE id = ?`,
        [id],
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.changes > 0);
          }
        }
      );
    });
  }

  /**
   * 最新のエピソード番号を取得
   * @returns 最新のエピソード番号
   */
  async getLatestEpisodeNumber(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT COUNT(*) as count FROM podcast_episodes`,
        (err, row: any) => {
          if (err) {
            reject(err);
          } else {
            resolve(row.count);
          }
        }
      );
    });
  }
}
