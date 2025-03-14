import { DatabaseService } from "../services/database/DatabaseService";
import { Bookmark, AudioFile } from "../types";

/**
 * ブックマーク情報を管理するモデルクラス
 */
export class BookmarkModel {
  private db: DatabaseService;

  /**
   * コンストラクタ
   */
  constructor() {
    this.db = DatabaseService.getInstance();
  }

  /**
   * ブックマークを作成
   * @param bookmark ブックマーク情報
   * @returns 作成されたブックマークのID
   */
  async create(bookmark: Bookmark): Promise<number> {
    await this.db.connect();

    const sql = `
      INSERT INTO bookmarks (
        url, title, description, bookmark_date, tags, content_type, processed
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      bookmark.url,
      bookmark.title,
      bookmark.description || null,
      bookmark.bookmark_date.toISOString(),
      bookmark.tags || null,
      bookmark.content_type || null,
      bookmark.processed ? 1 : 0,
    ];

    await this.db.run(sql, params);

    // 作成されたブックマークのIDを取得
    const result = await this.db.get<{ id: number }>(
      "SELECT last_insert_rowid() as id"
    );

    return result?.id || 0;
  }

  /**
   * IDによるブックマークの取得
   * @param id ブックマークID
   * @returns ブックマーク情報
   */
  async findById(id: number): Promise<Bookmark | null> {
    await this.db.connect();

    const sql = "SELECT * FROM bookmarks WHERE id = ?";
    const bookmark = await this.db.get<Bookmark>(sql, [id]);

    if (!bookmark) {
      return null;
    }

    // SQLiteのブール値を変換
    bookmark.processed = !!bookmark.processed;

    // 日付文字列をDateオブジェクトに変換
    if (bookmark.bookmark_date && typeof bookmark.bookmark_date === "string") {
      bookmark.bookmark_date = new Date(bookmark.bookmark_date);
    }
    if (bookmark.created_at && typeof bookmark.created_at === "string") {
      bookmark.created_at = new Date(bookmark.created_at);
    }

    return bookmark;
  }

  /**
   * URLによるブックマークの取得
   * @param url ブックマークのURL
   * @returns ブックマーク情報
   */
  async findByUrl(url: string): Promise<Bookmark | null> {
    await this.db.connect();

    const sql = "SELECT * FROM bookmarks WHERE url = ?";
    const bookmark = await this.db.get<Bookmark>(sql, [url]);

    if (!bookmark) {
      return null;
    }

    // SQLiteのブール値を変換
    bookmark.processed = !!bookmark.processed;

    // 日付文字列をDateオブジェクトに変換
    if (bookmark.bookmark_date && typeof bookmark.bookmark_date === "string") {
      bookmark.bookmark_date = new Date(bookmark.bookmark_date);
    }
    if (bookmark.created_at && typeof bookmark.created_at === "string") {
      bookmark.created_at = new Date(bookmark.created_at);
    }

    return bookmark;
  }

  /**
   * 音声ファイルIDによるブックマークの取得
   * @param audioFileId 音声ファイルID
   * @returns 音声ファイルとブックマーク情報
   */
  async findByAudioFileId(audioFileId: number): Promise<{ audio_file: AudioFile; bookmark: Bookmark } | null> {
    await this.db.connect();

    const sql = `
      SELECT 
        a.*, b.*,
        a.id as audio_file_id, b.id as bookmark_id,
        a.generated_at as audio_file_created_at, b.created_at as bookmark_created_at
      FROM 
        audio_files a
      JOIN 
        bookmarks b ON a.bookmark_id = b.id
      WHERE 
        a.id = ?
    `;
    
    const result = await this.db.get<any>(sql, [audioFileId]);

    if (!result) {
      return null;
    }

    // 結果を音声ファイルとブックマークに分割
    const audioFile: AudioFile = {
      id: result.audio_file_id,
      bookmark_id: result.bookmark_id,
      file_path: result.file_path,
      duration: result.duration,
      generated_at: result.audio_file_created_at ? new Date(result.audio_file_created_at) : undefined,
    };

    const bookmark: Bookmark = {
      id: result.bookmark_id,
      url: result.url,
      title: result.title,
      description: result.description,
      bookmark_date: result.bookmark_date ? new Date(result.bookmark_date) : new Date(),
      tags: result.tags,
      content_type: result.content_type,
      processed: !!result.processed,
      created_at: result.bookmark_created_at ? new Date(result.bookmark_created_at) : undefined,
    };

    return { audio_file: audioFile, bookmark };
  }

  /**
   * 全ブックマークの取得
   * @param limit 取得件数（デフォルト: 100）
   * @param offset 開始位置（デフォルト: 0）
   * @returns ブックマーク情報の配列
   */
  async findAll(limit = 100, offset = 0): Promise<Bookmark[]> {
    await this.db.connect();

    const sql = "SELECT * FROM bookmarks ORDER BY bookmark_date DESC LIMIT ? OFFSET ?";
    const bookmarks = await this.db.all<Bookmark>(sql, [limit, offset]);

    // SQLiteのブール値と日付を変換
    return bookmarks.map((bookmark) => {
      // SQLiteのブール値を変換
      bookmark.processed = !!bookmark.processed;

      // 日付文字列をDateオブジェクトに変換
      if (bookmark.bookmark_date && typeof bookmark.bookmark_date === "string") {
        bookmark.bookmark_date = new Date(bookmark.bookmark_date);
      }
      if (bookmark.created_at && typeof bookmark.created_at === "string") {
        bookmark.created_at = new Date(bookmark.created_at);
      }

      return bookmark;
    });
  }

  /**
   * 未処理のブックマークを取得
   * @param limit 取得件数（デフォルト: 10）
   * @returns 未処理のブックマーク情報の配列
   */
  async findUnprocessed(limit = 10): Promise<Bookmark[]> {
    await this.db.connect();

    const sql = "SELECT * FROM bookmarks WHERE processed = 0 ORDER BY bookmark_date DESC LIMIT ?";
    const bookmarks = await this.db.all<Bookmark>(sql, [limit]);

    // SQLiteのブール値と日付を変換
    return bookmarks.map((bookmark) => {
      // SQLiteのブール値を変換
      bookmark.processed = !!bookmark.processed;

      // 日付文字列をDateオブジェクトに変換
      if (bookmark.bookmark_date && typeof bookmark.bookmark_date === "string") {
        bookmark.bookmark_date = new Date(bookmark.bookmark_date);
      }
      if (bookmark.created_at && typeof bookmark.created_at === "string") {
        bookmark.created_at = new Date(bookmark.created_at);
      }

      return bookmark;
    });
  }

  /**
   * ブックマークの更新
   * @param id ブックマークID
   * @param bookmark 更新するブックマーク情報
   * @returns 更新が成功したかどうか
   */
  async update(id: number, bookmark: Partial<Bookmark>): Promise<boolean> {
    await this.db.connect();

    // 更新するフィールドと値のペアを作成
    const updateFields: string[] = [];
    const params: any[] = [];

    if (bookmark.url !== undefined) {
      updateFields.push("url = ?");
      params.push(bookmark.url);
    }

    if (bookmark.title !== undefined) {
      updateFields.push("title = ?");
      params.push(bookmark.title);
    }

    if (bookmark.description !== undefined) {
      updateFields.push("description = ?");
      params.push(bookmark.description);
    }

    if (bookmark.bookmark_date !== undefined) {
      updateFields.push("bookmark_date = ?");
      params.push(bookmark.bookmark_date.toISOString());
    }

    if (bookmark.tags !== undefined) {
      updateFields.push("tags = ?");
      params.push(bookmark.tags);
    }

    if (bookmark.content_type !== undefined) {
      updateFields.push("content_type = ?");
      params.push(bookmark.content_type);
    }

    if (bookmark.processed !== undefined) {
      updateFields.push("processed = ?");
      params.push(bookmark.processed ? 1 : 0);
    }

    // 更新するフィールドがない場合は何もしない
    if (updateFields.length === 0) {
      return false;
    }

    // IDを追加
    params.push(id);

    const sql = `UPDATE bookmarks SET ${updateFields.join(", ")} WHERE id = ?`;
    await this.db.run(sql, params);

    return true;
  }

  /**
   * ブックマークの処理状態を更新
   * @param id ブックマークID
   * @param processed 処理状態
   * @returns 更新が成功したかどうか
   */
  async updateProcessed(id: number, processed: boolean): Promise<boolean> {
    await this.db.connect();

    const sql = "UPDATE bookmarks SET processed = ? WHERE id = ?";
    await this.db.run(sql, [processed ? 1 : 0, id]);

    return true;
  }

  /**
   * ブックマークの削除
   * @param id ブックマークID
   * @returns 削除が成功したかどうか
   */
  async delete(id: number): Promise<boolean> {
    await this.db.connect();

    const sql = "DELETE FROM bookmarks WHERE id = ?";
    await this.db.run(sql, [id]);

    return true;
  }
}
