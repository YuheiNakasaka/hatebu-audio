import { OpenAISummaryService } from "../../../src/services/summary/SummaryService";
import { BookmarkModel, ContentModel, SummaryModel } from "../../../src/models";
import { ProcessStatus } from "../../../src/types";
import { Configuration, OpenAIApi } from "openai";

// モック
jest.mock("openai");
jest.mock("../../../src/models/BookmarkModel");
jest.mock("../../../src/models/ContentModel");
jest.mock("../../../src/models/SummaryModel");

describe("OpenAISummaryService", () => {
  let service: OpenAISummaryService;
  let mockBookmarkModel: jest.Mocked<BookmarkModel>;
  let mockContentModel: jest.Mocked<ContentModel>;
  let mockSummaryModel: jest.Mocked<SummaryModel>;
  let mockOpenAIApi: jest.Mocked<OpenAIApi>;

  beforeEach(() => {
    // 環境変数の設定
    process.env.OPENAI_API_KEY = "test-api-key";

    // モックのリセット
    jest.clearAllMocks();

    // モデルのモック
    mockBookmarkModel = new BookmarkModel() as jest.Mocked<BookmarkModel>;
    mockContentModel = new ContentModel() as jest.Mocked<ContentModel>;
    mockSummaryModel = new SummaryModel() as jest.Mocked<SummaryModel>;
    (BookmarkModel as jest.Mock).mockImplementation(() => mockBookmarkModel);
    (ContentModel as jest.Mock).mockImplementation(() => mockContentModel);
    (SummaryModel as jest.Mock).mockImplementation(() => mockSummaryModel);

    // OpenAI APIのモック
    mockOpenAIApi = {
      createChatCompletion: jest.fn(),
    } as unknown as jest.Mocked<OpenAIApi>;
    (OpenAIApi as jest.Mock).mockImplementation(() => mockOpenAIApi);
    (Configuration as jest.Mock).mockImplementation(() => ({}));

    // サービスのインスタンス化
    service = new OpenAISummaryService();
  });

  describe("generateSummary", () => {
    it("コンテンツから要約を生成できること", async () => {
      // モックデータ
      const content = "これはテストコンテンツです。要約が必要です。";
      const mockResponse = {
        data: {
          choices: [
            {
              message: {
                content: "テストコンテンツの要約です。",
              },
            },
          ],
        },
      };

      // OpenAI APIのモック
      mockOpenAIApi.createChatCompletion.mockResolvedValue(mockResponse);

      // テスト実行
      const result = await service.generateSummary(content);

      // 検証
      expect(mockOpenAIApi.createChatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "gpt-3.5-turbo",
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: "user",
              content: expect.stringContaining(content),
            }),
          ]),
        })
      );
      expect(result).toBe("テストコンテンツの要約です。");
    });

    it("コンテンツが長い場合は切り詰めること", async () => {
      // モックデータ
      const longContent = "a".repeat(10000);
      const mockResponse = {
        data: {
          choices: [
            {
              message: {
                content: "長いコンテンツの要約です。",
              },
            },
          ],
        },
      };

      // OpenAI APIのモック
      mockOpenAIApi.createChatCompletion.mockResolvedValue(mockResponse);

      // テスト実行
      const result = await service.generateSummary(longContent);

      // 検証
      expect(mockOpenAIApi.createChatCompletion).toHaveBeenCalled();
      const callArg = mockOpenAIApi.createChatCompletion.mock.calls[0][0];
      const userMessage = callArg.messages.find((m: any) => m.role === "user");
      expect(userMessage.content.length).toBeLessThan(longContent.length);
      expect(userMessage.content).toContain("[コンテンツが長すぎるため切り詰められました]");
      expect(result).toBe("長いコンテンツの要約です。");
    });

    it("APIキーが設定されていない場合はエラーをスローすること", async () => {
      // 環境変数の削除
      delete process.env.OPENAI_API_KEY;

      // テスト実行と検証
      await expect(service.generateSummary("テストコンテンツ")).rejects.toThrow(
        "OpenAI APIキーが設定されていません"
      );
    });

    it("APIからの応答が空の場合はエラーをスローすること", async () => {
      // モックデータ
      const content = "これはテストコンテンツです。";
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
      await expect(service.generateSummary(content)).rejects.toThrow(
        "要約の生成に失敗しました。APIからの応答が空です。"
      );
    });
  });

  describe("generateAndSaveSummary", () => {
    it("ブックマークIDから要約を生成して保存できること", async () => {
      // モックデータ
      const bookmarkId = 1;
      const mockBookmark = {
        id: bookmarkId,
        url: "https://example.com/article",
        title: "テスト記事",
        bookmark_date: new Date(),
        processed: true,
      };
      const mockContent = {
        id: 1,
        bookmark_id: bookmarkId,
        raw_content: "これはテストコンテンツです。要約が必要です。",
      };
      const mockSummary = {
        id: 1,
        bookmark_id: bookmarkId,
        summary_text: "テストコンテンツの要約です。",
      };

      // モデルのモック
      mockBookmarkModel.findById.mockResolvedValue(mockBookmark);
      mockSummaryModel.findByBookmarkId.mockResolvedValue(null);
      mockContentModel.findByBookmarkId.mockResolvedValue(mockContent);
      mockSummaryModel.create.mockResolvedValue(1);

      // generateSummaryのモック
      jest.spyOn(service, "generateSummary").mockResolvedValue("テストコンテンツの要約です。");

      // テスト実行
      const result = await service.generateAndSaveSummary(bookmarkId);

      // 検証
      expect(mockBookmarkModel.findById).toHaveBeenCalledWith(bookmarkId);
      expect(mockSummaryModel.findByBookmarkId).toHaveBeenCalledWith(bookmarkId);
      expect(mockContentModel.findByBookmarkId).toHaveBeenCalledWith(bookmarkId);
      expect(service.generateSummary).toHaveBeenCalledWith(mockContent.raw_content);
      expect(mockSummaryModel.create).toHaveBeenCalled();
      expect(result.status).toBe(ProcessStatus.SUCCESS);
      expect(result.data).toEqual(expect.objectContaining({
        id: 1,
        bookmark_id: bookmarkId,
        summary_text: "テストコンテンツの要約です。",
      }));
    });

    it("既存の要約がある場合はスキップすること", async () => {
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
        summary_text: "既存の要約です。",
      };

      // モデルのモック
      mockBookmarkModel.findById.mockResolvedValue(mockBookmark);
      mockSummaryModel.findByBookmarkId.mockResolvedValue(mockSummary);

      // テスト実行
      const result = await service.generateAndSaveSummary(bookmarkId);

      // 検証
      expect(mockBookmarkModel.findById).toHaveBeenCalledWith(bookmarkId);
      expect(mockSummaryModel.findByBookmarkId).toHaveBeenCalledWith(bookmarkId);
      expect(mockContentModel.findByBookmarkId).not.toHaveBeenCalled();
      expect(service.generateSummary).not.toHaveBeenCalled();
      expect(mockSummaryModel.create).not.toHaveBeenCalled();
      expect(result.status).toBe(ProcessStatus.SKIPPED);
      expect(result.data).toEqual(mockSummary);
    });

    it("ブックマークが見つからない場合はエラーを返すこと", async () => {
      // モデルのモック
      mockBookmarkModel.findById.mockResolvedValue(null);

      // テスト実行
      const result = await service.generateAndSaveSummary(1);

      // 検証
      expect(mockBookmarkModel.findById).toHaveBeenCalledWith(1);
      expect(result.status).toBe(ProcessStatus.ERROR);
      expect(result.message).toContain("ブックマークが見つかりません");
    });

    it("コンテンツが見つからない場合はエラーを返すこと", async () => {
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
      mockSummaryModel.findByBookmarkId.mockResolvedValue(null);
      mockContentModel.findByBookmarkId.mockResolvedValue(null);

      // テスト実行
      const result = await service.generateAndSaveSummary(bookmarkId);

      // 検証
      expect(mockBookmarkModel.findById).toHaveBeenCalledWith(bookmarkId);
      expect(mockSummaryModel.findByBookmarkId).toHaveBeenCalledWith(bookmarkId);
      expect(mockContentModel.findByBookmarkId).toHaveBeenCalledWith(bookmarkId);
      expect(result.status).toBe(ProcessStatus.ERROR);
      expect(result.message).toContain("コンテンツが見つかりません");
    });
  });

  describe("processUnprocessedContents", () => {
    it("未処理のコンテンツから要約を生成して保存できること", async () => {
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
          bookmark_id: 3,
          summary_text: "既存の要約です。",
        },
      ];
      const mockContents = [
        {
          id: 1,
          bookmark_id: 1,
          raw_content: "これはテストコンテンツ1です。",
        },
        {
          id: 2,
          bookmark_id: 2,
          raw_content: "これはテストコンテンツ2です。",
        },
      ];
      const mockNewSummaries = [
        {
          id: 2,
          bookmark_id: 1,
          summary_text: "テストコンテンツ1の要約です。",
        },
        {
          id: 3,
          bookmark_id: 2,
          summary_text: "テストコンテンツ2の要約です。",
        },
      ];

      // モデルのモック
      mockSummaryModel.findAll.mockResolvedValue(mockSummaries);
      mockBookmarkModel.findAll.mockResolvedValue(mockBookmarks);
      mockContentModel.findByBookmarkId.mockImplementation((bookmarkId) => {
        return Promise.resolve(mockContents.find((c) => c.bookmark_id === bookmarkId) || null);
      });

      // generateAndSaveSummaryのモック
      const generateAndSaveSummarySpy = jest.spyOn(service, "generateAndSaveSummary");
      generateAndSaveSummarySpy.mockResolvedValueOnce({
        status: ProcessStatus.SUCCESS,
        message: "要約を生成して保存しました: ブックマークID 1",
        data: mockNewSummaries[0],
      });
      generateAndSaveSummarySpy.mockResolvedValueOnce({
        status: ProcessStatus.SUCCESS,
        message: "要約を生成して保存しました: ブックマークID 2",
        data: mockNewSummaries[1],
      });

      // テスト実行
      const result = await service.processUnprocessedContents(2);

      // 検証
      expect(mockSummaryModel.findAll).toHaveBeenCalled();
      expect(mockBookmarkModel.findAll).toHaveBeenCalled();
      expect(mockContentModel.findByBookmarkId).toHaveBeenCalledTimes(2);
      expect(generateAndSaveSummarySpy).toHaveBeenCalledTimes(2);
      expect(generateAndSaveSummarySpy).toHaveBeenCalledWith(1);
      expect(generateAndSaveSummarySpy).toHaveBeenCalledWith(2);
      expect(result.status).toBe(ProcessStatus.SUCCESS);
      expect(result.data).toHaveLength(2);
      expect(result.data?.[0]).toEqual(mockNewSummaries[0]);
      expect(result.data?.[1]).toEqual(mockNewSummaries[1]);
    });

    it("未処理のコンテンツがない場合はスキップすること", async () => {
      // モックデータ
      const mockSummaries = [
        {
          id: 1,
          bookmark_id: 1,
          summary_text: "既存の要約です。",
        },
        {
          id: 2,
          bookmark_id: 2,
          summary_text: "既存の要約です。",
        },
      ];
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

      // モデルのモック
      mockSummaryModel.findAll.mockResolvedValue(mockSummaries);
      mockBookmarkModel.findAll.mockResolvedValue(mockBookmarks);

      // テスト実行
      const result = await service.processUnprocessedContents();

      // 検証
      expect(mockSummaryModel.findAll).toHaveBeenCalled();
      expect(mockBookmarkModel.findAll).toHaveBeenCalled();
      expect(result.status).toBe(ProcessStatus.SKIPPED);
      expect(result.message).toContain("未処理のコンテンツはありません");
    });

    it("一部の要約生成に失敗した場合も成功したものは保存すること", async () => {
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
      const mockSummaries = [];
      const mockContents = [
        {
          id: 1,
          bookmark_id: 1,
          raw_content: "これはテストコンテンツ1です。",
        },
        {
          id: 2,
          bookmark_id: 2,
          raw_content: "これはテストコンテンツ2です。",
        },
      ];
      const mockNewSummary = {
        id: 1,
        bookmark_id: 1,
        summary_text: "テストコンテンツ1の要約です。",
      };

      // モデルのモック
      mockSummaryModel.findAll.mockResolvedValue(mockSummaries);
      mockBookmarkModel.findAll.mockResolvedValue(mockBookmarks);
      mockContentModel.findByBookmarkId.mockImplementation((bookmarkId) => {
        return Promise.resolve(mockContents.find((c) => c.bookmark_id === bookmarkId) || null);
      });
      mockBookmarkModel.findById.mockImplementation((id) => {
        return Promise.resolve(mockBookmarks.find((b) => b.id === id) || null);
      });

      // generateAndSaveSummaryのモック
      const generateAndSaveSummarySpy = jest.spyOn(service, "generateAndSaveSummary");
      generateAndSaveSummarySpy.mockResolvedValueOnce({
        status: ProcessStatus.SUCCESS,
        message: "要約を生成して保存しました: ブックマークID 1",
        data: mockNewSummary,
      });
      generateAndSaveSummarySpy.mockResolvedValueOnce({
        status: ProcessStatus.ERROR,
        message: "要約の生成と保存に失敗しました: API error",
      });

      // テスト実行
      const result = await service.processUnprocessedContents();

      // 検証
      expect(mockSummaryModel.findAll).toHaveBeenCalled();
      expect(mockBookmarkModel.findAll).toHaveBeenCalled();
      expect(mockContentModel.findByBookmarkId).toHaveBeenCalledTimes(2);
      expect(generateAndSaveSummarySpy).toHaveBeenCalledTimes(2);
      expect(result.status).toBe(ProcessStatus.SUCCESS);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0]).toEqual(mockNewSummary);
      expect(result.message).toContain("1件の要約を生成して保存しました");
      expect(result.message).toContain("1件のエラーが発生しました");
    });
  });
});
