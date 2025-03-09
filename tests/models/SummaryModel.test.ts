import { SummaryModel } from "../../src/models/SummaryModel";
import { DatabaseService } from "../../src/services/database/DatabaseService";
import fs from "fs";
import path from "path";

// テスト用のデータベースパス
const TEST_DB_PATH = "./data/db/test-models.db";

describe("SummaryModel", () => {
  let dbService: DatabaseService;
  let summaryModel: SummaryModel;

  beforeAll(async () => {
    // テスト用のデータベースディレクトリを作成
    const dbDir = path.dirname(TEST_DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    // テスト用のデータベースファイルが存在する場合は削除
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    // 環境変数を設定
    process.env.DB_PATH = TEST_DB_PATH;
    
    // データベースサービスのインスタンスを取得
    dbService = DatabaseService.getInstance(TEST_DB_PATH);
    await dbService.connect();
    
    // テスト用のテーブルを作成
    await dbService.run(`
      CREATE TABLE IF NOT EXISTS summaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bookmark_id INTEGER NOT NULL,
        summary_text TEXT NOT NULL,
        generated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // SummaryModelのインスタンスを作成
    summaryModel = new SummaryModel();
  });

  afterAll(async () => {
    // データベース接続を閉じる
    await dbService.close();
    
    // テスト用のデータベースファイルを削除
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    
    // 環境変数をクリア
    delete process.env.DB_PATH;
  });

  beforeEach(async () => {
    // 各テスト前にテーブルをクリア
    await dbService.run("DELETE FROM summaries");
  });

  test("create should insert a summary and return its ID", async () => {
    const summary = {
      bookmark_id: 1,
      summary_text: "This is a summary of the article.",
    };

    const id = await summaryModel.create(summary);
    expect(id).toBeGreaterThan(0);

    // データベースから直接取得して確認
    const result = await dbService.get<any>(
      "SELECT * FROM summaries WHERE id = ?",
      [id]
    );

    expect(result).not.toBeNull();
    expect(result?.bookmark_id).toBe(summary.bookmark_id);
    expect(result?.summary_text).toBe(summary.summary_text);
    expect(result?.generated_at).not.toBeNull();
  });

  test("findById should return a summary by ID", async () => {
    // テスト用の要約を作成
    const summary = {
      bookmark_id: 2,
      summary_text: "Summary for findById test.",
    };

    const id = await summaryModel.create(summary);
    
    // findByIdで取得
    const result = await summaryModel.findById(id);
    
    expect(result).not.toBeNull();
    expect(result?.id).toBe(id);
    expect(result?.bookmark_id).toBe(summary.bookmark_id);
    expect(result?.summary_text).toBe(summary.summary_text);
    expect(result?.generated_at).toBeInstanceOf(Date);
  });

  test("findByBookmarkId should return a summary by bookmark ID", async () => {
    // テスト用の要約を作成
    const summary = {
      bookmark_id: 3,
      summary_text: "Summary for findByBookmarkId test.",
    };

    await summaryModel.create(summary);
    
    // findByBookmarkIdで取得
    const result = await summaryModel.findByBookmarkId(summary.bookmark_id);
    
    expect(result).not.toBeNull();
    expect(result?.bookmark_id).toBe(summary.bookmark_id);
    expect(result?.summary_text).toBe(summary.summary_text);
    expect(result?.generated_at).toBeInstanceOf(Date);
  });

  test("update should update summary properties", async () => {
    // テスト用の要約を作成
    const summary = {
      bookmark_id: 4,
      summary_text: "Original summary for update test.",
    };

    const id = await summaryModel.create(summary);
    
    // 更新するデータ
    const updateData = {
      summary_text: "Updated summary for update test.",
    };
    
    // updateで更新
    const updateResult = await summaryModel.update(id, updateData);
    expect(updateResult).toBe(true);
    
    // 更新されたデータを取得して確認
    const result = await summaryModel.findById(id);
    
    expect(result).not.toBeNull();
    expect(result?.summary_text).toBe(updateData.summary_text);
    // 更新していないフィールドは元の値のまま
    expect(result?.bookmark_id).toBe(summary.bookmark_id);
  });

  test("delete should remove a summary", async () => {
    // テスト用の要約を作成
    const summary = {
      bookmark_id: 5,
      summary_text: "Summary for delete test.",
    };

    const id = await summaryModel.create(summary);
    
    // 作成されたことを確認
    let result = await summaryModel.findById(id);
    expect(result).not.toBeNull();
    
    // deleteで削除
    const deleteResult = await summaryModel.delete(id);
    expect(deleteResult).toBe(true);
    
    // 削除されたことを確認
    result = await summaryModel.findById(id);
    expect(result).toBeNull();
  });

  test("deleteByBookmarkId should remove a summary by bookmark ID", async () => {
    // テスト用の要約を作成
    const summary = {
      bookmark_id: 6,
      summary_text: "Summary for deleteByBookmarkId test.",
    };

    await summaryModel.create(summary);
    
    // 作成されたことを確認
    let result = await summaryModel.findByBookmarkId(summary.bookmark_id);
    expect(result).not.toBeNull();
    
    // deleteByBookmarkIdで削除
    const deleteResult = await summaryModel.deleteByBookmarkId(summary.bookmark_id);
    expect(deleteResult).toBe(true);
    
    // 削除されたことを確認
    result = await summaryModel.findByBookmarkId(summary.bookmark_id);
    expect(result).toBeNull();
  });

  test("update should return false if no fields to update", async () => {
    // テスト用の要約を作成
    const summary = {
      bookmark_id: 7,
      summary_text: "Summary for update test with no fields.",
    };

    const id = await summaryModel.create(summary);
    
    // 空のオブジェクトで更新
    const updateResult = await summaryModel.update(id, {});
    expect(updateResult).toBe(false);
    
    // データが変更されていないことを確認
    const result = await summaryModel.findById(id);
    expect(result?.summary_text).toBe(summary.summary_text);
  });

  test("update should update bookmark_id", async () => {
    // テスト用の要約を作成
    const summary = {
      bookmark_id: 8,
      summary_text: "Summary for update bookmark_id test.",
    };

    const id = await summaryModel.create(summary);
    
    // bookmark_idを更新
    const newBookmarkId = 9;
    const updateResult = await summaryModel.update(id, { bookmark_id: newBookmarkId });
    expect(updateResult).toBe(true);
    
    // 更新されたデータを取得して確認
    const result = await summaryModel.findById(id);
    expect(result?.bookmark_id).toBe(newBookmarkId);
    expect(result?.summary_text).toBe(summary.summary_text);
  });
});
