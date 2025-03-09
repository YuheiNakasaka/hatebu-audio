import { DatabaseService } from "../services/database/DatabaseService";
import { Playlist, PlaylistItem } from "../types";

/**
 * プレイリスト情報を管理するモデルクラス
 */
export class PlaylistModel {
  private db: DatabaseService;

  /**
   * コンストラクタ
   */
  constructor() {
    this.db = DatabaseService.getInstance();
  }

  /**
   * プレイリストを作成
   * @param playlist プレイリスト情報
   * @returns 作成されたプレイリストのID
   */
  async create(playlist: Playlist): Promise<number> {
    await this.db.connect();

    const sql = `
      INSERT INTO playlists (
        name, description
      ) VALUES (?, ?)
    `;

    const params = [
      playlist.name,
      playlist.description || "",
    ];

    await this.db.run(sql, params);

    // 作成されたプレイリストのIDを取得
    const result = await this.db.get<{ id: number }>(
      "SELECT last_insert_rowid() as id"
    );

    return result?.id || 0;
  }

  /**
   * IDによるプレイリストの取得
   * @param id プレイリストID
   * @returns プレイリスト情報
   */
  async findById(id: number): Promise<Playlist | null> {
    await this.db.connect();

    const sql = "SELECT * FROM playlists WHERE id = ?";
    const playlist = await this.db.get<Playlist>(sql, [id]);

    if (!playlist) {
      return null;
    }

    // 日付文字列をDateオブジェクトに変換
    if (playlist.created_at && typeof playlist.created_at === "string") {
      playlist.created_at = new Date(playlist.created_at);
    }

    return playlist;
  }

  /**
   * 名前によるプレイリストの取得
   * @param name プレイリスト名
   * @returns プレイリスト情報の配列
   */
  async findByName(name: string): Promise<Playlist[]> {
    await this.db.connect();

    const sql = "SELECT * FROM playlists WHERE name = ?";
    const playlists = await this.db.all<Playlist>(sql, [name]);

    // 日付文字列をDateオブジェクトに変換
    return playlists.map((playlist) => {
      if (playlist.created_at && typeof playlist.created_at === "string") {
        playlist.created_at = new Date(playlist.created_at);
      }
      return playlist;
    });
  }

  /**
   * 全プレイリストの取得
   * @returns プレイリスト情報の配列
   */
  async findAll(): Promise<Playlist[]> {
    await this.db.connect();

    const sql = "SELECT * FROM playlists ORDER BY name";
    const playlists = await this.db.all<Playlist>(sql);

    // 日付文字列をDateオブジェクトに変換
    return playlists.map((playlist) => {
      if (playlist.created_at && typeof playlist.created_at === "string") {
        playlist.created_at = new Date(playlist.created_at);
      }
      return playlist;
    });
  }

  /**
   * プレイリストの更新
   * @param id プレイリストID
   * @param playlist 更新するプレイリスト情報
   * @returns 更新が成功したかどうか
   */
  async update(id: number, playlist: Partial<Playlist>): Promise<boolean> {
    await this.db.connect();

    // 更新するフィールドと値のペアを作成
    const updateFields: string[] = [];
    const params: any[] = [];

    if (playlist.name !== undefined) {
      updateFields.push("name = ?");
      params.push(playlist.name);
    }

    if (playlist.description !== undefined) {
      updateFields.push("description = ?");
      params.push(playlist.description);
    }

    // 更新するフィールドがない場合は何もしない
    if (updateFields.length === 0) {
      return false;
    }

    // IDを追加
    params.push(id);

    const sql = `UPDATE playlists SET ${updateFields.join(", ")} WHERE id = ?`;
    await this.db.run(sql, params);

    return true;
  }

  /**
   * プレイリストの削除
   * @param id プレイリストID
   * @returns 削除が成功したかどうか
   */
  async delete(id: number): Promise<boolean> {
    await this.db.connect();

    // トランザクションを開始
    return this.db.transaction(async () => {
      // プレイリスト項目を削除
      await this.db.run("DELETE FROM playlist_items WHERE playlist_id = ?", [id]);
      
      // プレイリストを削除
      await this.db.run("DELETE FROM playlists WHERE id = ?", [id]);
      
      return true;
    });
  }

  /**
   * プレイリスト項目を追加
   * @param playlistItem プレイリスト項目情報
   * @returns 作成されたプレイリスト項目のID
   */
  async addPlaylistItem(playlistItem: PlaylistItem): Promise<number> {
    await this.db.connect();

    // 現在の最大位置を取得
    const maxPositionResult = await this.db.get<{ max_position: number }>(
      "SELECT MAX(position) as max_position FROM playlist_items WHERE playlist_id = ?",
      [playlistItem.playlist_id]
    );
    
    const position = (maxPositionResult?.max_position || 0) + 1;

    const sql = `
      INSERT INTO playlist_items (
        playlist_id, audio_file_id, position
      ) VALUES (?, ?, ?)
    `;

    const params = [
      playlistItem.playlist_id,
      playlistItem.audio_file_id,
      position,
    ];

    await this.db.run(sql, params);

    // 作成されたプレイリスト項目のIDを取得
    const result = await this.db.get<{ id: number }>(
      "SELECT last_insert_rowid() as id"
    );

    return result?.id || 0;
  }

  /**
   * プレイリスト項目を削除
   * @param id プレイリスト項目ID
   * @returns 削除が成功したかどうか
   */
  async removeItem(id: number): Promise<boolean> {
    await this.db.connect();

    // プレイリスト項目の情報を取得
    const item = await this.db.get<PlaylistItem>(
      "SELECT * FROM playlist_items WHERE id = ?",
      [id]
    );

    if (!item) {
      return false;
    }

    // トランザクションを開始
    return this.db.transaction(async () => {
      // プレイリスト項目を削除
      await this.db.run("DELETE FROM playlist_items WHERE id = ?", [id]);
      
      // 後続の項目の位置を更新
      await this.db.run(
        "UPDATE playlist_items SET position = position - 1 WHERE playlist_id = ? AND position > ?",
        [item.playlist_id, item.position]
      );
      
      return true;
    });
  }

  /**
   * プレイリスト項目の位置を変更
   * @param id プレイリスト項目ID
   * @param newPosition 新しい位置
   * @returns 更新が成功したかどうか
   */
  async updatePlaylistItemPosition(id: number, newPosition: number): Promise<boolean> {
    await this.db.connect();

    // プレイリスト項目の情報を取得
    const item = await this.db.get<PlaylistItem>(
      "SELECT * FROM playlist_items WHERE id = ?",
      [id]
    );

    if (!item) {
      return false;
    }

    // 現在の最大位置を取得
    const maxPositionResult = await this.db.get<{ max_position: number }>(
      "SELECT MAX(position) as max_position FROM playlist_items WHERE playlist_id = ?",
      [item.playlist_id]
    );
    
    const maxPosition = maxPositionResult?.max_position || 0;

    // 新しい位置が範囲外の場合は調整
    if (newPosition < 1) {
      newPosition = 1;
    } else if (newPosition > maxPosition) {
      newPosition = maxPosition;
    }

    // 現在の位置と同じ場合は何もしない
    if (newPosition === item.position) {
      return true;
    }

    // トランザクションを開始
    return this.db.transaction(async () => {
      if (newPosition < item.position) {
        // 上に移動する場合
        await this.db.run(
          "UPDATE playlist_items SET position = position + 1 WHERE playlist_id = ? AND position >= ? AND position < ?",
          [item.playlist_id, newPosition, item.position]
        );
      } else {
        // 下に移動する場合
        await this.db.run(
          "UPDATE playlist_items SET position = position - 1 WHERE playlist_id = ? AND position > ? AND position <= ?",
          [item.playlist_id, item.position, newPosition]
        );
      }
      
      // 対象の項目の位置を更新
      await this.db.run(
        "UPDATE playlist_items SET position = ? WHERE id = ?",
        [newPosition, id]
      );
      
      return true;
    });
  }

  /**
   * プレイリストの項目を取得
   * @param playlistId プレイリストID
   * @returns プレイリスト項目情報の配列
   */
  async findPlaylistItems(playlistId: number): Promise<PlaylistItem[]> {
    await this.db.connect();

    const sql = "SELECT * FROM playlist_items WHERE playlist_id = ? ORDER BY position";
    return this.db.all<PlaylistItem>(sql, [playlistId]);
  }

  /**
   * プレイリストの音声ファイルIDを取得
   * @param playlistId プレイリストID
   * @returns 音声ファイルIDの配列
   */
  async getAudioFileIds(playlistId: number): Promise<number[]> {
    await this.db.connect();

    const sql = "SELECT audio_file_id FROM playlist_items WHERE playlist_id = ? ORDER BY position";
    const results = await this.db.all<{ audio_file_id: number }>(sql, [playlistId]);
    
    return results.map((result) => result.audio_file_id);
  }

  /**
   * プレイリスト項目を取得
   * @param playlistId プレイリストID
   * @param audioFileId 音声ファイルID
   * @returns プレイリスト項目情報
   */
  async findPlaylistItem(playlistId: number, audioFileId: number): Promise<PlaylistItem | null> {
    await this.db.connect();

    const sql = "SELECT * FROM playlist_items WHERE playlist_id = ? AND audio_file_id = ?";
    const playlistItem = await this.db.get<PlaylistItem>(sql, [playlistId, audioFileId]);

    return playlistItem || null;
  }

  /**
   * プレイリストから音声ファイルを削除
   * @param playlistId プレイリストID
   * @param audioFileId 音声ファイルID
   * @returns 削除が成功したかどうか
   */
  async removePlaylistItem(playlistId: number, audioFileId: number): Promise<boolean> {
    await this.db.connect();

    // プレイリスト項目の情報を取得
    const item = await this.findPlaylistItem(playlistId, audioFileId);
    if (!item || !item.id) {
      return false;
    }

    // トランザクションを開始
    return this.db.transaction(async () => {
      // プレイリスト項目を削除
      await this.db.run("DELETE FROM playlist_items WHERE id = ?", [item.id]);
      
      // 後続の項目の位置を更新
      await this.db.run(
        "UPDATE playlist_items SET position = position - 1 WHERE playlist_id = ? AND position > ?",
        [playlistId, item.position]
      );
      
      return true;
    });
  }
}
