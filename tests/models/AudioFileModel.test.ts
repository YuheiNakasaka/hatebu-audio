import { AudioFileModel } from "../../src/models/AudioFileModel";
import { DatabaseService } from "../../src/services/database/DatabaseService";
import fs from "fs";
import path from "path";

// テスト用のデータベースパス
const TEST_DB_PATH = "./data/db/test-models.db";

describe("AudioFileModel", () => {
  let dbService: DatabaseService;
  let audioFileModel: AudioFileModel;

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
      CREATE TABLE IF NOT EXISTS audio_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bookmark_id INTEGER NOT NULL,
        file_path TEXT NOT NULL,
        duration INTEGER,
        generated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // AudioFileModelのインスタンスを作成
    audioFileModel = new AudioFileModel();
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
    await dbService.run("DELETE FROM audio_files");
  });

  test("create should insert an audio file and return its ID", async () => {
    const audioFile = {
      bookmark_id: 1,
      file_path: "/path/to/audio/file1.mp3",
      duration: 120,
    };

    const id = await audioFileModel.create(audioFile);
    expect(id).toBeGreaterThan(0);

    // データベースから直接取得して確認
    const result = await dbService.get<any>(
      "SELECT * FROM audio_files WHERE id = ?",
      [id]
    );

    expect(result).not.toBeNull();
    expect(result?.bookmark_id).toBe(audioFile.bookmark_id);
    expect(result?.file_path).toBe(audioFile.file_path);
    expect(result?.duration).toBe(audioFile.duration);
    expect(result?.generated_at).not.toBeNull();
  });

  test("create should work without duration", async () => {
    const audioFile = {
      bookmark_id: 2,
      file_path: "/path/to/audio/file2.mp3",
    };

    const id = await audioFileModel.create(audioFile);
    expect(id).toBeGreaterThan(0);

    // データベースから直接取得して確認
    const result = await dbService.get<any>(
      "SELECT * FROM audio_files WHERE id = ?",
      [id]
    );

    expect(result).not.toBeNull();
    expect(result?.bookmark_id).toBe(audioFile.bookmark_id);
    expect(result?.file_path).toBe(audioFile.file_path);
    expect(result?.duration).toBeNull();
  });

  test("findById should return an audio file by ID", async () => {
    // テスト用の音声ファイルを作成
    const audioFile = {
      bookmark_id: 3,
      file_path: "/path/to/audio/file3.mp3",
      duration: 180,
    };

    const id = await audioFileModel.create(audioFile);
    
    // findByIdで取得
    const result = await audioFileModel.findById(id);
    
    expect(result).not.toBeNull();
    expect(result?.id).toBe(id);
    expect(result?.bookmark_id).toBe(audioFile.bookmark_id);
    expect(result?.file_path).toBe(audioFile.file_path);
    expect(result?.duration).toBe(audioFile.duration);
    expect(result?.generated_at).toBeInstanceOf(Date);
  });

  test("findByBookmarkId should return an audio file by bookmark ID", async () => {
    // テスト用の音声ファイルを作成
    const audioFile = {
      bookmark_id: 4,
      file_path: "/path/to/audio/file4.mp3",
      duration: 240,
    };

    await audioFileModel.create(audioFile);
    
    // findByBookmarkIdで取得
    const result = await audioFileModel.findByBookmarkId(audioFile.bookmark_id);
    
    expect(result).not.toBeNull();
    expect(result?.bookmark_id).toBe(audioFile.bookmark_id);
    expect(result?.file_path).toBe(audioFile.file_path);
    expect(result?.duration).toBe(audioFile.duration);
    expect(result?.generated_at).toBeInstanceOf(Date);
  });

  test("findAll should return all audio files", async () => {
    // テスト用の音声ファイルを複数作成
    const audioFiles = [
      {
        bookmark_id: 5,
        file_path: "/path/to/audio/file5.mp3",
        duration: 300,
      },
      {
        bookmark_id: 6,
        file_path: "/path/to/audio/file6.mp3",
        duration: 360,
      },
    ];

    await audioFileModel.create(audioFiles[0]);
    await audioFileModel.create(audioFiles[1]);
    
    // findAllで取得
    const results = await audioFileModel.findAll();
    
    expect(results).toHaveLength(2);
    
    // ファイルパスの配列を作成して、両方のファイルが含まれているか確認
    const filePaths = results.map(file => file.file_path);
    expect(filePaths).toContain(audioFiles[0].file_path);
    expect(filePaths).toContain(audioFiles[1].file_path);
  });

  test("update should update audio file properties", async () => {
    // テスト用の音声ファイルを作成
    const audioFile = {
      bookmark_id: 7,
      file_path: "/path/to/audio/file7.mp3",
      duration: 420,
    };

    const id = await audioFileModel.create(audioFile);
    
    // 更新するデータ
    const updateData = {
      file_path: "/path/to/audio/file7_updated.mp3",
      duration: 480,
    };
    
    // updateで更新
    const updateResult = await audioFileModel.update(id, updateData);
    expect(updateResult).toBe(true);
    
    // 更新されたデータを取得して確認
    const result = await audioFileModel.findById(id);
    
    expect(result).not.toBeNull();
    expect(result?.file_path).toBe(updateData.file_path);
    expect(result?.duration).toBe(updateData.duration);
    // 更新していないフィールドは元の値のまま
    expect(result?.bookmark_id).toBe(audioFile.bookmark_id);
  });

  test("delete should remove an audio file", async () => {
    // テスト用の音声ファイルを作成
    const audioFile = {
      bookmark_id: 8,
      file_path: "/path/to/audio/file8.mp3",
      duration: 540,
    };

    const id = await audioFileModel.create(audioFile);
    
    // 作成されたことを確認
    let result = await audioFileModel.findById(id);
    expect(result).not.toBeNull();
    
    // deleteで削除
    const deleteResult = await audioFileModel.delete(id);
    expect(deleteResult).toBe(true);
    
    // 削除されたことを確認
    result = await audioFileModel.findById(id);
    expect(result).toBeNull();
  });

  test("deleteByBookmarkId should remove an audio file by bookmark ID", async () => {
    // テスト用の音声ファイルを作成
    const audioFile = {
      bookmark_id: 9,
      file_path: "/path/to/audio/file9.mp3",
      duration: 600,
    };

    await audioFileModel.create(audioFile);
    
    // 作成されたことを確認
    let result = await audioFileModel.findByBookmarkId(audioFile.bookmark_id);
    expect(result).not.toBeNull();
    
    // deleteByBookmarkIdで削除
    const deleteResult = await audioFileModel.deleteByBookmarkId(audioFile.bookmark_id);
    expect(deleteResult).toBe(true);
    
    // 削除されたことを確認
    result = await audioFileModel.findByBookmarkId(audioFile.bookmark_id);
    expect(result).toBeNull();
  });

  test("update should return false if no fields to update", async () => {
    // テスト用の音声ファイルを作成
    const audioFile = {
      bookmark_id: 10,
      file_path: "/path/to/audio/file10.mp3",
      duration: 660,
    };

    const id = await audioFileModel.create(audioFile);
    
    // 空のオブジェクトで更新
    const updateResult = await audioFileModel.update(id, {});
    expect(updateResult).toBe(false);
    
    // データが変更されていないことを確認
    const result = await audioFileModel.findById(id);
    expect(result?.file_path).toBe(audioFile.file_path);
    expect(result?.duration).toBe(audioFile.duration);
  });
});
