import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import sqlite3 from "sqlite3";

// テスト用のデータベースパス
const TEST_DB_PATH = "./data/db/test-init-db.db";

describe("initDb script", () => {
  beforeAll(() => {
    // テスト用のデータベースディレクトリを作成
    const dbDir = path.dirname(TEST_DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
  });

  beforeEach(() => {
    // 各テスト前にデータベースファイルが存在する場合は削除
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  afterAll(() => {
    // 全テスト終了後にテスト用のデータベースファイルを削除
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  test("should create database with all required tables", () => {
    // 環境変数を設定してinitDbスクリプトを実行
    const output = execSync(`DB_PATH=${TEST_DB_PATH} ts-node src/scripts/initDb.ts`, { encoding: 'utf8' });
    
    // 標準出力にデータベース作成成功メッセージが含まれていることを確認
    expect(output).toContain("Database schema created successfully");
    
    // データベースファイルが作成されていることを確認
    expect(fs.existsSync(TEST_DB_PATH)).toBe(true);
    
    // データベースに接続して各テーブルが存在するか確認
    const db = new sqlite3.Database(TEST_DB_PATH);
    
    // 各テーブルの存在を確認
    const tables = [
      "bookmarks",
      "contents",
      "summaries",
      "narrations",
      "audio_files",
      "playlists",
      "playlist_items"
    ];
    
    // 同期的にテーブルの存在を確認
    const checkTable = (table: string): Promise<boolean> => {
      return new Promise<boolean>((resolve) => {
        db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [table], (err, row: any) => {
          if (err) {
            resolve(false);
          } else {
            resolve(row && row.name === table);
          }
        });
      });
    };
    
    // 全テーブルの存在を確認する非同期関数
    const checkAllTables = async (): Promise<void> => {
      for (const table of tables) {
        const exists = await checkTable(table);
        expect(exists).toBe(true);
      }
      
      // データベース接続を閉じる
      return new Promise<void>((resolve) => {
        db.close((err) => {
          expect(err).toBeNull();
          resolve();
        });
      });
    };
    
    // 非同期関数を実行して全テーブルの存在を確認
    return checkAllTables();
  });
});
