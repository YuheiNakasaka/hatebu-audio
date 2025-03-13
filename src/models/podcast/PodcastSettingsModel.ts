import sqlite3 from "sqlite3";
import dotenv from "dotenv";
import { PodcastSettings } from "../../types";

// 環境変数の読み込み
dotenv.config();

/**
 * Podcast設定モデルクラス
 */
export class PodcastSettingsModel {
  private db: sqlite3.Database;

  /**
   * コンストラクタ
   */
  constructor() {
    const dbPath = process.env.DB_PATH || "./data/db/hatebu-audio.db";
    this.db = new sqlite3.Database(dbPath);
  }

  /**
   * Podcast設定を取得
   * @returns Podcast設定情報
   */
  async getSettings(): Promise<PodcastSettings | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT * FROM podcast_settings ORDER BY id LIMIT 1`,
        (err, row: any) => {
          if (err) {
            reject(err);
          } else if (!row) {
            resolve(null);
          } else {
            const settings: PodcastSettings = {
              id: row.id,
              title: row.title,
              description: row.description,
              author: row.author,
              email: row.email,
              language: row.language,
              category: row.category,
              explicit: row.explicit === 1,
              image_url: row.image_url,
              website_url: row.website_url,
              feed_url: row.feed_url,
              updated_at: row.updated_at,
            };
            resolve(settings);
          }
        }
      );
    });
  }

  /**
   * Podcast設定を更新
   * @param settings 更新する設定情報
   * @returns 更新が成功したかどうか
   */
  async updateSettings(settings: Partial<PodcastSettings>): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
      // 現在の設定を取得
      const currentSettings = await this.getSettings();
      
      if (!currentSettings) {
        // 設定がまだ存在しない場合は作成
        this.db.run(
          `INSERT INTO podcast_settings (
            title, description, author, email, language, category, 
            explicit, image_url, website_url, feed_url
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            settings.title || "Yuhei Nakasakaのはてなブックマークラジオ",
            settings.description || "はてなブックマークの記事を要約して音声化したポッドキャスト",
            settings.author || "Yuhei Nakasaka",
            settings.email || null,
            settings.language || "ja",
            settings.category || "Technology",
            settings.explicit ? 1 : 0,
            settings.image_url || null,
            settings.website_url || null,
            settings.feed_url || null,
          ],
          function (err) {
            if (err) {
              reject(err);
            } else {
              resolve(true);
            }
          }
        );
      } else {
        // 既存の設定を更新
        const updateFields: string[] = [];
        const values: any[] = [];

        if (settings.title !== undefined) {
          updateFields.push("title = ?");
          values.push(settings.title);
        }

        if (settings.description !== undefined) {
          updateFields.push("description = ?");
          values.push(settings.description);
        }

        if (settings.author !== undefined) {
          updateFields.push("author = ?");
          values.push(settings.author);
        }

        if (settings.email !== undefined) {
          updateFields.push("email = ?");
          values.push(settings.email);
        }

        if (settings.language !== undefined) {
          updateFields.push("language = ?");
          values.push(settings.language);
        }

        if (settings.category !== undefined) {
          updateFields.push("category = ?");
          values.push(settings.category);
        }

        if (settings.explicit !== undefined) {
          updateFields.push("explicit = ?");
          values.push(settings.explicit ? 1 : 0);
        }

        if (settings.image_url !== undefined) {
          updateFields.push("image_url = ?");
          values.push(settings.image_url);
        }

        if (settings.website_url !== undefined) {
          updateFields.push("website_url = ?");
          values.push(settings.website_url);
        }

        if (settings.feed_url !== undefined) {
          updateFields.push("feed_url = ?");
          values.push(settings.feed_url);
        }

        // 更新日時を設定
        updateFields.push("updated_at = CURRENT_TIMESTAMP");

        if (updateFields.length === 0) {
          resolve(false);
          return;
        }

        values.push(currentSettings.id);

        this.db.run(
          `UPDATE podcast_settings SET ${updateFields.join(", ")} WHERE id = ?`,
          values,
          function (err) {
            if (err) {
              reject(err);
            } else {
              resolve(this.changes > 0);
            }
          }
        );
      }
    });
  }
}
