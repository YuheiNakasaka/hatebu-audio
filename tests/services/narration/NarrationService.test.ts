import { OpenAINarrationService } from "../../../src/services/narration/NarrationService";
import { BookmarkModel, SummaryModel, NarrationModel } from "../../../src/models";
import { ProcessStatus } from "../../../src/types";
import { Configuration, OpenAIApi } from "openai";

// モック
jest.mock("openai");
jest.mock("../../../src/models/BookmarkModel");
jest.mock("../../../src/models/SummaryModel");
jest.mock("../../../src/models/NarrationModel");

describe("OpenAINarrationService", () => {
  let service: OpenAINarrationService;
  let mockBookmarkModel: jest.Mocked<BookmarkModel>;
  let mockSummaryModel: jest.Mocked<SummaryModel>;
  let mockNarrationModel: jest.Mocked<NarrationModel>;
  let mockOpenAIApi: jest.Mocked<OpenAIApi>;

  beforeEach(() => {
    // 環境変数の設定
    process.env.OPENAI_API_KEY = "test-api-key";

    // モックのリセット
    jest.clearAllMocks();

    // モデルのモック
    mockBookmarkModel = new BookmarkModel() as jest.Mocked<BookmarkModel>;
    mockSummaryModel = new SummaryModel() as jest.Mocked<SummaryModel>;
    mockNarrationModel = new NarrationModel() as jest.Mocked<NarrationModel>;
    (BookmarkModel as jest.Mock).mockImplementation(() => mockBookmarkModel);
    (SummaryModel as jest.Mock).mockImplementation(() => mockSummaryModel);
    (NarrationModel as jest.Mock).mockImplementation(() => mockNarrationModel);

    // OpenAI APIのモック
    mockOpenAIApi = {
      createChatCompletion: jest.fn(),
    } as unknown as jest.Mocked<OpenAIApi>;
    (OpenAIApi as jest.Mock).mockImplementation(() => mockOpenAIApi);
    (Configuration as jest.Mock).mockImplementation(() => ({}));

    // サービスのインスタンス化
    service = new OpenAINarrationService();
  });

  describe("generateNarration", () => {
    it("要約からナレーションテキストを生成できること", async () => {
      // モックデータ
      const summary = "これはテスト要約です。記事の内容をまとめています。";
      const title = "テスト記事";
      const mockResponse = {
        data: {
          choices: [
            {
              message: {
                content: "こんにちは、今日は「テスト記事」についてお話しします。この記事では...",
              },
            },
          ],
        },
      };

      // OpenAI APIのモック
      mockOpenAIApi.createChatCompletion.mockResolvedValue(mockResponse);

      // テスト実行
      const result = await service.generateNarration(summary, title);

      // 検証
      expect(mockOpenAIApi.createChatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "gpt-3.5-turbo",
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: "user",
              content: expect.stringContaining(summary),
            }),
          ]),
        })
      );
      expect(result).toBe("こんにちは、今日は「テスト記事」についてお話しします。この記事では...");
    });

    it("APIキーが設定されていない場合はエラーをスローすること", async () => {
      // 環境変数の削除
      delete process.env.OPENAI_API_KEY;

      // テスト実行と検証
      await expect(service.generateNarration("テスト要約", "テスト記事")).rejects.toThrow(
        "OpenAI APIキーが設定されていません"
      );
    });

    it("APIからの応答が空の場合はエラーをスローすること", async () => {
      // モックデータ
      const summary = "これはテスト要約です。";
      const title = "テスト記事";
      const mockResponse = {
        data: {
          choices: [
            {
              message: {
                content: "",
              },
            },
          ],
        },
      };

      // OpenAI APIのモック
      mockOpenAIApi.createChatCompletion.mockResolvedValue(mockResponse);

      // テスト実行と検証
      await expect(service.generateNarration(summary, title)).rejects.toThrow(
        "ナレーションの生成に失敗しました。APIからの応答が空です。"
      );
    });
  });

  describe("generateAndSaveNarration", () => {
    it("ブックマークIDからナレーションを生成して保存できること", async () => {
      // モックデータ
      const bookmarkId = 1;
      const mockBookmark = {
        id: bookmarkId,
        url: "https://example.com/article",
        title: "テスト記事",
        bookmark_date: new Date(),
        processed: true,
      };
      const mockSummary = {
        id: 1,
        bookmark_id: bookmarkId,
        summary_text: "これはテスト要約です。記事の内容をまとめています。",
      };
      const mockNarration = {
        id: 1,
        bookmark_id: bookmarkId,
        narration_text: "こんにちは、今日は「テスト記事」についてお話しします。この記事では...",
      };

      // モデルのモック
      mockBookmarkModel.findById.mockResolvedValue(mockBookmark);
      mockNarrationModel.findByBookmarkId.mockResolvedValue(null);
      mockSummaryModel.findByBookmarkId.mockResolvedValue(mockSummary);
      mockNarrationModel.create.mockResolvedValue(1);

      // generateNarrationのモック
      jest.spyOn(service, "generateNarration").mockResolvedValue("こんにちは、今日は「テスト記事」についてお話しします。この記事では...");

      // テスト実行
      const result = await service.generateAndSaveNarration(bookmarkId);

      // 検証
      expect(mockBookmarkModel.findById).toHaveBeenCalledWith(bookmarkId);
      expect(mockNarrationModel.findByBookmarkId).toHaveBeenCalledWith(bookmarkId);
      expect(mockSummaryModel.findByBookmarkId).toHaveBeenCalledWith(bookmarkId);
      expect(service.generateNarration).toHaveBeenCalledWith(mockSummary.summary_text, mockBookmark.title);
      expect(mockNarrationModel.create).toHaveBeenCalled();
      expect(result.status).toBe(ProcessStatus.SUCCESS);
      expect(result.data).toEqual(expect.objectContaining({
        id: 1,
        bookmark_id: bookmarkId,
        narration_text: "こんにちは、今日は「テスト記事」についてお話しします。この記事では...",
      }));
    });

    it("既存のナレーションがある場合はスキップすること", async () => {
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
        narration_text: "既存のナレーションです。",
      };

      // モデルのモック
      mockBookmarkModel.findById.mockResolvedValue(mockBookmark);
      mockNarrationModel.findByBookmarkId.mockResolvedValue(mockNarration);

      // テスト実行
      const result = await service.generateAndSaveNarration(bookmarkId);

      // 検証
      expect(mockBookmarkModel.findById).toHaveBeenCalledWith(bookmarkId);
      expect(mockNarrationModel.findByBookmarkId).toHaveBeenCalledWith(bookmarkId);
      expect(mockSummaryModel.findByBookmarkId).not.toHaveBeenCalled();
      expect(service.generateNarration).not.toHaveBeenCalled();
      expect(mockNarrationModel.create).not.toHaveBeenCalled();
      expect(result.status).toBe(ProcessStatus.SKIPPED);
      expect(result.data).toEqual(mockNarration);
    });

    it("ブックマークが見つからない場合はエラーを返すこと", async () => {
      // モデルのモック
      mockBookmarkModel.findById.mockResolvedValue(null);

      // テスト実行
      const result = await service.generateAndSaveNarration(1);

      // 検証
      expect(mockBookmarkModel.findById).toHaveBeenCalledWith(1);
      expect(result.status).toBe(ProcessStatus.ERROR);
      expect(result.message).toContain("ブックマークが見つかりません");
    });

    it("要約が見つからない場合はエラーを返すこと", async () => {
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
      mockNarrationModel.findByBookmarkId.mockResolvedValue(null);
      mockSummaryModel.findByBookmarkId.mockResolvedValue(null);

      // テスト実行
      const result = await service.generateAndSaveNarration(bookmarkId);

      // 検証
      expect(mockBookmarkModel.findById).toHaveBeenCalledWith(bookmarkId);
      expect(mockNarrationModel.findByBookmarkId).toHaveBeenCalledWith(bookmarkId);
      expect(mockSummaryModel.findByBookmarkId).toHaveBeenCalledWith(bookmarkId);
      expect(result.status).toBe(ProcessStatus.ERROR);
      expect(result.message).toContain("要約が見つかりません");
    });
  });

  describe("processUnprocessedSummaries", () => {
    it("未処理の要約からナレーションを生成して保存できること", async () => {
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
      const mockSummaries = [
        {
          id: 1,
          bookmark_id: 1,
          summary_text: "テスト要約1",
        },
        {
          id: 2,
          bookmark_id: 2,
          summary_text: "テスト要約2",
        },
      ];
      const mockNarrations = [];
      const mockNewNarrations = [
        {
          id: 1,
          bookmark_id: 1,
          narration_text: "テスト記事1のナレーションです。",
        },
        {
          id: 2,
          bookmark_id: 2,
          narration_text: "テスト記事2のナレーションです。",
        },
      ];

      // モデルのモック
      mockNarrationModel.findAll.mockResolvedValue(mockNarrations);
      mockSummaryModel.findAll.mockResolvedValue(mockSummaries);
      mockBookmarkModel.findById.mockImplementation((id) => {
        return Promise.resolve(mockBookmarks.find((b) => b.id === id) || null);
      });

      // generateAndSaveNarrationのモック
      const generateAndSaveNarrationSpy = jest.spyOn(service, "generateAndSaveNarration");
      generateAndSaveNarrationSpy.mockResolvedValueOnce({
        status: ProcessStatus.SUCCESS,
        message: "ナレーションを生成して保存しました: ブックマークID 1",
        data: mockNewNarrations[0],
      });
      generateAndSaveNarrationSpy.mockResolvedValueOnce({
        status: ProcessStatus.SUCCESS,
        message: "ナレーションを生成して保存しました: ブックマークID 2",
        data: mockNewNarrations[1],
      });

      // テスト実行
      const result = await service.processUnprocessedSummaries(2);

      // 検証
      expect(mockNarrationModel.findAll).toHaveBeenCalled();
      expect(mockSummaryModel.findAll).toHaveBeenCalled();
      expect(generateAndSaveNarrationSpy).toHaveBeenCalledTimes(2);
      expect(generateAndSaveNarrationSpy).toHaveBeenCalledWith(1);
      expect(generateAndSaveNarrationSpy).toHaveBeenCalledWith(2);
      expect(result.status).toBe(ProcessStatus.SUCCESS);
      expect(result.data).toHaveLength(2);
      expect(result.data?.[0]).toEqual(mockNewNarrations[0]);
      expect(result.data?.[1]).toEqual(mockNewNarrations[1]);
    });

    it("未処理の要約がない場合はスキップすること", async () => {
      // モックデータ
      const mockNarrations = [
        {
          id: 1,
          bookmark_id: 1,
          narration_text: "既存のナレーションです。",
        },
        {
          id: 2,
          bookmark_id: 2,
          narration_text: "既存のナレーションです。",
        },
      ];
      const mockSummaries = [
        {
          id: 1,
          bookmark_id: 1,
          summary_text: "テスト要約1",
        },
        {
          id: 2,
          bookmark_id: 2,
          summary_text: "テスト要約2",
        },
      ];

      // モデルのモック
      mockNarrationModel.findAll.mockResolvedValue(mockNarrations);
      mockSummaryModel.findAll.mockResolvedValue(mockSummaries);

      // テスト実行
      const result = await service.processUnprocessedSummaries();

      // 検証
      expect(mockNarrationModel.findAll).toHaveBeenCalled();
      expect(mockSummaryModel.findAll).toHaveBeenCalled();
      expect(result.status).toBe(ProcessStatus.SKIPPED);
      expect(result.message).toContain("未処理の要約はありません");
    });

    it("一部のナレーション生成に失敗した場合も成功したものは保存すること", async () => {
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
      const mockSummaries = [
        {
          id: 1,
          bookmark_id: 1,
          summary_text: "テスト要約1",
        },
        {
          id: 2,
          bookmark_id: 2,
          summary_text: "テスト要約2",
        },
      ];
      const mockNarrations = [];
      const mockNewNarration = {
        id: 1,
        bookmark_id: 1,
        narration_text: "テスト記事1のナレーションです。",
      };

      // モデルのモック
      mockNarrationModel.findAll.mockResolvedValue(mockNarrations);
      mockSummaryModel.findAll.mockResolvedValue(mockSummaries);
      mockBookmarkModel.findById.mockImplementation((id) => {
        return Promise.resolve(mockBookmarks.find((b) => b.id === id) || null);
      });

      // generateAndSaveNarrationのモック
      const generateAndSaveNarrationSpy = jest.spyOn(service, "generateAndSaveNarration");
      generateAndSaveNarrationSpy.mockResolvedValueOnce({
        status: ProcessStatus.SUCCESS,
        message: "ナレーションを生成して保存しました: ブックマークID 1",
        data: mockNewNarration,
      });
      generateAndSaveNarrationSpy.mockResolvedValueOnce({
        status: ProcessStatus.ERROR,
        message: "ナレーションの生成と保存に失敗しました: API error",
      });

      // テスト実行
      const result = await service.processUnprocessedSummaries();

      // 検証
      expect(mockNarrationModel.findAll).toHaveBeenCalled();
      expect(mockSummaryModel.findAll).toHaveBeenCalled();
      expect(generateAndSaveNarrationSpy).toHaveBeenCalledTimes(2);
      expect(result.status).toBe(ProcessStatus.SUCCESS);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0]).toEqual(mockNewNarration);
      expect(result.message).toContain("1件のナレーションを生成して保存しました");
      expect(result.message).toContain("1件のエラーが発生しました");
    });
  });
});
