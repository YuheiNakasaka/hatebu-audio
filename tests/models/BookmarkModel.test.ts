import { BookmarkModel } from "../../src/models/BookmarkModel";
import { DatabaseService } from "../../src/services/database/DatabaseService";
import fs from "fs";
import path from "path";

// テスト用のデータベースパス
const TEST_DB_PATH = "./data/db/test-models.db";

describe("BookmarkModel", () => {
  let dbService: DatabaseService;
  let bookmarkModel: BookmarkModel;

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
      CREATE TABLE IF NOT EXISTS bookmarks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        description TEXT,
        bookmark_date DATETIME NOT NULL,
        tags TEXT,
        content_type TEXT,
        processed BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // BookmarkModelのインスタンスを作成
    bookmarkModel = new BookmarkModel();
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
    await dbService.run("DELETE FROM bookmarks");
  });

  test("create should insert a bookmark and return its ID", async () => {
    const bookmark = {
      url: "https://example.com",
      title: "Example Website",
      description: "This is an example website",
      bookmark_date: new Date("2023-01-01"),
      tags: "example,test",
      content_type: "article",
      processed: false,
    };

    const id = await bookmarkModel.create(bookmark);
    expect(id).toBeGreaterThan(0);

    // データベースから直接取得して確認
    const result = await dbService.get<any>(
      "SELECT * FROM bookmarks WHERE id = ?",
      [id]
    );

    expect(result).not.toBeNull();
    expect(result?.url).toBe(bookmark.url);
    expect(result?.title).toBe(bookmark.title);
    expect(result?.description).toBe(bookmark.description);
    expect(result?.tags).toBe(bookmark.tags);
    expect(result?.content_type).toBe(bookmark.content_type);
    expect(result?.processed).toBe(0); // SQLiteではブール値は0/1で保存される
  });

  test("findById should return a bookmark by ID", async () => {
    // テスト用のブックマークを作成
    const bookmark = {
      url: "https://example.com/findbyid",
      title: "Find By ID Test",
      description: "Testing findById method",
      bookmark_date: new Date("2023-01-02"),
      tags: "test,findbyid",
      content_type: "article",
      processed: false,
    };

    const id = await bookmarkModel.create(bookmark);
    
    // findByIdで取得
    const result = await bookmarkModel.findById(id);
    
    expect(result).not.toBeNull();
    expect(result?.id).toBe(id);
    expect(result?.url).toBe(bookmark.url);
    expect(result?.title).toBe(bookmark.title);
    expect(result?.description).toBe(bookmark.description);
    expect(result?.tags).toBe(bookmark.tags);
    expect(result?.content_type).toBe(bookmark.content_type);
    expect(result?.processed).toBe(false);
    expect(result?.bookmark_date).toBeInstanceOf(Date);
    expect(result?.created_at).toBeInstanceOf(Date);
  });

  test("findByUrl should return a bookmark by URL", async () => {
    // テスト用のブックマークを作成
    const bookmark = {
      url: "https://example.com/findbyurl",
      title: "Find By URL Test",
      description: "Testing findByUrl method",
      bookmark_date: new Date("2023-01-03"),
      tags: "test,findbyurl",
      content_type: "article",
      processed: false,
    };

    await bookmarkModel.create(bookmark);
    
    // findByUrlで取得
    const result = await bookmarkModel.findByUrl(bookmark.url);
    
    expect(result).not.toBeNull();
    expect(result?.url).toBe(bookmark.url);
    expect(result?.title).toBe(bookmark.title);
    expect(result?.description).toBe(bookmark.description);
    expect(result?.tags).toBe(bookmark.tags);
    expect(result?.content_type).toBe(bookmark.content_type);
    expect(result?.processed).toBe(false);
  });

  test("findAll should return all bookmarks", async () => {
    // テスト用のブックマークを複数作成
    const bookmarks = [
      {
        url: "https://example.com/findall1",
        title: "Find All Test 1",
        description: "Testing findAll method 1",
        bookmark_date: new Date("2023-01-04"),
        tags: "test,findall",
        content_type: "article",
        processed: false,
      },
      {
        url: "https://example.com/findall2",
        title: "Find All Test 2",
        description: "Testing findAll method 2",
        bookmark_date: new Date("2023-01-05"),
        tags: "test,findall",
        content_type: "article",
        processed: true,
      },
    ];

    await bookmarkModel.create(bookmarks[0]);
    await bookmarkModel.create(bookmarks[1]);
    
    // findAllで取得
    const results = await bookmarkModel.findAll();
    
    expect(results).toHaveLength(2);
    expect(results[0].url).toBe(bookmarks[1].url); // 日付の降順でソートされるため
    expect(results[1].url).toBe(bookmarks[0].url);
  });

  test("findUnprocessed should return unprocessed bookmarks", async () => {
    // テスト用のブックマークを複数作成（処理済みと未処理）
    const bookmarks = [
      {
        url: "https://example.com/unprocessed1",
        title: "Unprocessed Test 1",
        description: "Testing findUnprocessed method 1",
        bookmark_date: new Date("2023-01-06"),
        tags: "test,unprocessed",
        content_type: "article",
        processed: false,
      },
      {
        url: "https://example.com/unprocessed2",
        title: "Unprocessed Test 2",
        description: "Testing findUnprocessed method 2",
        bookmark_date: new Date("2023-01-07"),
        tags: "test,unprocessed",
        content_type: "article",
        processed: false,
      },
      {
        url: "https://example.com/processed",
        title: "Processed Test",
        description: "Testing findUnprocessed method 3",
        bookmark_date: new Date("2023-01-08"),
        tags: "test,processed",
        content_type: "article",
        processed: true,
      },
    ];

    await bookmarkModel.create(bookmarks[0]);
    await bookmarkModel.create(bookmarks[1]);
    await bookmarkModel.create(bookmarks[2]);
    
    // findUnprocessedで取得
    const results = await bookmarkModel.findUnprocessed();
    
    expect(results).toHaveLength(2);
    expect(results[0].url).toBe(bookmarks[1].url); // 日付の降順でソートされるため
    expect(results[1].url).toBe(bookmarks[0].url);
    expect(results.every(b => b.processed === false)).toBe(true);
  });

  test("update should update bookmark properties", async () => {
    // テスト用のブックマークを作成
    const bookmark = {
      url: "https://example.com/update",
      title: "Update Test Original",
      description: "Testing update method original",
      bookmark_date: new Date("2023-01-09"),
      tags: "test,update",
      content_type: "article",
      processed: false,
    };

    const id = await bookmarkModel.create(bookmark);
    
    // 更新するデータ
    const updateData = {
      title: "Update Test Modified",
      description: "Testing update method modified",
      processed: true,
    };
    
    // updateで更新
    const updateResult = await bookmarkModel.update(id, updateData);
    expect(updateResult).toBe(true);
    
    // 更新されたデータを取得して確認
    const result = await bookmarkModel.findById(id);
    
    expect(result).not.toBeNull();
    expect(result?.title).toBe(updateData.title);
    expect(result?.description).toBe(updateData.description);
    expect(result?.processed).toBe(updateData.processed);
    // 更新していないフィールドは元の値のまま
    expect(result?.url).toBe(bookmark.url);
    expect(result?.tags).toBe(bookmark.tags);
    expect(result?.content_type).toBe(bookmark.content_type);
  });

  test("updateProcessed should update only the processed status", async () => {
    // テスト用のブックマークを作成
    const bookmark = {
      url: "https://example.com/updateprocessed",
      title: "Update Processed Test",
      description: "Testing updateProcessed method",
      bookmark_date: new Date("2023-01-10"),
      tags: "test,updateprocessed",
      content_type: "article",
      processed: false,
    };

    const id = await bookmarkModel.create(bookmark);
    
    // updateProcessedで更新
    const updateResult = await bookmarkModel.updateProcessed(id, true);
    expect(updateResult).toBe(true);
    
    // 更新されたデータを取得して確認
    const result = await bookmarkModel.findById(id);
    
    expect(result).not.toBeNull();
    expect(result?.processed).toBe(true);
    // 他のフィールドは元の値のまま
    expect(result?.title).toBe(bookmark.title);
    expect(result?.description).toBe(bookmark.description);
  });

  test("delete should remove a bookmark", async () => {
    // テスト用のブックマークを作成
    const bookmark = {
      url: "https://example.com/delete",
      title: "Delete Test",
      description: "Testing delete method",
      bookmark_date: new Date("2023-01-11"),
      tags: "test,delete",
      content_type: "article",
      processed: false,
    };

    const id = await bookmarkModel.create(bookmark);
    
    // 作成されたことを確認
    let result = await bookmarkModel.findById(id);
    expect(result).not.toBeNull();
    
    // deleteで削除
    const deleteResult = await bookmarkModel.delete(id);
    expect(deleteResult).toBe(true);
    
    // 削除されたことを確認
    result = await bookmarkModel.findById(id);
    expect(result).toBeNull();
  });
});
