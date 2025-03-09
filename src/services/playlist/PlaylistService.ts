import { Playlist, PlaylistItem, AudioFile, ProcessResult, ProcessStatus } from "../../types";
import { PlaylistModel, AudioFileModel, BookmarkModel } from "../../models";
import dotenv from "dotenv";

// 環境変数の読み込み
dotenv.config();

/**
 * プレイリストサービスのインターフェース
 */
export interface PlaylistService {
  /**
   * プレイリストの作成
   * @param name プレイリスト名
   * @param description プレイリストの説明
   * @returns 作成したプレイリスト
   */
  createPlaylist(name: string, description?: string): Promise<ProcessResult<Playlist>>;

  /**
   * プレイリストの取得
   * @param playlistId プレイリストID
   * @returns プレイリスト
   */
  getPlaylist(playlistId: number): Promise<ProcessResult<Playlist>>;

  /**
   * 全プレイリストの取得
   * @returns プレイリストの配列
   */
  getAllPlaylists(): Promise<ProcessResult<Playlist[]>>;

  /**
   * プレイリストの更新
   * @param playlistId プレイリストID
   * @param name プレイリスト名
   * @param description プレイリストの説明
   * @returns 更新したプレイリスト
   */
  updatePlaylist(playlistId: number, name?: string, description?: string): Promise<ProcessResult<Playlist>>;

  /**
   * プレイリストの削除
   * @param playlistId プレイリストID
   * @returns 処理結果
   */
  deletePlaylist(playlistId: number): Promise<ProcessResult<void>>;

  /**
   * プレイリストへの音声ファイルの追加
   * @param playlistId プレイリストID
   * @param audioFileId 音声ファイルID
   * @returns 処理結果
   */
  addAudioFileToPlaylist(playlistId: number, audioFileId: number): Promise<ProcessResult<PlaylistItem>>;

  /**
   * プレイリストからの音声ファイルの削除
   * @param playlistId プレイリストID
   * @param audioFileId 音声ファイルID
   * @returns 処理結果
   */
  removeAudioFileFromPlaylist(playlistId: number, audioFileId: number): Promise<ProcessResult<void>>;

  /**
   * プレイリスト内の音声ファイルの順序変更
   * @param playlistId プレイリストID
   * @param audioFileId 音声ファイルID
   * @param newPosition 新しい位置
   * @returns 処理結果
   */
  reorderPlaylistItem(playlistId: number, audioFileId: number, newPosition: number): Promise<ProcessResult<void>>;

  /**
   * プレイリスト内の音声ファイルの取得
   * @param playlistId プレイリストID
   * @returns 音声ファイルの配列
   */
  getPlaylistItems(playlistId: number): Promise<ProcessResult<PlaylistItem[]>>;
}

/**
 * プレイリストサービスの実装クラス
 */
export class DefaultPlaylistService implements PlaylistService {
  private playlistModel: PlaylistModel;
  private audioFileModel: AudioFileModel;
  private bookmarkModel: BookmarkModel;

  /**
   * コンストラクタ
   */
  constructor() {
    this.playlistModel = new PlaylistModel();
    this.audioFileModel = new AudioFileModel();
    this.bookmarkModel = new BookmarkModel();
  }

  /**
   * プレイリストの作成
   * @param name プレイリスト名
   * @param description プレイリストの説明
   * @returns 作成したプレイリスト
   */
  async createPlaylist(name: string, description?: string): Promise<ProcessResult<Playlist>> {
    try {
      // 同名のプレイリストが存在するか確認
      const existingPlaylists = await this.playlistModel.findByName(name);
      if (existingPlaylists.length > 0) {
        return {
          status: ProcessStatus.ERROR,
          message: `同名のプレイリストが既に存在します: ${name}`,
        };
      }

      // プレイリストの作成
      const playlist: Playlist = {
        name,
        description: description || "",
      };

      const playlistId = await this.playlistModel.create(playlist);
      playlist.id = playlistId;

      return {
        status: ProcessStatus.SUCCESS,
        message: `プレイリストを作成しました: ${name}`,
        data: playlist,
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          status: ProcessStatus.ERROR,
          message: `プレイリストの作成に失敗しました: ${error.message}`,
          error: error,
        };
      }
      throw error;
    }
  }

  /**
   * プレイリストの取得
   * @param playlistId プレイリストID
   * @returns プレイリスト
   */
  async getPlaylist(playlistId: number): Promise<ProcessResult<Playlist>> {
    try {
      // プレイリストの取得
      const playlist = await this.playlistModel.findById(playlistId);
      if (!playlist) {
        return {
          status: ProcessStatus.ERROR,
          message: `プレイリストが見つかりません: ID ${playlistId}`,
        };
      }

      return {
        status: ProcessStatus.SUCCESS,
        message: `プレイリストを取得しました: ${playlist.name}`,
        data: playlist,
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          status: ProcessStatus.ERROR,
          message: `プレイリストの取得に失敗しました: ${error.message}`,
          error: error,
        };
      }
      throw error;
    }
  }

  /**
   * 全プレイリストの取得
   * @returns プレイリストの配列
   */
  async getAllPlaylists(): Promise<ProcessResult<Playlist[]>> {
    try {
      // 全プレイリストの取得
      const playlists = await this.playlistModel.findAll();

      return {
        status: ProcessStatus.SUCCESS,
        message: `${playlists.length}件のプレイリストを取得しました。`,
        data: playlists,
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          status: ProcessStatus.ERROR,
          message: `プレイリストの取得に失敗しました: ${error.message}`,
          error: error,
          data: [],
        };
      }
      throw error;
    }
  }

  /**
   * プレイリストの更新
   * @param playlistId プレイリストID
   * @param name プレイリスト名
   * @param description プレイリストの説明
   * @returns 更新したプレイリスト
   */
  async updatePlaylist(playlistId: number, name?: string, description?: string): Promise<ProcessResult<Playlist>> {
    try {
      // プレイリストの存在確認
      const playlist = await this.playlistModel.findById(playlistId);
      if (!playlist) {
        return {
          status: ProcessStatus.ERROR,
          message: `プレイリストが見つかりません: ID ${playlistId}`,
        };
      }

      // 更新するフィールドの設定
      const updateData: Partial<Playlist> = {};
      if (name !== undefined) {
        // 同名のプレイリストが存在するか確認
        if (name !== playlist.name) {
          const existingPlaylists = await this.playlistModel.findByName(name);
          if (existingPlaylists.length > 0) {
            return {
              status: ProcessStatus.ERROR,
              message: `同名のプレイリストが既に存在します: ${name}`,
            };
          }
        }
        updateData.name = name;
      }
      if (description !== undefined) {
        updateData.description = description;
      }

      // 更新するフィールドがない場合
      if (Object.keys(updateData).length === 0) {
        return {
          status: ProcessStatus.SKIPPED,
          message: "更新するフィールドがありません。",
          data: playlist,
        };
      }

      // プレイリストの更新
      await this.playlistModel.update(playlistId, updateData);

      // 更新後のプレイリストを取得
      const updatedPlaylist = await this.playlistModel.findById(playlistId);
      if (!updatedPlaylist) {
        return {
          status: ProcessStatus.ERROR,
          message: `更新後のプレイリストの取得に失敗しました: ID ${playlistId}`,
        };
      }

      return {
        status: ProcessStatus.SUCCESS,
        message: `プレイリストを更新しました: ${updatedPlaylist.name}`,
        data: updatedPlaylist,
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          status: ProcessStatus.ERROR,
          message: `プレイリストの更新に失敗しました: ${error.message}`,
          error: error,
        };
      }
      throw error;
    }
  }

  /**
   * プレイリストの削除
   * @param playlistId プレイリストID
   * @returns 処理結果
   */
  async deletePlaylist(playlistId: number): Promise<ProcessResult<void>> {
    try {
      // プレイリストの存在確認
      const playlist = await this.playlistModel.findById(playlistId);
      if (!playlist) {
        return {
          status: ProcessStatus.ERROR,
          message: `プレイリストが見つかりません: ID ${playlistId}`,
        };
      }

      // プレイリストの削除
      await this.playlistModel.delete(playlistId);

      return {
        status: ProcessStatus.SUCCESS,
        message: `プレイリストを削除しました: ${playlist.name}`,
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          status: ProcessStatus.ERROR,
          message: `プレイリストの削除に失敗しました: ${error.message}`,
          error: error,
        };
      }
      throw error;
    }
  }

  /**
   * プレイリストへの音声ファイルの追加
   * @param playlistId プレイリストID
   * @param audioFileId 音声ファイルID
   * @returns 処理結果
   */
  async addAudioFileToPlaylist(playlistId: number, audioFileId: number): Promise<ProcessResult<PlaylistItem>> {
    try {
      // プレイリストの存在確認
      const playlist = await this.playlistModel.findById(playlistId);
      if (!playlist) {
        return {
          status: ProcessStatus.ERROR,
          message: `プレイリストが見つかりません: ID ${playlistId}`,
        };
      }

      // 音声ファイルの存在確認
      const audioFile = await this.audioFileModel.findById(audioFileId);
      if (!audioFile) {
        return {
          status: ProcessStatus.ERROR,
          message: `音声ファイルが見つかりません: ID ${audioFileId}`,
        };
      }

      // 既にプレイリストに追加されているか確認
      const existingItem = await this.playlistModel.findPlaylistItem(playlistId, audioFileId);
      if (existingItem) {
        return {
          status: ProcessStatus.SKIPPED,
          message: `音声ファイルは既にプレイリストに追加されています: プレイリストID ${playlistId}, 音声ファイルID ${audioFileId}`,
          data: existingItem,
        };
      }

      // プレイリスト内の最大位置を取得
      const playlistItems = await this.playlistModel.findPlaylistItems(playlistId);
      const maxPosition = playlistItems.reduce((max, item) => Math.max(max, item.position), 0);

      // プレイリストアイテムの作成
      const playlistItem: PlaylistItem = {
        playlist_id: playlistId,
        audio_file_id: audioFileId,
        position: maxPosition + 1,
      };

      const playlistItemId = await this.playlistModel.addPlaylistItem(playlistItem);
      playlistItem.id = playlistItemId;

      return {
        status: ProcessStatus.SUCCESS,
        message: `音声ファイルをプレイリストに追加しました: プレイリストID ${playlistId}, 音声ファイルID ${audioFileId}`,
        data: playlistItem,
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          status: ProcessStatus.ERROR,
          message: `音声ファイルのプレイリストへの追加に失敗しました: ${error.message}`,
          error: error,
        };
      }
      throw error;
    }
  }

  /**
   * プレイリストからの音声ファイルの削除
   * @param playlistId プレイリストID
   * @param audioFileId 音声ファイルID
   * @returns 処理結果
   */
  async removeAudioFileFromPlaylist(playlistId: number, audioFileId: number): Promise<ProcessResult<void>> {
    try {
      // プレイリストの存在確認
      const playlist = await this.playlistModel.findById(playlistId);
      if (!playlist) {
        return {
          status: ProcessStatus.ERROR,
          message: `プレイリストが見つかりません: ID ${playlistId}`,
        };
      }

      // プレイリストアイテムの存在確認
      const playlistItem = await this.playlistModel.findPlaylistItem(playlistId, audioFileId);
      if (!playlistItem) {
        return {
          status: ProcessStatus.SKIPPED,
          message: `音声ファイルはプレイリストに存在しません: プレイリストID ${playlistId}, 音声ファイルID ${audioFileId}`,
        };
      }

      // プレイリストアイテムの削除
      await this.playlistModel.removePlaylistItem(playlistId, audioFileId);

      // 残りのアイテムの位置を再整列
      const remainingItems = await this.playlistModel.findPlaylistItems(playlistId);
      for (let i = 0; i < remainingItems.length; i++) {
        const item = remainingItems[i];
        if (item.position !== i + 1) {
          await this.playlistModel.updatePlaylistItemPosition(item.id!, i + 1);
        }
      }

      return {
        status: ProcessStatus.SUCCESS,
        message: `音声ファイルをプレイリストから削除しました: プレイリストID ${playlistId}, 音声ファイルID ${audioFileId}`,
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          status: ProcessStatus.ERROR,
          message: `音声ファイルのプレイリストからの削除に失敗しました: ${error.message}`,
          error: error,
        };
      }
      throw error;
    }
  }

  /**
   * プレイリスト内の音声ファイルの順序変更
   * @param playlistId プレイリストID
   * @param audioFileId 音声ファイルID
   * @param newPosition 新しい位置
   * @returns 処理結果
   */
  async reorderPlaylistItem(playlistId: number, audioFileId: number, newPosition: number): Promise<ProcessResult<void>> {
    try {
      // プレイリストの存在確認
      const playlist = await this.playlistModel.findById(playlistId);
      if (!playlist) {
        return {
          status: ProcessStatus.ERROR,
          message: `プレイリストが見つかりません: ID ${playlistId}`,
        };
      }

      // プレイリストアイテムの存在確認
      const playlistItem = await this.playlistModel.findPlaylistItem(playlistId, audioFileId);
      if (!playlistItem) {
        return {
          status: ProcessStatus.ERROR,
          message: `音声ファイルはプレイリストに存在しません: プレイリストID ${playlistId}, 音声ファイルID ${audioFileId}`,
        };
      }

      // プレイリスト内のアイテム数を確認
      const playlistItems = await this.playlistModel.findPlaylistItems(playlistId);
      if (newPosition < 1 || newPosition > playlistItems.length) {
        return {
          status: ProcessStatus.ERROR,
          message: `無効な位置です: ${newPosition}（有効範囲: 1-${playlistItems.length}）`,
        };
      }

      // 現在の位置と新しい位置が同じ場合
      if (playlistItem.position === newPosition) {
        return {
          status: ProcessStatus.SKIPPED,
          message: `音声ファイルは既に指定された位置にあります: 位置 ${newPosition}`,
        };
      }

      // 位置の更新
      const currentPosition = playlistItem.position;
      if (newPosition > currentPosition) {
        // 下に移動する場合
        for (const item of playlistItems) {
          if (item.position > currentPosition && item.position <= newPosition) {
            await this.playlistModel.updatePlaylistItemPosition(item.id!, item.position - 1);
          }
        }
      } else {
        // 上に移動する場合
        for (const item of playlistItems) {
          if (item.position >= newPosition && item.position < currentPosition) {
            await this.playlistModel.updatePlaylistItemPosition(item.id!, item.position + 1);
          }
        }
      }

      // 対象アイテムの位置を更新
      await this.playlistModel.updatePlaylistItemPosition(playlistItem.id!, newPosition);

      return {
        status: ProcessStatus.SUCCESS,
        message: `プレイリスト内の音声ファイルの順序を変更しました: プレイリストID ${playlistId}, 音声ファイルID ${audioFileId}, 新しい位置 ${newPosition}`,
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          status: ProcessStatus.ERROR,
          message: `プレイリスト内の音声ファイルの順序変更に失敗しました: ${error.message}`,
          error: error,
        };
      }
      throw error;
    }
  }

  /**
   * プレイリスト内の音声ファイルの取得
   * @param playlistId プレイリストID
   * @returns 音声ファイルの配列
   */
  async getPlaylistItems(playlistId: number): Promise<ProcessResult<PlaylistItem[]>> {
    try {
      // プレイリストの存在確認
      const playlist = await this.playlistModel.findById(playlistId);
      if (!playlist) {
        return {
          status: ProcessStatus.ERROR,
          message: `プレイリストが見つかりません: ID ${playlistId}`,
          data: [],
        };
      }

      // プレイリストアイテムの取得
      const playlistItems = await this.playlistModel.findPlaylistItems(playlistId);

      // 各アイテムに関連する音声ファイルとブックマーク情報を追加
      const enrichedItems: PlaylistItem[] = [];
      for (const item of playlistItems) {
        const audioFile = await this.audioFileModel.findById(item.audio_file_id);
        if (audioFile && audioFile.bookmark_id) {
          const bookmark = await this.bookmarkModel.findById(audioFile.bookmark_id);
          if (bookmark) {
            enrichedItems.push({
              ...item,
              audio_file: audioFile,
              bookmark: bookmark,
            });
          } else {
            enrichedItems.push({
              ...item,
              audio_file: audioFile,
            });
          }
        } else {
          enrichedItems.push(item);
        }
      }

      return {
        status: ProcessStatus.SUCCESS,
        message: `プレイリスト内の音声ファイルを取得しました: プレイリストID ${playlistId}`,
        data: enrichedItems,
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          status: ProcessStatus.ERROR,
          message: `プレイリスト内の音声ファイルの取得に失敗しました: ${error.message}`,
          error: error,
          data: [],
        };
      }
      throw error;
    }
  }
}
