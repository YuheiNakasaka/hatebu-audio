import sqlite3 from "sqlite3";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// 環境変数の読み込み
dotenv.config();

/**
 * データベース操作を管理するサービスクラス
 */
export class DatabaseService {
  private static instance: DatabaseService;
  private db: sqlite3.Database | null = null;
  private dbPath: string;

  /**
   * コンストラクタ
   * @param dbPath データベースファイルのパス
   */
  private constructor(dbPath?: string) {
    this.dbPath = dbPath || process.env.DB_PATH || "./data/db/hatebu-audio.db";

    // データベースディレクトリの確認と作成
    const dbDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
  }

  /**
   * シングルトンインスタンスを取得
   * @param dbPath データベースファイルのパス
   * @returns DatabaseServiceのインスタンス
   */
  public static getInstance(dbPath?: string): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService(dbPath);
    }
    return DatabaseService.instance;
  }

  /**
   * データベースに接続
   * @returns Promise<void>
   */
  public async connect(): Promise<void> {
    if (this.db) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(new Error(`データベース接続エラー: ${err.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * データベース接続を閉じる
   * @returns Promise<void>
   */
  public async close(): Promise<void> {
    if (!this.db) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.db!.close((err) => {
        if (err) {
          reject(new Error(`データベース切断エラー: ${err.message}`));
        } else {
          this.db = null;
          resolve();
        }
      });
    });
  }

  /**
   * SQLクエリを実行（結果なし）
   * @param sql SQLクエリ
   * @param params パラメータ
   * @returns Promise<void>
   */
  public async run(sql: string, params: any[] = []): Promise<void> {
    if (!this.db) {
      await this.connect();
    }

    return new Promise((resolve, reject) => {
      this.db!.run(sql, params, function (err) {
        if (err) {
          reject(new Error(`クエリ実行エラー: ${err.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * SQLクエリを実行して1行取得
   * @param sql SQLクエリ
   * @param params パラメータ
   * @returns Promise<T | null>
   */
  public async get<T>(sql: string, params: any[] = []): Promise<T | null> {
    if (!this.db) {
      await this.connect();
    }

    return new Promise((resolve, reject) => {
      this.db!.get(sql, params, (err, row) => {
        if (err) {
          reject(new Error(`クエリ実行エラー: ${err.message}`));
        } else {
          resolve((row as T) || null);
        }
      });
    });
  }

  /**
   * SQLクエリを実行して全行取得
   * @param sql SQLクエリ
   * @param params パラメータ
   * @returns Promise<T[]>
   */
  public async all<T>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.db) {
      await this.connect();
    }

    return new Promise((resolve, reject) => {
      this.db!.all(sql, params, (err, rows) => {
        if (err) {
          reject(new Error(`クエリ実行エラー: ${err.message}`));
        } else {
          resolve(rows as T[]);
        }
      });
    });
  }

  /**
   * トランザクションを開始
   * @returns Promise<void>
   */
  public async beginTransaction(): Promise<void> {
    return this.run("BEGIN TRANSACTION");
  }

  /**
   * トランザクションをコミット
   * @returns Promise<void>
   */
  public async commit(): Promise<void> {
    return this.run("COMMIT");
  }

  /**
   * トランザクションをロールバック
   * @returns Promise<void>
   */
  public async rollback(): Promise<void> {
    return this.run("ROLLBACK");
  }

  /**
   * トランザクション内で処理を実行
   * @param callback トランザクション内で実行するコールバック関数
   * @returns Promise<T>
   */
  public async transaction<T>(callback: () => Promise<T>): Promise<T> {
    await this.beginTransaction();
    try {
      const result = await callback();
      await this.commit();
      return result;
    } catch (error) {
      await this.rollback();
      throw error;
    }
  }
}
