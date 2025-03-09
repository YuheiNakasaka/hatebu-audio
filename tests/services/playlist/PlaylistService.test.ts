import { DefaultPlaylistService } from "../../../src/services/playlist/PlaylistService";
import { PlaylistModel, AudioFileModel, BookmarkModel } from "../../../src/models";
import { ProcessStatus } from "../../../src/types";

// モック
jest.mock("../../../src/models/PlaylistModel");
jest.mock("../../../src/models/AudioFileModel");
jest.mock("../../../src/models/BookmarkModel");

describe("DefaultPlaylistService", () => {
  let service: DefaultPlaylistService;
  let mockPlaylistModel: jest.Mocked<PlaylistModel>;
  let mockAudioFileModel: jest.Mocked<AudioFileModel>;
  let mockBookmarkModel: jest.Mocked<BookmarkModel>;

  beforeEach(() => {
    // モックのリセット
    jest.clearAllMocks();

    // モデルのモック
    mockPlaylistModel = new PlaylistModel() as jest.Mocked<PlaylistModel>;
    mockAudioFileModel = new AudioFileModel() as jest.Mocked<AudioFileModel>;
    mockBookmarkModel = new BookmarkModel() as jest.Mocked<BookmarkModel>;
    (PlaylistModel as jest.Mock).mockImplementation(() => mockPlaylistModel);
    (AudioFileModel as jest.Mock).mockImplementation(() => mockAudioFileModel);
    (BookmarkModel as jest.Mock).mockImplementation(() => mockBookmarkModel);

    // サービスのインスタンス化
    service = new DefaultPlaylistService();
  });

  describe("createPlaylist", () => {
    it("プレイリストを作成できること", async () => {
      // モックデータ
      const name = "テストプレイリスト";
      const description = "テスト用のプレイリストです";
      const mockPlaylist = {
        id: 1,
        name,
        description,
        created_at: new Date(),
      };

      // モデルのモック
      mockPlaylistModel.findByName.mockResolvedValue([]);
      mockPlaylistModel.create.mockResolvedValue(1);

      // テスト実行
      const result = await service.createPlaylist(name, description);

      // 検証
      expect(mockPlaylistModel.findByName).toHaveBeenCalledWith(name);
      expect(mockPlaylistModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name,
          description,
        })
      );
      expect(result.status).toBe(ProcessStatus.SUCCESS);
      expect(result.data).toEqual(expect.objectContaining({
        id: 1,
        name,
        description,
      }));
    });

    it("同名のプレイリストが存在する場合はエラーを返すこと", async () => {
      // モックデータ
      const name = "テストプレイリスト";
      const existingPlaylists = [
        {
          id: 1,
          name,
          created_at: new Date(),
        },
      ];

      // モデルのモック
      mockPlaylistModel.findByName.mockResolvedValue(existingPlaylists);

      // テスト実行
      const result = await service.createPlaylist(name);

      // 検証
      expect(mockPlaylistModel.findByName).toHaveBeenCalledWith(name);
      expect(mockPlaylistModel.create).not.toHaveBeenCalled();
      expect(result.status).toBe(ProcessStatus.ERROR);
      expect(result.message).toContain("同名のプレイリストが既に存在します");
    });
  });

  describe("getPlaylist", () => {
    it("プレイリストを取得できること", async () => {
      // モックデータ
      const playlistId = 1;
      const mockPlaylist = {
        id: playlistId,
        name: "テストプレイリスト",
        description: "テスト用のプレイリストです",
        created_at: new Date(),
      };

      // モデルのモック
      mockPlaylistModel.findById.mockResolvedValue(mockPlaylist);

      // テスト実行
      const result = await service.getPlaylist(playlistId);

      // 検証
      expect(mockPlaylistModel.findById).toHaveBeenCalledWith(playlistId);
      expect(result.status).toBe(ProcessStatus.SUCCESS);
      expect(result.data).toEqual(mockPlaylist);
    });

    it("プレイリストが見つからない場合はエラーを返すこと", async () => {
      // モデルのモック
      mockPlaylistModel.findById.mockResolvedValue(null);

      // テスト実行
      const result = await service.getPlaylist(1);

      // 検証
      expect(mockPlaylistModel.findById).toHaveBeenCalledWith(1);
      expect(result.status).toBe(ProcessStatus.ERROR);
      expect(result.message).toContain("プレイリストが見つかりません");
    });
  });

  describe("getAllPlaylists", () => {
    it("全プレイリストを取得できること", async () => {
      // モックデータ
      const mockPlaylists = [
        {
          id: 1,
          name: "テストプレイリスト1",
          description: "テスト用のプレイリスト1です",
          created_at: new Date(),
        },
        {
          id: 2,
          name: "テストプレイリスト2",
          description: "テスト用のプレイリスト2です",
          created_at: new Date(),
        },
      ];

      // モデルのモック
      mockPlaylistModel.findAll.mockResolvedValue(mockPlaylists);

      // テスト実行
      const result = await service.getAllPlaylists();

      // 検証
      expect(mockPlaylistModel.findAll).toHaveBeenCalled();
      expect(result.status).toBe(ProcessStatus.SUCCESS);
      expect(result.data).toEqual(mockPlaylists);
      expect(result.data?.length).toBe(2);
    });
  });

  describe("updatePlaylist", () => {
    it("プレイリストを更新できること", async () => {
      // モックデータ
      const playlistId = 1;
      const name = "更新後のプレイリスト";
      const description = "更新後の説明";
      const mockPlaylist = {
        id: playlistId,
        name: "テストプレイリスト",
        description: "テスト用のプレイリストです",
        created_at: new Date(),
      };
      const updatedPlaylist = {
        id: playlistId,
        name,
        description,
        created_at: new Date(),
      };

      // モデルのモック
      mockPlaylistModel.findById.mockResolvedValueOnce(mockPlaylist).mockResolvedValueOnce(updatedPlaylist);
      mockPlaylistModel.findByName.mockResolvedValue([]);
      mockPlaylistModel.update.mockResolvedValue(true);

      // テスト実行
      const result = await service.updatePlaylist(playlistId, name, description);

      // 検証
      expect(mockPlaylistModel.findById).toHaveBeenCalledWith(playlistId);
      expect(mockPlaylistModel.findByName).toHaveBeenCalledWith(name);
      expect(mockPlaylistModel.update).toHaveBeenCalledWith(
        playlistId,
        expect.objectContaining({
          name,
          description,
        })
      );
      expect(result.status).toBe(ProcessStatus.SUCCESS);
      expect(result.data).toEqual(updatedPlaylist);
    });

    it("同名のプレイリストが存在する場合はエラーを返すこと", async () => {
      // モックデータ
      const playlistId = 1;
      const name = "更新後のプレイリスト";
      const mockPlaylist = {
        id: playlistId,
        name: "テストプレイリスト",
        description: "テスト用のプレイリストです",
        created_at: new Date(),
      };
      const existingPlaylists = [
        {
          id: 2,
          name,
          description: "別のプレイリスト",
          created_at: new Date(),
        },
      ];

      // モデルのモック
      mockPlaylistModel.findById.mockResolvedValue(mockPlaylist);
      mockPlaylistModel.findByName.mockResolvedValue(existingPlaylists);

      // テスト実行
      const result = await service.updatePlaylist(playlistId, name);

      // 検証
      expect(mockPlaylistModel.findById).toHaveBeenCalledWith(playlistId);
      expect(mockPlaylistModel.findByName).toHaveBeenCalledWith(name);
      expect(mockPlaylistModel.update).not.toHaveBeenCalled();
      expect(result.status).toBe(ProcessStatus.ERROR);
      expect(result.message).toContain("同名のプレイリストが既に存在します");
    });

    it("プレイリストが見つからない場合はエラーを返すこと", async () => {
      // モデルのモック
      mockPlaylistModel.findById.mockResolvedValue(null);

      // テスト実行
      const result = await service.updatePlaylist(1, "更新後のプレイリスト");

      // 検証
      expect(mockPlaylistModel.findById).toHaveBeenCalledWith(1);
      expect(mockPlaylistModel.update).not.toHaveBeenCalled();
      expect(result.status).toBe(ProcessStatus.ERROR);
      expect(result.message).toContain("プレイリストが見つかりません");
    });
  });

  describe("deletePlaylist", () => {
    it("プレイリストを削除できること", async () => {
      // モックデータ
      const playlistId = 1;
      const mockPlaylist = {
        id: playlistId,
        name: "テストプレイリスト",
        description: "テスト用のプレイリストです",
        created_at: new Date(),
      };

      // モデルのモック
      mockPlaylistModel.findById.mockResolvedValue(mockPlaylist);
      mockPlaylistModel.delete.mockResolvedValue(true);

      // テスト実行
      const result = await service.deletePlaylist(playlistId);

      // 検証
      expect(mockPlaylistModel.findById).toHaveBeenCalledWith(playlistId);
      expect(mockPlaylistModel.delete).toHaveBeenCalledWith(playlistId);
      expect(result.status).toBe(ProcessStatus.SUCCESS);
    });

    it("プレイリストが見つからない場合はエラーを返すこと", async () => {
      // モデルのモック
      mockPlaylistModel.findById.mockResolvedValue(null);

      // テスト実行
      const result = await service.deletePlaylist(1);

      // 検証
      expect(mockPlaylistModel.findById).toHaveBeenCalledWith(1);
      expect(mockPlaylistModel.delete).not.toHaveBeenCalled();
      expect(result.status).toBe(ProcessStatus.ERROR);
      expect(result.message).toContain("プレイリストが見つかりません");
    });
  });

  describe("addAudioFileToPlaylist", () => {
    it("プレイリストに音声ファイルを追加できること", async () => {
      // モックデータ
      const playlistId = 1;
      const audioFileId = 2;
      const mockPlaylist = {
        id: playlistId,
        name: "テストプレイリスト",
        description: "テスト用のプレイリストです",
        created_at: new Date(),
      };
      const mockAudioFile = {
        id: audioFileId,
        bookmark_id: 3,
        file_path: "/path/to/audio.mp3",
        generated_at: new Date(),
      };
      const mockPlaylistItem = {
        id: 1,
        playlist_id: playlistId,
        audio_file_id: audioFileId,
        position: 1,
      };

      // モデルのモック
      mockPlaylistModel.findById.mockResolvedValue(mockPlaylist);
      mockAudioFileModel.findById.mockResolvedValue(mockAudioFile);
      mockPlaylistModel.findPlaylistItem.mockResolvedValue(null);
      mockPlaylistModel.findPlaylistItems.mockResolvedValue([]);
      mockPlaylistModel.addPlaylistItem.mockResolvedValue(1);

      // テスト実行
      const result = await service.addAudioFileToPlaylist(playlistId, audioFileId);

      // 検証
      expect(mockPlaylistModel.findById).toHaveBeenCalledWith(playlistId);
      expect(mockAudioFileModel.findById).toHaveBeenCalledWith(audioFileId);
      expect(mockPlaylistModel.findPlaylistItem).toHaveBeenCalledWith(playlistId, audioFileId);
      expect(mockPlaylistModel.findPlaylistItems).toHaveBeenCalledWith(playlistId);
      expect(mockPlaylistModel.addPlaylistItem).toHaveBeenCalledWith(
        expect.objectContaining({
          playlist_id: playlistId,
          audio_file_id: audioFileId,
          position: 1,
        })
      );
      expect(result.status).toBe(ProcessStatus.SUCCESS);
      expect(result.data).toEqual(expect.objectContaining({
        id: 1,
        playlist_id: playlistId,
        audio_file_id: audioFileId,
        position: 1,
      }));
    });

    it("既に追加されている場合はスキップすること", async () => {
      // モックデータ
      const playlistId = 1;
      const audioFileId = 2;
      const mockPlaylist = {
        id: playlistId,
        name: "テストプレイリスト",
        description: "テスト用のプレイリストです",
        created_at: new Date(),
      };
      const mockAudioFile = {
        id: audioFileId,
        bookmark_id: 3,
        file_path: "/path/to/audio.mp3",
        generated_at: new Date(),
      };
      const mockPlaylistItem = {
        id: 1,
        playlist_id: playlistId,
        audio_file_id: audioFileId,
        position: 1,
      };

      // モデルのモック
      mockPlaylistModel.findById.mockResolvedValue(mockPlaylist);
      mockAudioFileModel.findById.mockResolvedValue(mockAudioFile);
      mockPlaylistModel.findPlaylistItem.mockResolvedValue(mockPlaylistItem);

      // テスト実行
      const result = await service.addAudioFileToPlaylist(playlistId, audioFileId);

      // 検証
      expect(mockPlaylistModel.findById).toHaveBeenCalledWith(playlistId);
      expect(mockAudioFileModel.findById).toHaveBeenCalledWith(audioFileId);
      expect(mockPlaylistModel.findPlaylistItem).toHaveBeenCalledWith(playlistId, audioFileId);
      expect(mockPlaylistModel.addPlaylistItem).not.toHaveBeenCalled();
      expect(result.status).toBe(ProcessStatus.SKIPPED);
      expect(result.data).toEqual(mockPlaylistItem);
    });
  });

  describe("removeAudioFileFromPlaylist", () => {
    it("プレイリストから音声ファイルを削除できること", async () => {
      // モックデータ
      const playlistId = 1;
      const audioFileId = 2;
      const mockPlaylist = {
        id: playlistId,
        name: "テストプレイリスト",
        description: "テスト用のプレイリストです",
        created_at: new Date(),
      };
      const mockPlaylistItem = {
        id: 1,
        playlist_id: playlistId,
        audio_file_id: audioFileId,
        position: 1,
      };

      // モデルのモック
      mockPlaylistModel.findById.mockResolvedValue(mockPlaylist);
      mockPlaylistModel.findPlaylistItem.mockResolvedValue(mockPlaylistItem);
      mockPlaylistModel.removePlaylistItem.mockResolvedValue(true);
      mockPlaylistModel.findPlaylistItems.mockResolvedValue([]);

      // テスト実行
      const result = await service.removeAudioFileFromPlaylist(playlistId, audioFileId);

      // 検証
      expect(mockPlaylistModel.findById).toHaveBeenCalledWith(playlistId);
      expect(mockPlaylistModel.findPlaylistItem).toHaveBeenCalledWith(playlistId, audioFileId);
      expect(mockPlaylistModel.removePlaylistItem).toHaveBeenCalledWith(playlistId, audioFileId);
      expect(result.status).toBe(ProcessStatus.SUCCESS);
    });

    it("プレイリストアイテムが見つからない場合はスキップすること", async () => {
      // モックデータ
      const playlistId = 1;
      const audioFileId = 2;
      const mockPlaylist = {
        id: playlistId,
        name: "テストプレイリスト",
        description: "テスト用のプレイリストです",
        created_at: new Date(),
      };

      // モデルのモック
      mockPlaylistModel.findById.mockResolvedValue(mockPlaylist);
      mockPlaylistModel.findPlaylistItem.mockResolvedValue(null);

      // テスト実行
      const result = await service.removeAudioFileFromPlaylist(playlistId, audioFileId);

      // 検証
      expect(mockPlaylistModel.findById).toHaveBeenCalledWith(playlistId);
      expect(mockPlaylistModel.findPlaylistItem).toHaveBeenCalledWith(playlistId, audioFileId);
      expect(mockPlaylistModel.removePlaylistItem).not.toHaveBeenCalled();
      expect(result.status).toBe(ProcessStatus.SKIPPED);
    });
  });

  describe("reorderPlaylistItem", () => {
    it("プレイリスト内の音声ファイルの順序を変更できること", async () => {
      // モックデータ
      const playlistId = 1;
      const audioFileId = 2;
      const newPosition = 3;
      const mockPlaylist = {
        id: playlistId,
        name: "テストプレイリスト",
        description: "テスト用のプレイリストです",
        created_at: new Date(),
      };
      const mockPlaylistItem = {
        id: 1,
        playlist_id: playlistId,
        audio_file_id: audioFileId,
        position: 1,
      };
      const mockPlaylistItems = [
        mockPlaylistItem,
        {
          id: 2,
          playlist_id: playlistId,
          audio_file_id: 3,
          position: 2,
        },
        {
          id: 3,
          playlist_id: playlistId,
          audio_file_id: 4,
          position: 3,
        },
      ];

      // モデルのモック
      mockPlaylistModel.findById.mockResolvedValue(mockPlaylist);
      mockPlaylistModel.findPlaylistItem.mockResolvedValue(mockPlaylistItem);
      mockPlaylistModel.findPlaylistItems.mockResolvedValue(mockPlaylistItems);
      mockPlaylistModel.updatePlaylistItemPosition.mockResolvedValue(true);

      // テスト実行
      const result = await service.reorderPlaylistItem(playlistId, audioFileId, newPosition);

      // 検証
      expect(mockPlaylistModel.findById).toHaveBeenCalledWith(playlistId);
      expect(mockPlaylistModel.findPlaylistItem).toHaveBeenCalledWith(playlistId, audioFileId);
      expect(mockPlaylistModel.findPlaylistItems).toHaveBeenCalledWith(playlistId);
      expect(mockPlaylistModel.updatePlaylistItemPosition).toHaveBeenCalledWith(mockPlaylistItem.id, newPosition);
      expect(result.status).toBe(ProcessStatus.SUCCESS);
    });

    it("プレイリストアイテムが見つからない場合はエラーを返すこと", async () => {
      // モックデータ
      const playlistId = 1;
      const audioFileId = 2;
      const newPosition = 3;
      const mockPlaylist = {
        id: playlistId,
        name: "テストプレイリスト",
        description: "テスト用のプレイリストです",
        created_at: new Date(),
      };

      // モデルのモック
      mockPlaylistModel.findById.mockResolvedValue(mockPlaylist);
      mockPlaylistModel.findPlaylistItem.mockResolvedValue(null);

      // テスト実行
      const result = await service.reorderPlaylistItem(playlistId, audioFileId, newPosition);

      // 検証
      expect(mockPlaylistModel.findById).toHaveBeenCalledWith(playlistId);
      expect(mockPlaylistModel.findPlaylistItem).toHaveBeenCalledWith(playlistId, audioFileId);
      expect(mockPlaylistModel.updatePlaylistItemPosition).not.toHaveBeenCalled();
      expect(result.status).toBe(ProcessStatus.ERROR);
      expect(result.message).toContain("音声ファイルはプレイリストに存在しません");
    });
  });

  describe("getPlaylistItems", () => {
    it("プレイリスト内の音声ファイルを取得できること", async () => {
      // モックデータ
      const playlistId = 1;
      const mockPlaylist = {
        id: playlistId,
        name: "テストプレイリスト",
        description: "テスト用のプレイリストです",
        created_at: new Date(),
      };
      const mockPlaylistItems = [
        {
          id: 1,
          playlist_id: playlistId,
          audio_file_id: 2,
          position: 1,
        },
        {
          id: 2,
          playlist_id: playlistId,
          audio_file_id: 3,
          position: 2,
        },
      ];
      const mockAudioFile1 = {
        id: 2,
        bookmark_id: 4,
        file_path: "/path/to/audio1.mp3",
        generated_at: new Date(),
      };
      const mockAudioFile2 = {
        id: 3,
        bookmark_id: 5,
        file_path: "/path/to/audio2.mp3",
        generated_at: new Date(),
      };
      const mockBookmark1 = {
        id: 4,
        url: "https://example.com/article1",
        title: "テスト記事1",
        bookmark_date: new Date(),
        processed: true,
      };
      const mockBookmark2 = {
        id: 5,
        url: "https://example.com/article2",
        title: "テスト記事2",
        bookmark_date: new Date(),
        processed: true,
      };

      // モデルのモック
      mockPlaylistModel.findById.mockResolvedValue(mockPlaylist);
      mockPlaylistModel.findPlaylistItems.mockResolvedValue(mockPlaylistItems);
      mockAudioFileModel.findById.mockImplementation((id) => {
        if (id === 2) return Promise.resolve(mockAudioFile1);
        if (id === 3) return Promise.resolve(mockAudioFile2);
        return Promise.resolve(null);
      });
      mockBookmarkModel.findById.mockImplementation((id) => {
        if (id === 4) return Promise.resolve(mockBookmark1);
        if (id === 5) return Promise.resolve(mockBookmark2);
        return Promise.resolve(null);
      });

      // テスト実行
      const result = await service.getPlaylistItems(playlistId);

      // 検証
      expect(mockPlaylistModel.findById).toHaveBeenCalledWith(playlistId);
      expect(mockPlaylistModel.findPlaylistItems).toHaveBeenCalledWith(playlistId);
      expect(mockAudioFileModel.findById).toHaveBeenCalledTimes(2);
      expect(mockBookmarkModel.findById).toHaveBeenCalledTimes(2);
      expect(result.status).toBe(ProcessStatus.SUCCESS);
      expect(result.data).toHaveLength(2);
      expect(result.data?.[0]).toEqual(expect.objectContaining({
        id: 1,
        playlist_id: playlistId,
        audio_file_id: 2,
        position: 1,
        audio_file: mockAudioFile1,
        bookmark: mockBookmark1,
      }));
      expect(result.data?.[1]).toEqual(expect.objectContaining({
        id: 2,
        playlist_id: playlistId,
        audio_file_id: 3,
        position: 2,
        audio_file: mockAudioFile2,
        bookmark: mockBookmark2,
      }));
    });

    it("プレイリストが見つからない場合はエラーを返すこと", async () => {
      // モデルのモック
      mockPlaylistModel.findById.mockResolvedValue(null);

      // テスト実行
      const result = await service.getPlaylistItems(1);

      // 検証
      expect(mockPlaylistModel.findById).toHaveBeenCalledWith(1);
      expect(mockPlaylistModel.findPlaylistItems).not.toHaveBeenCalled();
      expect(result.status).toBe(ProcessStatus.ERROR);
      expect(result.message).toContain("プレイリストが見つかりません");
    });
  });
});
