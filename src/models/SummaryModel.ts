import { DatabaseService } from "../services/database/DatabaseService";
import { Summary } from "../types";

/**
 * 要約情報を管理するモデルクラス
 */
export class SummaryModel {
  private db: DatabaseService;

  /**
   * コンストラクタ
   */
  constructor() {
    this.db = DatabaseService.getInstance();
  }

  /**
   * 要約を作成
   * @param summary 要約情報
   * @returns 作成された要約のID
   */
  async create(summary: Summary): Promise<number> {
    await this.db.connect();

    const sql = `
      INSERT INTO summaries (
        bookmark_id, summary_text
      ) VALUES (?, ?)
    `;

    const params = [
      summary.bookmark_id,
      summary.summary_text,
    ];

    await this.db.run(sql, params);

    // 作成された要約のIDを取得
    const result = await this.db.get<{ id: number }>(
      "SELECT last_insert_rowid() as id"
    );

    return result?.id || 0;
  }

  /**
   * IDによる要約の取得
   * @param id 要約ID
   * @returns 要約情報
   */
  async findById(id: number): Promise<Summary | null> {
    await this.db.connect();

    const sql = "SELECT * FROM summaries WHERE id = ?";
    const summary = await this.db.get<Summary>(sql, [id]);

    if (!summary) {
      return null;
    }

    // 日付文字列をDateオブジェクトに変換
    if (summary.generated_at && typeof summary.generated_at === "string") {
      summary.generated_at = new Date(summary.generated_at);
    }

    return summary;
  }

  /**
   * ブックマークIDによる要約の取得
   * @param bookmarkId ブックマークID
   * @returns 要約情報
   */
  async findByBookmarkId(bookmarkId: number): Promise<Summary | null> {
    await this.db.connect();

    const sql = "SELECT * FROM summaries WHERE bookmark_id = ?";
    const summary = await this.db.get<Summary>(sql, [bookmarkId]);

    if (!summary) {
      return null;
    }

    // 日付文字列をDateオブジェクトに変換
    if (summary.generated_at && typeof summary.generated_at === "string") {
      summary.generated_at = new Date(summary.generated_at);
    }

    return summary;
  }

  /**
   * 要約の更新
   * @param id 要約ID
   * @param summary 更新する要約情報
   * @returns 更新が成功したかどうか
   */
  async update(id: number, summary: Partial<Summary>): Promise<boolean> {
    await this.db.connect();

    // 更新するフィールドと値のペアを作成
    const updateFields: string[] = [];
    const params: any[] = [];

    if (summary.bookmark_id !== undefined) {
      updateFields.push("bookmark_id = ?");
      params.push(summary.bookmark_id);
    }

    if (summary.summary_text !== undefined) {
      updateFields.push("summary_text = ?");
      params.push(summary.summary_text);
    }

    // 更新するフィールドがない場合は何もしない
    if (updateFields.length === 0) {
      return false;
    }

    // 生成日時を更新
    updateFields.push("generated_at = CURRENT_TIMESTAMP");

    // IDを追加
    params.push(id);

    const sql = `UPDATE summaries SET ${updateFields.join(", ")} WHERE id = ?`;
    await this.db.run(sql, params);

    return true;
  }

  /**
   * 要約の削除
   * @param id 要約ID
   * @returns 削除が成功したかどうか
   */
  async delete(id: number): Promise<boolean> {
    await this.db.connect();

    const sql = "DELETE FROM summaries WHERE id = ?";
    await this.db.run(sql, [id]);

    return true;
  }

  /**
   * ブックマークIDによる要約の削除
   * @param bookmarkId ブックマークID
   * @returns 削除が成功したかどうか
   */
  async deleteByBookmarkId(bookmarkId: number): Promise<boolean> {
    await this.db.connect();

    const sql = "DELETE FROM summaries WHERE bookmark_id = ?";
    await this.db.run(sql, [bookmarkId]);

    return true;
  }
}
