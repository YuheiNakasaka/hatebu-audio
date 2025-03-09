import { GoogleCloudTTSService } from "../../../src/services/tts/TTSService";
import { AudioFileModel, NarrationModel, BookmarkModel } from "../../../src/models";
import { ProcessStatus } from "../../../src/types";
import { TextToSpeechClient } from "@google-cloud/text-to-speech";
import fs from "fs";
import path from "path";

// モック
jest.mock("@google-cloud/text-to-speech");
jest.mock("fs");
jest.mock("path");
jest.mock("../../../src/models/AudioFileModel");
jest.mock("../../../src/models/NarrationModel");
jest.mock("../../../src/models/BookmarkModel");

describe("GoogleCloudTTSService", () => {
  let service: GoogleCloudTTSService;
  let mockAudioFileModel: jest.Mocked<AudioFileModel>;
  let mockNarrationModel: jest.Mocked<NarrationModel>;
  let mockBookmarkModel: jest.Mocked<BookmarkModel>;
  let mockTTSClient: jest.Mocked<TextToSpeechClient>;

  beforeEach(() => {
    // 環境変数の設定
    process.env.AUDIO_OUTPUT_DIR = "./test/audio";

    // モックのリセット
    jest.clearAllMocks();

    // モデルのモック
    mockAudioFileModel = new AudioFileModel() as jest.Mocked<AudioFileModel>;
    mockNarrationModel = new NarrationModel() as jest.Mocked<NarrationModel>;
    mockBookmarkModel = new BookmarkModel() as jest.Mocked<BookmarkModel>;
    (AudioFileModel as jest.Mock).mockImplementation(() => mockAudioFileModel);
    (NarrationModel as jest.Mock).mockImplementation(() => mockNarrationModel);
    (BookmarkModel as jest.Mock).mockImplementation(() => mockBookmarkModel);

    // TextToSpeechClientのモック
    mockTTSClient = {
      synthesizeSpeech: jest.fn(),
    } as unknown as jest.Mocked<TextToSpeechClient>;
    (TextToSpeechClient as jest.Mock).mockImplementation(() => mockTTSClient);

    // fsのモック
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.mkdirSync as jest.Mock).mockImplementation(() => {});
    (fs.writeFileSync as jest.Mock).mockImplementation(() => {});

    // pathのモック
    (path.join as jest.Mock).mockImplementation((...args) => args.join("/"));
    (path.dirname as jest.Mock).mockImplementation((p) => p.split("/").slice(0, -1).join("/"));

    // サービスのインスタンス化
    service = new GoogleCloudTTSService();
  });

  describe("synthesizeSpeech", () => {
    it("ナレーションテキストから音声ファイルを生成できること", async () => {
      // モックデータ
      const text = "これはテストナレーションです。";
      const outputPath = "./test/audio/test.mp3";
      const mockAudioContent = Buffer.from("dummy audio data");
      const mockResponse = [
        {
          audioContent: mockAudioContent,
        },
      ];

      // TextToSpeechClientのモック
      mockTTSClient.synthesizeSpeech.mockResolvedValue(mockResponse);

      // テスト実行
      const result = await service.synthesizeSpeech(text, outputPath);

      // 検証
      expect(mockTTSClient.synthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({
          input: { text },
          voice: expect.objectContaining({
            languageCode: "ja-JP",
          }),
          audioConfig: expect.objectContaining({
            audioEncoding: "MP3",
          }),
        })
      );
      expect(result).toBe(outputPath);
    });

    it("長いテキストを適切に分割して処理すること", async () => {
      // モックデータ
      const longText = "a".repeat(6000);
      const outputPath = "./test/audio/test.mp3";
      const mockAudioContent = Buffer.from("dummy audio data");
      const mockResponse = [
        {
          audioContent: mockAudioContent,
        },
      ];

      // TextToSpeechClientのモック
      mockTTSClient.synthesizeSpeech.mockResolvedValue(mockResponse);

      // splitTextIntoChunksのスパイ
      const splitTextIntoChunksSpy = jest.spyOn(service as any, "splitTextIntoChunks");

      // テスト実行
      await service.synthesizeSpeech(longText, outputPath);

      // 検証
      expect(splitTextIntoChunksSpy).toHaveBeenCalledWith(longText);
      expect(mockTTSClient.synthesizeSpeech).toHaveBeenCalledTimes(2); // 2つのチャンクに分割されるはず
    });

    it("音声合成に失敗した場合はエラーをスローすること", async () => {
      // モックデータ
      const text = "これはテストナレーションです。";
      const outputPath = "./test/audio/test.mp3";

      // TextToSpeechClientのモック
      mockTTSClient.synthesizeSpeech.mockRejectedValue(new Error("TTS API error"));

      // テスト実行と検証
      await expect(service.synthesizeSpeech(text, outputPath)).rejects.toThrow(
        "音声合成に失敗しました: TTS API error"
      );
    });
  });

  describe("generateAndSaveAudioFile", () => {
    it("ブックマークIDから音声ファイルを生成して保存できること", async () => {
      // モックデータ
      const bookmarkId = 1;
      const mockBookmark = {
        id: bookmarkId,
        url: "https://example.com/article",
        title: "テスト記事",
        bookmark_date: new Date(),
        processed: true,
      };
      const mockNarration = {
        id: 1,
        bookmark_id: bookmarkId,
        narration_text: "これはテストナレーションです。",
      };
      const mockAudioFile = {
        id: 1,
        bookmark_id: bookmarkId,
        file_path: "./test/audio/bookmark_1_2023-01-01T00-00-00-000Z.mp3",
      };

      // モデルのモック
      mockBookmarkModel.findById.mockResolvedValue(mockBookmark);
      mockAudioFileModel.findByBookmarkId.mockResolvedValue(null);
      mockNarrationModel.findByBookmarkId.mockResolvedValue(mockNarration);
      mockAudioFileModel.create.mockResolvedValue(1);

      // synthesizeSpeechのモック
      jest.spyOn(service, "synthesizeSpeech").mockResolvedValue(mockAudioFile.file_path);

      // テスト実行
      const result = await service.generateAndSaveAudioFile(bookmarkId);

      // 検証
      expect(mockBookmarkModel.findById).toHaveBeenCalledWith(bookmarkId);
      expect(mockAudioFileModel.findByBookmarkId).toHaveBeenCalledWith(bookmarkId);
      expect(mockNarrationModel.findByBookmarkId).toHaveBeenCalledWith(bookmarkId);
      expect(service.synthesizeSpeech).toHaveBeenCalledWith(
        mockNarration.narration_text,
        expect.stringContaining(`bookmark_${bookmarkId}_`)
      );
      expect(mockAudioFileModel.create).toHaveBeenCalled();
      expect(result.status).toBe(ProcessStatus.SUCCESS);
      expect(result.data).toEqual(expect.objectContaining({
        id: 1,
        bookmark_id: bookmarkId,
      }));
    });

    it("既存の音声ファイルがある場合はスキップすること", async () => {
      // モックデータ
      const bookmarkId = 1;
      const mockBookmark = {
        id: bookmarkId,
        url: "https://example.com/article",
        title: "テスト記事",
        bookmark_date: new Date(),
        processed: true,
      };
      const mockAudioFile = {
        id: 1,
        bookmark_id: bookmarkId,
        file_path: "./test/audio/bookmark_1_2023-01-01T00-00-00-000Z.mp3",
      };

      // モデルのモック
      mockBookmarkModel.findById.mockResolvedValue(mockBookmark);
      mockAudioFileModel.findByBookmarkId.mockResolvedValue(mockAudioFile);

      // テスト実行
      const result = await service.generateAndSaveAudioFile(bookmarkId);

      // 検証
      expect(mockBookmarkModel.findById).toHaveBeenCalledWith(bookmarkId);
      expect(mockAudioFileModel.findByBookmarkId).toHaveBeenCalledWith(bookmarkId);
      expect(mockNarrationModel.findByBookmarkId).not.toHaveBeenCalled();
      expect(service.synthesizeSpeech).not.toHaveBeenCalled();
      expect(mockAudioFileModel.create).not.toHaveBeenCalled();
      expect(result.status).toBe(ProcessStatus.SKIPPED);
      expect(result.data).toEqual(mockAudioFile);
    });

    it("ブックマークが見つからない場合はエラーを返すこと", async () => {
      // モデルのモック
      mockBookmarkModel.findById.mockResolvedValue(null);

      // テスト実行
      const result = await service.generateAndSaveAudioFile(1);

      // 検証
      expect(mockBookmarkModel.findById).toHaveBeenCalledWith(1);
      expect(result.status).toBe(ProcessStatus.ERROR);
      expect(result.message).toContain("ブックマークが見つかりません");
    });

    it("ナレーションが見つからない場合はエラーを返すこと", async () => {
      // モックデータ
      const bookmarkId = 1;
      const mockBookmark = {
        id: bookmarkId,
        url: "https://example.com/article",
        title: "テスト記事",
        bookmark_date: new Date(),
        processed: true,
      };

      // モデルのモック
      mockBookmarkModel.findById.mockResolvedValue(mockBookmark);
      mockAudioFileModel.findByBookmarkId.mockResolvedValue(null);
      mockNarrationModel.findByBookmarkId.mockResolvedValue(null);

      // テスト実行
      const result = await service.generateAndSaveAudioFile(bookmarkId);

      // 検証
      expect(mockBookmarkModel.findById).toHaveBeenCalledWith(bookmarkId);
      expect(mockAudioFileModel.findByBookmarkId).toHaveBeenCalledWith(bookmarkId);
      expect(mockNarrationModel.findByBookmarkId).toHaveBeenCalledWith(bookmarkId);
      expect(result.status).toBe(ProcessStatus.ERROR);
      expect(result.message).toContain("ナレーションが見つかりません");
    });
  });

  describe("processUnprocessedNarrations", () => {
    it("未処理のナレーションから音声ファイルを生成して保存できること", async () => {
      // モックデータ
      const mockBookmarks = [
        {
          id: 1,
          url: "https://example.com/article1",
          title: "テスト記事1",
          bookmark_date: new Date(),
          processed: true,
        },
        {
          id: 2,
          url: "https://example.com/article2",
          title: "テスト記事2",
          bookmark_date: new Date(),
          processed: true,
        },
      ];
      const mockNarrations = [
        {
          id: 1,
          bookmark_id: 1,
          narration_text: "テストナレーション1",
        },
        {
          id: 2,
          bookmark_id: 2,
          narration_text: "テストナレーション2",
        },
      ];
      const mockAudioFiles = [];
      const mockNewAudioFiles = [
        {
          id: 1,
          bookmark_id: 1,
          file_path: "./test/audio/bookmark_1_2023-01-01T00-00-00-000Z.mp3",
        },
        {
          id: 2,
          bookmark_id: 2,
          file_path: "./test/audio/bookmark_2_2023-01-01T00-00-00-000Z.mp3",
        },
      ];

      // モデルのモック
      mockAudioFileModel.findAll.mockResolvedValue(mockAudioFiles);
      mockNarrationModel.findAll.mockResolvedValue(mockNarrations);
      mockBookmarkModel.findById.mockImplementation((id) => {
        return Promise.resolve(mockBookmarks.find((b) => b.id === id) || null);
      });

      // generateAndSaveAudioFileのモック
      const generateAndSaveAudioFileSpy = jest.spyOn(service, "generateAndSaveAudioFile");
      generateAndSaveAudioFileSpy.mockResolvedValueOnce({
        status: ProcessStatus.SUCCESS,
        message: "音声ファイルを生成して保存しました: ブックマークID 1",
        data: mockNewAudioFiles[0],
      });
      generateAndSaveAudioFileSpy.mockResolvedValueOnce({
        status: ProcessStatus.SUCCESS,
        message: "音声ファイルを生成して保存しました: ブックマークID 2",
        data: mockNewAudioFiles[1],
      });

      // テスト実行
      const result = await service.processUnprocessedNarrations(2);

      // 検証
      expect(mockAudioFileModel.findAll).toHaveBeenCalled();
      expect(mockNarrationModel.findAll).toHaveBeenCalled();
      expect(generateAndSaveAudioFileSpy).toHaveBeenCalledTimes(2);
      expect(generateAndSaveAudioFileSpy).toHaveBeenCalledWith(1);
      expect(generateAndSaveAudioFileSpy).toHaveBeenCalledWith(2);
      expect(result.status).toBe(ProcessStatus.SUCCESS);
      expect(result.data).toHaveLength(2);
      expect(result.data?.[0]).toEqual(mockNewAudioFiles[0]);
      expect(result.data?.[1]).toEqual(mockNewAudioFiles[1]);
    });

    it("未処理のナレーションがない場合はスキップすること", async () => {
      // モックデータ
      const mockAudioFiles = [
        {
          id: 1,
          bookmark_id: 1,
          file_path: "./test/audio/bookmark_1_2023-01-01T00-00-00-000Z.mp3",
        },
        {
          id: 2,
          bookmark_id: 2,
          file_path: "./test/audio/bookmark_2_2023-01-01T00-00-00-000Z.mp3",
        },
      ];
      const mockNarrations = [
        {
          id: 1,
          bookmark_id: 1,
          narration_text: "テストナレーション1",
        },
        {
          id: 2,
          bookmark_id: 2,
          narration_text: "テストナレーション2",
        },
      ];

      // モデルのモック
      mockAudioFileModel.findAll.mockResolvedValue(mockAudioFiles);
      mockNarrationModel.findAll.mockResolvedValue(mockNarrations);

      // テスト実行
      const result = await service.processUnprocessedNarrations();

      // 検証
      expect(mockAudioFileModel.findAll).toHaveBeenCalled();
      expect(mockNarrationModel.findAll).toHaveBeenCalled();
      expect(result.status).toBe(ProcessStatus.SKIPPED);
      expect(result.message).toContain("未処理のナレーションはありません");
    });

    it("一部の音声ファイル生成に失敗した場合も成功したものは保存すること", async () => {
      // モックデータ
      const mockBookmarks = [
        {
          id: 1,
          url: "https://example.com/article1",
          title: "テスト記事1",
          bookmark_date: new Date(),
          processed: true,
        },
        {
          id: 2,
          url: "https://example.com/article2",
          title: "テスト記事2",
          bookmark_date: new Date(),
          processed: true,
        },
      ];
      const mockNarrations = [
        {
          id: 1,
          bookmark_id: 1,
          narration_text: "テストナレーション1",
        },
        {
          id: 2,
          bookmark_id: 2,
          narration_text: "テストナレーション2",
        },
      ];
      const mockAudioFiles = [];
      const mockNewAudioFile = {
        id: 1,
        bookmark_id: 1,
        file_path: "./test/audio/bookmark_1_2023-01-01T00-00-00-000Z.mp3",
      };

      // モデルのモック
      mockAudioFileModel.findAll.mockResolvedValue(mockAudioFiles);
      mockNarrationModel.findAll.mockResolvedValue(mockNarrations);
      mockBookmarkModel.findById.mockImplementation((id) => {
        return Promise.resolve(mockBookmarks.find((b) => b.id === id) || null);
      });

      // generateAndSaveAudioFileのモック
      const generateAndSaveAudioFileSpy = jest.spyOn(service, "generateAndSaveAudioFile");
      generateAndSaveAudioFileSpy.mockResolvedValueOnce({
        status: ProcessStatus.SUCCESS,
        message: "音声ファイルを生成して保存しました: ブックマークID 1",
        data: mockNewAudioFile,
      });
      generateAndSaveAudioFileSpy.mockResolvedValueOnce({
        status: ProcessStatus.ERROR,
        message: "音声ファイルの生成と保存に失敗しました: TTS API error",
      });

      // テスト実行
      const result = await service.processUnprocessedNarrations();

      // 検証
      expect(mockAudioFileModel.findAll).toHaveBeenCalled();
      expect(mockNarrationModel.findAll).toHaveBeenCalled();
      expect(generateAndSaveAudioFileSpy).toHaveBeenCalledTimes(2);
      expect(result.status).toBe(ProcessStatus.SUCCESS);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0]).toEqual(mockNewAudioFile);
      expect(result.message).toContain("1件の音声ファイルを生成して保存しました");
      expect(result.message).toContain("1件のエラーが発生しました");
    });
  });
});
