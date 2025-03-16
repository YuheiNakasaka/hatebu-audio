import { DatabaseService } from "../services/database/DatabaseService";
import { AudioFile } from "../types";

/**
 * 音声ファイル情報を管理するモデルクラス
 */
export class AudioFileModel {
  private db: DatabaseService;

  /**
   * コンストラクタ
   */
  constructor() {
    this.db = DatabaseService.getInstance();
  }

  /**
   * 音声ファイルを作成
   * @param audioFile 音声ファイル情報
   * @returns 作成された音声ファイルのID
   */
  async create(audioFile: AudioFile): Promise<number> {
    await this.db.connect();

    const sql = `
      INSERT INTO audio_files (
        bookmark_id, file_path, duration
      ) VALUES (?, ?, ?)
    `;

    const params = [audioFile.bookmark_id, audioFile.file_path, audioFile.duration || null];

    await this.db.run(sql, params);

    // 作成された音声ファイルのIDを取得
    const result = await this.db.get<{ id: number }>("SELECT last_insert_rowid() as id");

    return result?.id || 0;
  }

  /**
   * IDによる音声ファイルの取得
   * @param id 音声ファイルID
   * @returns 音声ファイル情報
   */
  async findById(id: number): Promise<AudioFile | null> {
    await this.db.connect();

    const sql = "SELECT * FROM audio_files WHERE id = ?";
    const audioFile = await this.db.get<AudioFile>(sql, [id]);

    if (!audioFile) {
      return null;
    }

    // 日付文字列をDateオブジェクトに変換
    if (audioFile.generated_at && typeof audioFile.generated_at === "string") {
      audioFile.generated_at = new Date(audioFile.generated_at);
    }

    return audioFile;
  }

  /**
   * ブックマークIDによる音声ファイルの取得
   * @param bookmarkId ブックマークID
   * @returns 音声ファイル情報
   */
  async findByBookmarkId(bookmarkId: number): Promise<AudioFile | null> {
    await this.db.connect();

    const sql = "SELECT * FROM audio_files WHERE bookmark_id = ?";
    const audioFile = await this.db.get<AudioFile>(sql, [bookmarkId]);

    if (!audioFile) {
      return null;
    }

    // 日付文字列をDateオブジェクトに変換
    if (audioFile.generated_at && typeof audioFile.generated_at === "string") {
      audioFile.generated_at = new Date(audioFile.generated_at);
    }

    return audioFile;
  }

  /**
   * 全音声ファイルの取得
   * @param limit 取得件数（デフォルト: 100）
   * @param offset 開始位置（デフォルト: 0）
   * @returns 音声ファイル情報の配列
   */
  async findAll(limit = 100, offset = 0): Promise<AudioFile[]> {
    await this.db.connect();

    const sql = "SELECT * FROM audio_files ORDER BY generated_at DESC LIMIT ? OFFSET ?";
    const audioFiles = await this.db.all<AudioFile>(sql, [limit, offset]);

    // 日付文字列をDateオブジェクトに変換
    return audioFiles.map((audioFile) => {
      if (audioFile.generated_at && typeof audioFile.generated_at === "string") {
        audioFile.generated_at = new Date(audioFile.generated_at);
      }
      return audioFile;
    });
  }

  /**
   * 音声ファイルの更新
   * @param id 音声ファイルID
   * @param audioFile 更新する音声ファイル情報
   * @returns 更新が成功したかどうか
   */
  async update(id: number, audioFile: Partial<AudioFile>): Promise<boolean> {
    await this.db.connect();

    // 更新するフィールドと値のペアを作成
    const updateFields: string[] = [];
    const params: any[] = [];

    if (audioFile.bookmark_id !== undefined) {
      updateFields.push("bookmark_id = ?");
      params.push(audioFile.bookmark_id);
    }

    if (audioFile.file_path !== undefined) {
      updateFields.push("file_path = ?");
      params.push(audioFile.file_path);
    }

    if (audioFile.duration !== undefined) {
      updateFields.push("duration = ?");
      params.push(audioFile.duration);
    }

    // 更新するフィールドがない場合は何もしない
    if (updateFields.length === 0) {
      return false;
    }

    // 生成日時を更新
    updateFields.push("generated_at = CURRENT_TIMESTAMP");

    // IDを追加
    params.push(id);

    const sql = `UPDATE audio_files SET ${updateFields.join(", ")} WHERE id = ?`;
    await this.db.run(sql, params);

    return true;
  }

  /**
   * 音声ファイルの削除
   * @param id 音声ファイルID
   * @returns 削除が成功したかどうか
   */
  async delete(id: number): Promise<boolean> {
    await this.db.connect();

    const sql = "DELETE FROM audio_files WHERE id = ?";
    await this.db.run(sql, [id]);

    return true;
  }

  /**
   * ブックマークIDによる音声ファイルの削除
   * @param bookmarkId ブックマークID
   * @returns 削除が成功したかどうか
   */
  async deleteByBookmarkId(bookmarkId: number): Promise<boolean> {
    await this.db.connect();

    const sql = "DELETE FROM audio_files WHERE bookmark_id = ?";
    await this.db.run(sql, [bookmarkId]);

    return true;
  }
}
