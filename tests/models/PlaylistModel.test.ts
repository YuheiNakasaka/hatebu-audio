import { PlaylistModel } from "../../src/models/PlaylistModel";
import { DatabaseService } from "../../src/services/database/DatabaseService";
import fs from "fs";
import path from "path";

// テスト用のデータベースパス
const TEST_DB_PATH = "./data/db/test-models.db";

describe("PlaylistModel", () => {
  let dbService: DatabaseService;
  let playlistModel: PlaylistModel;

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
      CREATE TABLE IF NOT EXISTS playlists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    await dbService.run(`
      CREATE TABLE IF NOT EXISTS playlist_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        playlist_id INTEGER NOT NULL,
        audio_file_id INTEGER NOT NULL,
        position INTEGER NOT NULL,
        FOREIGN KEY (playlist_id) REFERENCES playlists(id)
      );
    `);
    
    // PlaylistModelのインスタンスを作成
    playlistModel = new PlaylistModel();
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
    await dbService.run("DELETE FROM playlist_items");
    await dbService.run("DELETE FROM playlists");
  });

  test("create should insert a playlist and return its ID", async () => {
    const playlist = {
      name: "テストプレイリスト",
    };

    const id = await playlistModel.create(playlist);
    expect(id).toBeGreaterThan(0);

    // データベースから直接取得して確認
    const result = await dbService.get<any>(
      "SELECT * FROM playlists WHERE id = ?",
      [id]
    );

    expect(result).not.toBeNull();
    expect(result?.name).toBe(playlist.name);
    expect(result?.created_at).not.toBeNull();
  });

  test("findById should return a playlist by ID", async () => {
    // テスト用のプレイリストを作成
    const playlist = {
      name: "IDで検索するプレイリスト",
    };

    const id = await playlistModel.create(playlist);
    
    // findByIdで取得
    const result = await playlistModel.findById(id);
    
    expect(result).not.toBeNull();
    expect(result?.id).toBe(id);
    expect(result?.name).toBe(playlist.name);
    expect(result?.created_at).toBeInstanceOf(Date);
  });

  test("findByName should return a playlist by name", async () => {
    // テスト用のプレイリストを作成
    const playlist = {
      name: "名前で検索するプレイリスト",
    };

    await playlistModel.create(playlist);
    
    // findByNameで取得
    const result = await playlistModel.findByName(playlist.name);
    
    expect(result).not.toBeNull();
    expect(result?.name).toBe(playlist.name);
    expect(result?.created_at).toBeInstanceOf(Date);
  });

  test("findAll should return all playlists", async () => {
    // テスト用のプレイリストを複数作成
    const playlists = [
      {
        name: "プレイリスト1",
      },
      {
        name: "プレイリスト2",
      },
    ];

    await playlistModel.create(playlists[0]);
    await playlistModel.create(playlists[1]);
    
    // findAllで取得
    const results = await playlistModel.findAll();
    
    expect(results).toHaveLength(2);
    
    // プレイリスト名の配列を作成して、両方のプレイリストが含まれているか確認
    const playlistNames = results.map(playlist => playlist.name);
    expect(playlistNames).toContain(playlists[0].name);
    expect(playlistNames).toContain(playlists[1].name);
  });

  test("update should update playlist properties", async () => {
    // テスト用のプレイリストを作成
    const playlist = {
      name: "更新前のプレイリスト",
    };

    const id = await playlistModel.create(playlist);
    
    // 更新するデータ
    const updateData = {
      name: "更新後のプレイリスト",
    };
    
    // updateで更新
    const updateResult = await playlistModel.update(id, updateData);
    expect(updateResult).toBe(true);
    
    // 更新されたデータを取得して確認
    const result = await playlistModel.findById(id);
    
    expect(result).not.toBeNull();
    expect(result?.name).toBe(updateData.name);
  });

  test("delete should remove a playlist and its items", async () => {
    // テスト用のプレイリストを作成
    const playlist = {
      name: "削除するプレイリスト",
    };

    const id = await playlistModel.create(playlist);
    
    // プレイリスト項目を追加
    const playlistItem = {
      playlist_id: id,
      audio_file_id: 1,
      position: 1,
    };
    
    await dbService.run(
      "INSERT INTO playlist_items (playlist_id, audio_file_id, position) VALUES (?, ?, ?)",
      [playlistItem.playlist_id, playlistItem.audio_file_id, playlistItem.position]
    );
    
    // 作成されたことを確認
    let playlistResult = await playlistModel.findById(id);
    expect(playlistResult).not.toBeNull();
    
    let itemResult = await dbService.get<any>(
      "SELECT * FROM playlist_items WHERE playlist_id = ?",
      [id]
    );
    expect(itemResult).not.toBeNull();
    
    // deleteで削除
    const deleteResult = await playlistModel.delete(id);
    expect(deleteResult).toBe(true);
    
    // プレイリストが削除されたことを確認
    playlistResult = await playlistModel.findById(id);
    expect(playlistResult).toBeNull();
    
    // プレイリスト項目も削除されたことを確認
    itemResult = await dbService.get<any>(
      "SELECT * FROM playlist_items WHERE playlist_id = ?",
      [id]
    );
    expect(itemResult).toBeNull();
  });

  test("addItem should add an item to a playlist", async () => {
    // テスト用のプレイリストを作成
    const playlist = {
      name: "項目を追加するプレイリスト",
    };

    const playlistId = await playlistModel.create(playlist);
    
    // プレイリスト項目を追加
    const playlistItem = {
      playlist_id: playlistId,
      audio_file_id: 1,
      position: 1, // テスト用に設定
    };
    
    const itemId = await playlistModel.addItem(playlistItem);
    expect(itemId).toBeGreaterThan(0);
    
    // 追加された項目を確認
    const result = await dbService.get<any>(
      "SELECT * FROM playlist_items WHERE id = ?",
      [itemId]
    );
    
    expect(result).not.toBeNull();
    expect(result?.playlist_id).toBe(playlistItem.playlist_id);
    expect(result?.audio_file_id).toBe(playlistItem.audio_file_id);
    expect(result?.position).toBe(1); // 最初の項目なので1になる
  });

  test("addItem should increment position for new items", async () => {
    // テスト用のプレイリストを作成
    const playlist = {
      name: "複数項目を追加するプレイリスト",
    };

    const playlistId = await playlistModel.create(playlist);
    
    // 複数のプレイリスト項目を追加
    const playlistItems = [
      {
        playlist_id: playlistId,
        audio_file_id: 1,
        position: 1, // テスト用に設定
      },
      {
        playlist_id: playlistId,
        audio_file_id: 2,
        position: 2, // テスト用に設定
      },
    ];
    
    const itemId1 = await playlistModel.addItem(playlistItems[0]);
    const itemId2 = await playlistModel.addItem(playlistItems[1]);
    
    // 追加された項目を確認
    const result1 = await dbService.get<any>(
      "SELECT * FROM playlist_items WHERE id = ?",
      [itemId1]
    );
    
    const result2 = await dbService.get<any>(
      "SELECT * FROM playlist_items WHERE id = ?",
      [itemId2]
    );
    
    expect(result1?.position).toBe(1); // 最初の項目なので1
    expect(result2?.position).toBe(2); // 2番目の項目なので2
  });

  test("removeItem should remove an item and update positions", async () => {
    // テスト用のプレイリストを作成
    const playlist = {
      name: "項目を削除するプレイリスト",
    };

    const playlistId = await playlistModel.create(playlist);
    
    // 複数のプレイリスト項目を追加
    const items = [];
    for (let i = 1; i <= 3; i++) {
      const itemId = await playlistModel.addItem({
        playlist_id: playlistId,
        audio_file_id: i,
        position: i, // テスト用に設定
      });
      items.push(itemId);
    }
    
    // 真ん中の項目を削除
    const removeResult = await playlistModel.removeItem(items[1]);
    expect(removeResult).toBe(true);
    
    // 残りの項目の位置が更新されていることを確認
    const item1 = await dbService.get<any>(
      "SELECT * FROM playlist_items WHERE id = ?",
      [items[0]]
    );
    
    const item3 = await dbService.get<any>(
      "SELECT * FROM playlist_items WHERE id = ?",
      [items[2]]
    );
    
    expect(item1?.position).toBe(1); // 変わらず1のまま
    expect(item3?.position).toBe(2); // 3から2に更新される
  });

  test("moveItem should update item positions correctly", async () => {
    // テスト用のプレイリストを作成
    const playlist = {
      name: "項目を移動するプレイリスト",
    };

    const playlistId = await playlistModel.create(playlist);
    
    // 複数のプレイリスト項目を追加
    const items = [];
    for (let i = 1; i <= 3; i++) {
      const itemId = await playlistModel.addItem({
        playlist_id: playlistId,
        audio_file_id: i,
        position: i, // テスト用に設定
      });
      items.push(itemId);
    }
    
    // 最初の項目を最後に移動
    const moveResult = await playlistModel.moveItem(items[0], 3);
    expect(moveResult).toBe(true);
    
    // 位置が更新されていることを確認
    const item1 = await dbService.get<any>(
      "SELECT * FROM playlist_items WHERE id = ?",
      [items[0]]
    );
    
    const item2 = await dbService.get<any>(
      "SELECT * FROM playlist_items WHERE id = ?",
      [items[1]]
    );
    
    const item3 = await dbService.get<any>(
      "SELECT * FROM playlist_items WHERE id = ?",
      [items[2]]
    );
    
    expect(item1?.position).toBe(3); // 1から3に更新される
    expect(item2?.position).toBe(1); // 2から1に更新される
    expect(item3?.position).toBe(2); // 3から2に更新される
  });

  test("getItems should return all items for a playlist", async () => {
    // テスト用のプレイリストを作成
    const playlist = {
      name: "項目を取得するプレイリスト",
    };

    const playlistId = await playlistModel.create(playlist);
    
    // 複数のプレイリスト項目を追加
    for (let i = 1; i <= 3; i++) {
      await playlistModel.addItem({
        playlist_id: playlistId,
        audio_file_id: i,
        position: i, // テスト用に設定
      });
    }
    
    // getItemsで取得
    const items = await playlistModel.getItems(playlistId);
    
    expect(items).toHaveLength(3);
    expect(items[0].position).toBe(1);
    expect(items[1].position).toBe(2);
    expect(items[2].position).toBe(3);
    expect(items[0].audio_file_id).toBe(1);
    expect(items[1].audio_file_id).toBe(2);
    expect(items[2].audio_file_id).toBe(3);
  });

  test("getAudioFileIds should return all audio file IDs for a playlist", async () => {
    // テスト用のプレイリストを作成
    const playlist = {
      name: "音声ファイルIDを取得するプレイリスト",
    };

    const playlistId = await playlistModel.create(playlist);
    
    // 複数のプレイリスト項目を追加
    for (let i = 1; i <= 3; i++) {
      await playlistModel.addItem({
        playlist_id: playlistId,
        audio_file_id: i,
        position: i, // テスト用に設定
      });
    }
    
    // getAudioFileIdsで取得
    const audioFileIds = await playlistModel.getAudioFileIds(playlistId);
    
    expect(audioFileIds).toHaveLength(3);
    expect(audioFileIds[0]).toBe(1);
    expect(audioFileIds[1]).toBe(2);
    expect(audioFileIds[2]).toBe(3);
  });
});
