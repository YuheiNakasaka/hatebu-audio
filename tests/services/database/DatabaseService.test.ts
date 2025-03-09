import { DatabaseService } from "../../../src/services/database/DatabaseService";
import fs from "fs";
import path from "path";

// テスト用のデータベースパス
const TEST_DB_PATH = "./data/db/test-hatebu-audio.db";

describe("DatabaseService", () => {
  let dbService: DatabaseService;

  beforeAll(() => {
    // テスト用のデータベースディレクトリを作成
    const dbDir = path.dirname(TEST_DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    // テスト用のデータベースファイルが存在する場合は削除
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  beforeEach(() => {
    // 各テスト前にデータベースサービスのインスタンスを取得
    dbService = DatabaseService.getInstance(TEST_DB_PATH);
  });

  afterEach(async () => {
    // 各テスト後にデータベース接続を閉じる
    await dbService.close();
  });

  afterAll(() => {
    // 全テスト終了後にテスト用のデータベースファイルを削除
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  test("getInstance should return a singleton instance", () => {
    const instance1 = DatabaseService.getInstance(TEST_DB_PATH);
    const instance2 = DatabaseService.getInstance(TEST_DB_PATH);
    expect(instance1).toBe(instance2);
  });

  test("connect should establish a database connection", async () => {
    await expect(dbService.connect()).resolves.not.toThrow();
  });

  test("run should execute a SQL query", async () => {
    await dbService.connect();
    
    // テスト用のテーブルを作成
    await expect(
      dbService.run(`
        CREATE TABLE IF NOT EXISTS test_table (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL
        )
      `)
    ).resolves.not.toThrow();
  });

  test("transaction should commit changes on success", async () => {
    await dbService.connect();
    
    // テスト用のテーブルを作成（テスト固有のテーブル名を使用）
    await dbService.run(`
      CREATE TABLE IF NOT EXISTS test_table_commit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
      )
    `);
    
    // トランザクション内でデータを挿入
    await expect(
      dbService.transaction(async () => {
        await dbService.run("INSERT INTO test_table_commit (name) VALUES (?)", ["テスト1"]);
        await dbService.run("INSERT INTO test_table_commit (name) VALUES (?)", ["テスト2"]);
        return true;
      })
    ).resolves.toBe(true);
    
    // データが正しく挿入されたか確認
    const rows = await dbService.all<{ id: number; name: string }>(
      "SELECT * FROM test_table_commit ORDER BY id"
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe("テスト1");
    expect(rows[1].name).toBe("テスト2");
  });

  test("transaction should rollback changes on error", async () => {
    await dbService.connect();
    
    // テスト用のテーブルを作成（テスト固有のテーブル名を使用）
    await dbService.run(`
      CREATE TABLE IF NOT EXISTS test_table_rollback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
      )
    `);
    
    // 既存のデータを挿入
    await dbService.run("INSERT INTO test_table_rollback (name) VALUES (?)", ["既存データ"]);
    
    // エラーが発生するトランザクション
    await expect(
      dbService.transaction(async () => {
        await dbService.run("INSERT INTO test_table_rollback (name) VALUES (?)", ["新規データ"]);
        throw new Error("テストエラー");
      })
    ).rejects.toThrow("テストエラー");
    
    // ロールバックされたか確認（新規データは挿入されていないはず）
    const rows = await dbService.all<{ id: number; name: string }>(
      "SELECT * FROM test_table_rollback"
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("既存データ");
  });

  test("get should return a single row", async () => {
    await dbService.connect();
    
    // テスト用のテーブルを作成（テスト固有のテーブル名を使用）
    await dbService.run(`
      CREATE TABLE IF NOT EXISTS test_table_get (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
      )
    `);
    
    // データを挿入
    await dbService.run("INSERT INTO test_table_get (name) VALUES (?)", ["テストデータ"]);
    
    // データを取得
    const row = await dbService.get<{ id: number; name: string }>(
      "SELECT * FROM test_table_get WHERE name = ?",
      ["テストデータ"]
    );
    
    expect(row).not.toBeNull();
    expect(row?.name).toBe("テストデータ");
  });

  test("all should return all matching rows", async () => {
    await dbService.connect();
    
    // テスト用のテーブルを作成（テスト固有のテーブル名を使用）
    await dbService.run(`
      CREATE TABLE IF NOT EXISTS test_table_all (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
      )
    `);
    
    // データを挿入
    await dbService.run("INSERT INTO test_table_all (name) VALUES (?)", ["データ1"]);
    await dbService.run("INSERT INTO test_table_all (name) VALUES (?)", ["データ2"]);
    await dbService.run("INSERT INTO test_table_all (name) VALUES (?)", ["データ3"]);
    
    // データを取得
    const rows = await dbService.all<{ id: number; name: string }>(
      "SELECT * FROM test_table_all ORDER BY id"
    );
    
    expect(rows).toHaveLength(3);
    expect(rows[0].name).toBe("データ1");
    expect(rows[1].name).toBe("データ2");
    expect(rows[2].name).toBe("データ3");
  });
});
