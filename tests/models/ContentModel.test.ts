import { ContentModel } from "../../src/models/ContentModel";
import { DatabaseService } from "../../src/services/database/DatabaseService";
import fs from "fs";
import path from "path";

// テスト用のデータベースパス
const TEST_DB_PATH = "./data/db/test-models.db";

describe("ContentModel", () => {
  let dbService: DatabaseService;
  let contentModel: ContentModel;

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
      CREATE TABLE IF NOT EXISTS contents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bookmark_id INTEGER NOT NULL,
        raw_content TEXT,
        extracted_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // ContentModelのインスタンスを作成
    contentModel = new ContentModel();
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
    await dbService.run("DELETE FROM contents");
  });

  test("create should insert content and return its ID", async () => {
    const content = {
      bookmark_id: 1,
      raw_content: "This is the raw content of the article.",
    };

    const id = await contentModel.create(content);
    expect(id).toBeGreaterThan(0);

    // データベースから直接取得して確認
    const result = await dbService.get<any>(
      "SELECT * FROM contents WHERE id = ?",
      [id]
    );

    expect(result).not.toBeNull();
    expect(result?.bookmark_id).toBe(content.bookmark_id);
    expect(result?.raw_content).toBe(content.raw_content);
    expect(result?.extracted_at).not.toBeNull();
  });

  test("findById should return content by ID", async () => {
    // テスト用のコンテンツを作成
    const content = {
      bookmark_id: 2,
      raw_content: "Content for findById test.",
    };

    const id = await contentModel.create(content);
    
    // findByIdで取得
    const result = await contentModel.findById(id);
    
    expect(result).not.toBeNull();
    expect(result?.id).toBe(id);
    expect(result?.bookmark_id).toBe(content.bookmark_id);
    expect(result?.raw_content).toBe(content.raw_content);
    expect(result?.extracted_at).toBeInstanceOf(Date);
  });

  test("findByBookmarkId should return content by bookmark ID", async () => {
    // テスト用のコンテンツを作成
    const content = {
      bookmark_id: 3,
      raw_content: "Content for findByBookmarkId test.",
    };

    await contentModel.create(content);
    
    // findByBookmarkIdで取得
    const result = await contentModel.findByBookmarkId(content.bookmark_id);
    
    expect(result).not.toBeNull();
    expect(result?.bookmark_id).toBe(content.bookmark_id);
    expect(result?.raw_content).toBe(content.raw_content);
    expect(result?.extracted_at).toBeInstanceOf(Date);
  });

  test("update should update content properties", async () => {
    // テスト用のコンテンツを作成
    const content = {
      bookmark_id: 4,
      raw_content: "Original content for update test.",
    };

    const id = await contentModel.create(content);
    
    // 更新するデータ
    const updateData = {
      raw_content: "Updated content for update test.",
    };
    
    // updateで更新
    const updateResult = await contentModel.update(id, updateData);
    expect(updateResult).toBe(true);
    
    // 更新されたデータを取得して確認
    const result = await contentModel.findById(id);
    
    expect(result).not.toBeNull();
    expect(result?.raw_content).toBe(updateData.raw_content);
    // 更新していないフィールドは元の値のまま
    expect(result?.bookmark_id).toBe(content.bookmark_id);
  });

  test("delete should remove content", async () => {
    // テスト用のコンテンツを作成
    const content = {
      bookmark_id: 5,
      raw_content: "Content for delete test.",
    };

    const id = await contentModel.create(content);
    
    // 作成されたことを確認
    let result = await contentModel.findById(id);
    expect(result).not.toBeNull();
    
    // deleteで削除
    const deleteResult = await contentModel.delete(id);
    expect(deleteResult).toBe(true);
    
    // 削除されたことを確認
    result = await contentModel.findById(id);
    expect(result).toBeNull();
  });

  test("deleteByBookmarkId should remove content by bookmark ID", async () => {
    // テスト用のコンテンツを作成
    const content = {
      bookmark_id: 6,
      raw_content: "Content for deleteByBookmarkId test.",
    };

    await contentModel.create(content);
    
    // 作成されたことを確認
    let result = await contentModel.findByBookmarkId(content.bookmark_id);
    expect(result).not.toBeNull();
    
    // deleteByBookmarkIdで削除
    const deleteResult = await contentModel.deleteByBookmarkId(content.bookmark_id);
    expect(deleteResult).toBe(true);
    
    // 削除されたことを確認
    result = await contentModel.findByBookmarkId(content.bookmark_id);
    expect(result).toBeNull();
  });

  test("update should return false if no fields to update", async () => {
    // テスト用のコンテンツを作成
    const content = {
      bookmark_id: 7,
      raw_content: "Content for update test with no fields.",
    };

    const id = await contentModel.create(content);
    
    // 空のオブジェクトで更新
    const updateResult = await contentModel.update(id, {});
    expect(updateResult).toBe(false);
    
    // データが変更されていないことを確認
    const result = await contentModel.findById(id);
    expect(result?.raw_content).toBe(content.raw_content);
  });

  test("update should update bookmark_id", async () => {
    // テスト用のコンテンツを作成
    const content = {
      bookmark_id: 8,
      raw_content: "Content for update bookmark_id test.",
    };

    const id = await contentModel.create(content);
    
    // bookmark_idを更新
    const newBookmarkId = 9;
    const updateResult = await contentModel.update(id, { bookmark_id: newBookmarkId });
    expect(updateResult).toBe(true);
    
    // 更新されたデータを取得して確認
    const result = await contentModel.findById(id);
    expect(result?.bookmark_id).toBe(newBookmarkId);
    expect(result?.raw_content).toBe(content.raw_content);
  });
});
