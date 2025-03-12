import { DatabaseService } from "../services/database/DatabaseService";
import { MergedAudioFile } from "../types";

/**
 * 結合音声ファイル情報を管理するモデルクラス
 */
export class MergedAudioFileModel {
  private db: DatabaseService;

  /**
   * コンストラクタ
   */
  constructor() {
    this.db = DatabaseService.getInstance();
  }

  /**
   * 結合音声ファイルを作成
   * @param mergedAudioFile 結合音声ファイル情報
   * @returns 作成された結合音声ファイルのID
   */
  async create(mergedAudioFile: MergedAudioFile): Promise<number> {
    await this.db.connect();

    const sql = `
      INSERT INTO merged_audio_files (
        name, file_path, source_files, duration
      ) VALUES (?, ?, ?, ?)
    `;

    const params = [
      mergedAudioFile.name,
      mergedAudioFile.file_path,
      JSON.stringify(mergedAudioFile.source_files),
      mergedAudioFile.duration || null,
    ];

    await this.db.run(sql, params);

    // 作成された結合音声ファイルのIDを取得
    const result = await this.db.get<{ id: number }>(
      "SELECT last_insert_rowid() as id"
    );

    return result?.id || 0;
  }

  /**
   * IDによる結合音声ファイルの取得
   * @param id 結合音声ファイルID
   * @returns 結合音声ファイル情報
   */
  async findById(id: number): Promise<MergedAudioFile | null> {
    await this.db.connect();

    const sql = "SELECT * FROM merged_audio_files WHERE id = ?";
    const mergedAudioFile = await this.db.get<MergedAudioFile>(sql, [id]);

    if (!mergedAudioFile) {
      return null;
    }

    // 日付文字列をDateオブジェクトに変換
    if (mergedAudioFile.created_at && typeof mergedAudioFile.created_at === "string") {
      mergedAudioFile.created_at = new Date(mergedAudioFile.created_at);
    }

    // source_files文字列を配列に変換
    if (typeof mergedAudioFile.source_files === "string") {
      mergedAudioFile.source_files = JSON.parse(mergedAudioFile.source_files);
    }

    return mergedAudioFile;
  }

  /**
   * 名前による結合音声ファイルの取得
   * @param name 結合音声ファイル名
   * @returns 結合音声ファイル情報の配列
   */
  async findByName(name: string): Promise<MergedAudioFile[]> {
    await this.db.connect();

    const sql = "SELECT * FROM merged_audio_files WHERE name LIKE ?";
    const mergedAudioFiles = await this.db.all<MergedAudioFile>(sql, [`%${name}%`]);

    // 日付文字列をDateオブジェクトに変換し、source_files文字列を配列に変換
    return mergedAudioFiles.map((mergedAudioFile) => {
      if (mergedAudioFile.created_at && typeof mergedAudioFile.created_at === "string") {
        mergedAudioFile.created_at = new Date(mergedAudioFile.created_at);
      }
      if (typeof mergedAudioFile.source_files === "string") {
        mergedAudioFile.source_files = JSON.parse(mergedAudioFile.source_files);
      }
      return mergedAudioFile;
    });
  }

  /**
   * 全結合音声ファイルの取得
   * @param limit 取得件数（デフォルト: 100）
   * @param offset 開始位置（デフォルト: 0）
   * @returns 結合音声ファイル情報の配列
   */
  async findAll(limit = 100, offset = 0): Promise<MergedAudioFile[]> {
    await this.db.connect();

    const sql = "SELECT * FROM merged_audio_files ORDER BY created_at DESC LIMIT ? OFFSET ?";
    const mergedAudioFiles = await this.db.all<MergedAudioFile>(sql, [limit, offset]);

    // 日付文字列をDateオブジェクトに変換し、source_files文字列を配列に変換
    return mergedAudioFiles.map((mergedAudioFile) => {
      if (mergedAudioFile.created_at && typeof mergedAudioFile.created_at === "string") {
        mergedAudioFile.created_at = new Date(mergedAudioFile.created_at);
      }
      if (typeof mergedAudioFile.source_files === "string") {
        mergedAudioFile.source_files = JSON.parse(mergedAudioFile.source_files);
      }
      return mergedAudioFile;
    });
  }

  /**
   * 結合音声ファイルの更新
   * @param id 結合音声ファイルID
   * @param mergedAudioFile 更新する結合音声ファイル情報
   * @returns 更新が成功したかどうか
   */
  async update(id: number, mergedAudioFile: Partial<MergedAudioFile>): Promise<boolean> {
    await this.db.connect();

    // 更新するフィールドと値のペアを作成
    const updateFields: string[] = [];
    const params: any[] = [];

    if (mergedAudioFile.name !== undefined) {
      updateFields.push("name = ?");
      params.push(mergedAudioFile.name);
    }

    if (mergedAudioFile.file_path !== undefined) {
      updateFields.push("file_path = ?");
      params.push(mergedAudioFile.file_path);
    }

    if (mergedAudioFile.source_files !== undefined) {
      updateFields.push("source_files = ?");
      params.push(JSON.stringify(mergedAudioFile.source_files));
    }

    if (mergedAudioFile.duration !== undefined) {
      updateFields.push("duration = ?");
      params.push(mergedAudioFile.duration);
    }

    // 更新するフィールドがない場合は何もしない
    if (updateFields.length === 0) {
      return false;
    }

    // IDを追加
    params.push(id);

    const sql = `UPDATE merged_audio_files SET ${updateFields.join(", ")} WHERE id = ?`;
    await this.db.run(sql, params);

    return true;
  }

  /**
   * 結合音声ファイルの削除
   * @param id 結合音声ファイルID
   * @returns 削除が成功したかどうか
   */
  async delete(id: number): Promise<boolean> {
    await this.db.connect();

    const sql = "DELETE FROM merged_audio_files WHERE id = ?";
    await this.db.run(sql, [id]);

    return true;
  }
}
