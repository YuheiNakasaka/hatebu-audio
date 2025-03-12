import fs from "fs";
import path from "path";
import sqlite3 from "sqlite3";
import dotenv from "dotenv";

// 環境変数の読み込み
dotenv.config();

// データベースパスの取得
const dbPath = process.env.DB_PATH || "./data/db/hatebu-audio.db";

// データベースディレクトリの確認と作成
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  console.log(`Creating database directory: ${dbDir}`);
  fs.mkdirSync(dbDir, { recursive: true });
}

// データベース接続
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Error opening database:", err.message);
    process.exit(1);
  }
  console.log(`Connected to database at ${dbPath}`);

  // トランザクション内でテーブル作成
  db.serialize(() => {
    db.run("BEGIN TRANSACTION;");

    // ブックマーク情報テーブル
    db.run(`
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

    // コンテンツテーブル
    db.run(`
      CREATE TABLE IF NOT EXISTS contents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bookmark_id INTEGER NOT NULL,
        raw_content TEXT,
        extracted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id)
      );
    `);

    // ナレーションテーブル
    db.run(`
      CREATE TABLE IF NOT EXISTS narrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bookmark_id INTEGER NOT NULL,
        narration_text TEXT NOT NULL,
        generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id)
      );
    `);

    // 音声ファイルテーブル
    db.run(`
      CREATE TABLE IF NOT EXISTS audio_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bookmark_id INTEGER NOT NULL,
        file_path TEXT NOT NULL,
        duration INTEGER,
        generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id)
      );
    `);

    // プレイリストテーブル
    db.run(`
      CREATE TABLE IF NOT EXISTS playlists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // プレイリスト項目テーブル
    db.run(`
      CREATE TABLE IF NOT EXISTS playlist_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        playlist_id INTEGER NOT NULL,
        audio_file_id INTEGER NOT NULL,
        position INTEGER NOT NULL,
        FOREIGN KEY (playlist_id) REFERENCES playlists(id),
        FOREIGN KEY (audio_file_id) REFERENCES audio_files(id)
      );
    `, (err) => {
      if (err) {
        console.error("Error creating tables:", err.message);
        db.run("ROLLBACK;");
        db.close();
        process.exit(1);
      } else {
        db.run("COMMIT;", (err) => {
          if (err) {
            console.error("Error committing transaction:", err.message);
          } else {
            console.log("Database schema created successfully");
          }
          
          // データベース接続のクローズ
          db.close((err) => {
            if (err) {
              console.error("Error closing database:", err.message);
            } else {
              console.log("Database connection closed");
            }
          });
        });
      }
    });
  });
});
