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

    // 結合音声ファイルテーブル
    db.run(`
      CREATE TABLE IF NOT EXISTS merged_audio_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        source_files TEXT NOT NULL,
        duration INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Podcastエピソードテーブル（新規追加）
    db.run(`
      CREATE TABLE IF NOT EXISTS podcast_episodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        merged_audio_file_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        source_bookmarks TEXT,
        published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        duration INTEGER,
        file_size INTEGER,
        storage_url TEXT,
        is_published BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (merged_audio_file_id) REFERENCES merged_audio_files(id)
      );
    `);

    // Podcastシリーズ設定テーブル（新規追加）
    db.run(`
      CREATE TABLE IF NOT EXISTS podcast_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL DEFAULT 'Yuhei Nakasakaのはてなブックマークラジオ',
        description TEXT DEFAULT 'はてなブックマークの記事を要約して音声化したポッドキャスト',
        author TEXT DEFAULT 'Yuhei Nakasaka',
        email TEXT,
        language TEXT DEFAULT 'ja',
        category TEXT DEFAULT 'Technology',
        explicit BOOLEAN DEFAULT FALSE,
        image_url TEXT,
        website_url TEXT,
        feed_url TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `, (err) => {
      if (err) {
        console.error("Error creating tables:", err.message);
        db.run("ROLLBACK;");
        db.close();
        process.exit(1);
      } else {
        // デフォルトのPodcast設定を挿入
        db.get("SELECT COUNT(*) as count FROM podcast_settings", (err, row: { count: number }) => {
          if (err) {
            console.error("Error checking podcast settings:", err.message);
            db.run("ROLLBACK;");
            db.close();
            process.exit(1);
          } else if (row.count === 0) {
            // 設定がまだ存在しない場合は挿入
            db.run(`
              INSERT INTO podcast_settings (
                title, description, author, language, category, explicit
              ) VALUES (
                'Yuhei Nakasakaのはてなブックマークラジオ',
                'はてなブックマークの記事を要約して音声化したポッドキャスト',
                'Yuhei Nakasaka',
                'ja',
                'Technology',
                0
              );
            `, (err) => {
              if (err) {
                console.error("Error inserting default podcast settings:", err.message);
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
      }
    });
  });
});
