import { DatabaseService } from "../services/database/DatabaseService";
import { Narration } from "../types";

/**
 * ナレーション情報を管理するモデルクラス
 */
export class NarrationModel {
  private db: DatabaseService;

  /**
   * コンストラクタ
   */
  constructor() {
    this.db = DatabaseService.getInstance();
  }

  /**
   * ナレーションを作成
   * @param narration ナレーション情報
   * @returns 作成されたナレーションのID
   */
  async create(narration: Narration): Promise<number> {
    await this.db.connect();

    const sql = `
      INSERT INTO narrations (
        bookmark_id, narration_text
      ) VALUES (?, ?)
    `;

    const params = [
      narration.bookmark_id,
      narration.narration_text,
    ];

    await this.db.run(sql, params);

    // 作成されたナレーションのIDを取得
    const result = await this.db.get<{ id: number }>(
      "SELECT last_insert_rowid() as id"
    );

    return result?.id || 0;
  }

  /**
   * IDによるナレーションの取得
   * @param id ナレーションID
   * @returns ナレーション情報
   */
  async findById(id: number): Promise<Narration | null> {
    await this.db.connect();

    const sql = "SELECT * FROM narrations WHERE id = ?";
    const narration = await this.db.get<Narration>(sql, [id]);

    if (!narration) {
      return null;
    }

    // 日付文字列をDateオブジェクトに変換
    if (narration.generated_at && typeof narration.generated_at === "string") {
      narration.generated_at = new Date(narration.generated_at);
    }

    return narration;
  }

  /**
   * ブックマークIDによるナレーションの取得
   * @param bookmarkId ブックマークID
   * @returns ナレーション情報
   */
  async findByBookmarkId(bookmarkId: number): Promise<Narration | null> {
    await this.db.connect();

    const sql = "SELECT * FROM narrations WHERE bookmark_id = ?";
    const narration = await this.db.get<Narration>(sql, [bookmarkId]);

    if (!narration) {
      return null;
    }

    // 日付文字列をDateオブジェクトに変換
    if (narration.generated_at && typeof narration.generated_at === "string") {
      narration.generated_at = new Date(narration.generated_at);
    }

    return narration;
  }

  /**
   * ナレーションの更新
   * @param id ナレーションID
   * @param narration 更新するナレーション情報
   * @returns 更新が成功したかどうか
   */
  async update(id: number, narration: Partial<Narration>): Promise<boolean> {
    await this.db.connect();

    // 更新するフィールドと値のペアを作成
    const updateFields: string[] = [];
    const params: any[] = [];

    if (narration.bookmark_id !== undefined) {
      updateFields.push("bookmark_id = ?");
      params.push(narration.bookmark_id);
    }

    if (narration.narration_text !== undefined) {
      updateFields.push("narration_text = ?");
      params.push(narration.narration_text);
    }

    // 更新するフィールドがない場合は何もしない
    if (updateFields.length === 0) {
      return false;
    }

    // 生成日時を更新
    updateFields.push("generated_at = CURRENT_TIMESTAMP");

    // IDを追加
    params.push(id);

    const sql = `UPDATE narrations SET ${updateFields.join(", ")} WHERE id = ?`;
    await this.db.run(sql, params);

    return true;
  }

  /**
   * ナレーションの削除
   * @param id ナレーションID
   * @returns 削除が成功したかどうか
   */
  async delete(id: number): Promise<boolean> {
    await this.db.connect();

    const sql = "DELETE FROM narrations WHERE id = ?";
    await this.db.run(sql, [id]);

    return true;
  }

  /**
   * ブックマークIDによるナレーションの削除
   * @param bookmarkId ブックマークID
   * @returns 削除が成功したかどうか
   */
  async deleteByBookmarkId(bookmarkId: number): Promise<boolean> {
    await this.db.connect();

    const sql = "DELETE FROM narrations WHERE bookmark_id = ?";
    await this.db.run(sql, [bookmarkId]);

    return true;
  }
}
