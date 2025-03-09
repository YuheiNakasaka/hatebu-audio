import { NarrationModel } from "../../src/models/NarrationModel";
import { DatabaseService } from "../../src/services/database/DatabaseService";
import fs from "fs";
import path from "path";

// テスト用のデータベースパス
const TEST_DB_PATH = "./data/db/test-models.db";

describe("NarrationModel", () => {
  let dbService: DatabaseService;
  let narrationModel: NarrationModel;

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
      CREATE TABLE IF NOT EXISTS narrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bookmark_id INTEGER NOT NULL,
        narration_text TEXT NOT NULL,
        generated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // NarrationModelのインスタンスを作成
    narrationModel = new NarrationModel();
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
    await dbService.run("DELETE FROM narrations");
  });

  test("create should insert a narration and return its ID", async () => {
    const narration = {
      bookmark_id: 1,
      narration_text: "This is a narration of the article.",
    };

    const id = await narrationModel.create(narration);
    expect(id).toBeGreaterThan(0);

    // データベースから直接取得して確認
    const result = await dbService.get<any>(
      "SELECT * FROM narrations WHERE id = ?",
      [id]
    );

    expect(result).not.toBeNull();
    expect(result?.bookmark_id).toBe(narration.bookmark_id);
    expect(result?.narration_text).toBe(narration.narration_text);
    expect(result?.generated_at).not.toBeNull();
  });

  test("findById should return a narration by ID", async () => {
    // テスト用のナレーションを作成
    const narration = {
      bookmark_id: 2,
      narration_text: "Narration for findById test.",
    };

    const id = await narrationModel.create(narration);
    
    // findByIdで取得
    const result = await narrationModel.findById(id);
    
    expect(result).not.toBeNull();
    expect(result?.id).toBe(id);
    expect(result?.bookmark_id).toBe(narration.bookmark_id);
    expect(result?.narration_text).toBe(narration.narration_text);
    expect(result?.generated_at).toBeInstanceOf(Date);
  });

  test("findByBookmarkId should return a narration by bookmark ID", async () => {
    // テスト用のナレーションを作成
    const narration = {
      bookmark_id: 3,
      narration_text: "Narration for findByBookmarkId test.",
    };

    await narrationModel.create(narration);
    
    // findByBookmarkIdで取得
    const result = await narrationModel.findByBookmarkId(narration.bookmark_id);
    
    expect(result).not.toBeNull();
    expect(result?.bookmark_id).toBe(narration.bookmark_id);
    expect(result?.narration_text).toBe(narration.narration_text);
    expect(result?.generated_at).toBeInstanceOf(Date);
  });

  test("update should update narration properties", async () => {
    // テスト用のナレーションを作成
    const narration = {
      bookmark_id: 4,
      narration_text: "Original narration for update test.",
    };

    const id = await narrationModel.create(narration);
    
    // 更新するデータ
    const updateData = {
      narration_text: "Updated narration for update test.",
    };
    
    // updateで更新
    const updateResult = await narrationModel.update(id, updateData);
    expect(updateResult).toBe(true);
    
    // 更新されたデータを取得して確認
    const result = await narrationModel.findById(id);
    
    expect(result).not.toBeNull();
    expect(result?.narration_text).toBe(updateData.narration_text);
    // 更新していないフィールドは元の値のまま
    expect(result?.bookmark_id).toBe(narration.bookmark_id);
  });

  test("delete should remove a narration", async () => {
    // テスト用のナレーションを作成
    const narration = {
      bookmark_id: 5,
      narration_text: "Narration for delete test.",
    };

    const id = await narrationModel.create(narration);
    
    // 作成されたことを確認
    let result = await narrationModel.findById(id);
    expect(result).not.toBeNull();
    
    // deleteで削除
    const deleteResult = await narrationModel.delete(id);
    expect(deleteResult).toBe(true);
    
    // 削除されたことを確認
    result = await narrationModel.findById(id);
    expect(result).toBeNull();
  });

  test("deleteByBookmarkId should remove a narration by bookmark ID", async () => {
    // テスト用のナレーションを作成
    const narration = {
      bookmark_id: 6,
      narration_text: "Narration for deleteByBookmarkId test.",
    };

    await narrationModel.create(narration);
    
    // 作成されたことを確認
    let result = await narrationModel.findByBookmarkId(narration.bookmark_id);
    expect(result).not.toBeNull();
    
    // deleteByBookmarkIdで削除
    const deleteResult = await narrationModel.deleteByBookmarkId(narration.bookmark_id);
    expect(deleteResult).toBe(true);
    
    // 削除されたことを確認
    result = await narrationModel.findByBookmarkId(narration.bookmark_id);
    expect(result).toBeNull();
  });

  test("update should return false if no fields to update", async () => {
    // テスト用のナレーションを作成
    const narration = {
      bookmark_id: 7,
      narration_text: "Narration for update test with no fields.",
    };

    const id = await narrationModel.create(narration);
    
    // 空のオブジェクトで更新
    const updateResult = await narrationModel.update(id, {});
    expect(updateResult).toBe(false);
    
    // データが変更されていないことを確認
    const result = await narrationModel.findById(id);
    expect(result?.narration_text).toBe(narration.narration_text);
  });

  test("update should update bookmark_id", async () => {
    // テスト用のナレーションを作成
    const narration = {
      bookmark_id: 8,
      narration_text: "Narration for update bookmark_id test.",
    };

    const id = await narrationModel.create(narration);
    
    // bookmark_idを更新
    const newBookmarkId = 9;
    const updateResult = await narrationModel.update(id, { bookmark_id: newBookmarkId });
    expect(updateResult).toBe(true);
    
    // 更新されたデータを取得して確認
    const result = await narrationModel.findById(id);
    expect(result?.bookmark_id).toBe(newBookmarkId);
    expect(result?.narration_text).toBe(narration.narration_text);
  });
});
