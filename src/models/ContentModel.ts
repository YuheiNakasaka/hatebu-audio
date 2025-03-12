import { DatabaseService } from "../services/database/DatabaseService";
import { Content } from "../types";

/**
 * コンテンツ情報を管理するモデルクラス
 */
export class ContentModel {
  private db: DatabaseService;

  /**
   * コンストラクタ
   */
  constructor() {
    this.db = DatabaseService.getInstance();
  }

  /**
   * コンテンツを作成
   * @param content コンテンツ情報
   * @returns 作成されたコンテンツのID
   */
  async create(content: Content): Promise<number> {
    await this.db.connect();

    const sql = `
      INSERT INTO contents (
        bookmark_id, raw_content
      ) VALUES (?, ?)
    `;

    const params = [
      content.bookmark_id,
      content.raw_content,
    ];

    await this.db.run(sql, params);

    // 作成されたコンテンツのIDを取得
    const result = await this.db.get<{ id: number }>(
      "SELECT last_insert_rowid() as id"
    );

    return result?.id || 0;
  }

  /**
   * IDによるコンテンツの取得
   * @param id コンテンツID
   * @returns コンテンツ情報
   */
  async findById(id: number): Promise<Content | null> {
    await this.db.connect();

    const sql = "SELECT * FROM contents WHERE id = ?";
    const content = await this.db.get<Content>(sql, [id]);

    if (!content) {
      return null;
    }

    // 日付文字列をDateオブジェクトに変換
    if (content.extracted_at && typeof content.extracted_at === "string") {
      content.extracted_at = new Date(content.extracted_at);
    }

    return content;
  }

  /**
   * ブックマークIDによるコンテンツの取得
   * @param bookmarkId ブックマークID
   * @returns コンテンツ情報
   */
  async findByBookmarkId(bookmarkId: number): Promise<Content | null> {
    await this.db.connect();

    const sql = "SELECT * FROM contents WHERE bookmark_id = ?";
    const content = await this.db.get<Content>(sql, [bookmarkId]);

    if (!content) {
      return null;
    }

    // 日付文字列をDateオブジェクトに変換
    if (content.extracted_at && typeof content.extracted_at === "string") {
      content.extracted_at = new Date(content.extracted_at);
    }

    return content;
  }

  /**
   * 全コンテンツの取得
   * @param limit 取得件数（デフォルト: 100）
   * @param offset 開始位置（デフォルト: 0）
   * @returns コンテンツ情報の配列
   */
  async findAll(limit = 100, offset = 0): Promise<Content[]> {
    await this.db.connect();

    const sql = "SELECT * FROM contents ORDER BY extracted_at DESC LIMIT ? OFFSET ?";
    const contents = await this.db.all<Content>(sql, [limit, offset]);

    // 日付文字列をDateオブジェクトに変換
    return contents.map((content) => {
      if (content.extracted_at && typeof content.extracted_at === "string") {
        content.extracted_at = new Date(content.extracted_at);
      }
      return content;
    });
  }

  /**
   * コンテンツの更新
   * @param id コンテンツID
   * @param content 更新するコンテンツ情報
   * @returns 更新が成功したかどうか
   */
  async update(id: number, content: Partial<Content>): Promise<boolean> {
    await this.db.connect();

    // 更新するフィールドと値のペアを作成
    const updateFields: string[] = [];
    const params: any[] = [];

    if (content.bookmark_id !== undefined) {
      updateFields.push("bookmark_id = ?");
      params.push(content.bookmark_id);
    }

    if (content.raw_content !== undefined) {
      updateFields.push("raw_content = ?");
      params.push(content.raw_content);
    }

    // 更新するフィールドがない場合は何もしない
    if (updateFields.length === 0) {
      return false;
    }

    // 抽出日時を更新
    updateFields.push("extracted_at = CURRENT_TIMESTAMP");

    // IDを追加
    params.push(id);

    const sql = `UPDATE contents SET ${updateFields.join(", ")} WHERE id = ?`;
    await this.db.run(sql, params);

    return true;
  }

  /**
   * コンテンツの削除
   * @param id コンテンツID
   * @returns 削除が成功したかどうか
   */
  async delete(id: number): Promise<boolean> {
    await this.db.connect();

    const sql = "DELETE FROM contents WHERE id = ?";
    await this.db.run(sql, [id]);

    return true;
  }

  /**
   * ブックマークIDによるコンテンツの削除
   * @param bookmarkId ブックマークID
   * @returns 削除が成功したかどうか
   */
  async deleteByBookmarkId(bookmarkId: number): Promise<boolean> {
    await this.db.connect();

    const sql = "DELETE FROM contents WHERE bookmark_id = ?";
    await this.db.run(sql, [bookmarkId]);

    return true;
  }
}
