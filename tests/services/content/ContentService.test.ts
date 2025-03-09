import { WebContentService } from "../../../src/services/content/ContentService";
import { BookmarkModel, ContentModel } from "../../../src/models";
import { ProcessStatus } from "../../../src/types";
import axios from "axios";
import * as cheerio from "cheerio";
import pdfParse from "pdf-parse";
import fs from "fs";

// モック
jest.mock("axios");
jest.mock("cheerio");
jest.mock("pdf-parse");
jest.mock("turndown");
jest.mock("fs");
jest.mock("../../../src/models/BookmarkModel");
jest.mock("../../../src/models/ContentModel");

describe("WebContentService", () => {
  let service: WebContentService;
  let mockBookmarkModel: jest.Mocked<BookmarkModel>;
  let mockContentModel: jest.Mocked<ContentModel>;

  beforeEach(() => {
    // モックのリセット
    jest.clearAllMocks();

    // BookmarkModelとContentModelのモック
    mockBookmarkModel = new BookmarkModel() as jest.Mocked<BookmarkModel>;
    mockContentModel = new ContentModel() as jest.Mocked<ContentModel>;
    (BookmarkModel as jest.Mock).mockImplementation(() => mockBookmarkModel);
    (ContentModel as jest.Mock).mockImplementation(() => mockContentModel);

    // fsのモック
    (fs.existsSync as jest.Mock).mockReturnValue(true);

    // サービスのインスタンス化
    service = new WebContentService();
  });

  describe("extractContent", () => {
    it("Webページからコンテンツを抽出できること", async () => {
      // モックデータ
      const url = "https://example.com/article";
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>テスト記事</title>
            <meta name="description" content="テスト記事の説明">
          </head>
          <body>
            <article>
              <h1>テスト記事</h1>
              <p>これはテスト記事の本文です。</p>
            </article>
          </body>
        </html>
      `;

      // axiosのモック
      (axios.get as jest.Mock).mockResolvedValue({ data: mockHtml });

      // cheerioのモック
      const mockCheerioObj = {
        title: jest.fn().mockReturnValue({ text: jest.fn().mockReturnValue("テスト記事") }),
        "meta[name=\"description\"]": jest.fn().mockReturnValue({ attr: jest.fn().mockReturnValue("テスト記事の説明") }),
        remove: jest.fn(),
        article: jest.fn().mockReturnValue({ first: jest.fn().mockReturnValue({ length: 1, html: jest.fn().mockReturnValue("<h1>テスト記事</h1><p>これはテスト記事の本文です。</p>") }) }),
        main: jest.fn().mockReturnValue({ first: jest.fn().mockReturnValue({ length: 0 }) }),
        ".content, .entry, .post, .article": jest.fn().mockReturnValue({ first: jest.fn().mockReturnValue({ length: 0 }) }),
        "#content, #main, #entry, #post, #article": jest.fn().mockReturnValue({ first: jest.fn().mockReturnValue({ length: 0 }) }),
        body: jest.fn().mockReturnValue({ html: jest.fn().mockReturnValue("") }),
      };
      (cheerio.load as jest.Mock).mockReturnValue(mockCheerioObj);

      // turndownのモック
      const mockTurndown = jest.fn().mockReturnValue("# テスト記事\n\nこれはテスト記事の本文です。");
      jest.spyOn(service["turndownService"], "turndown").mockImplementation(mockTurndown);

      // テスト実行
      const result = await service.extractContent(url);

      // 検証
      expect(axios.get).toHaveBeenCalledWith(url, expect.any(Object));
      expect(result).toContain("# テスト記事");
      expect(result).toContain("テスト記事の説明");
      expect(result).toContain("# テスト記事\n\nこれはテスト記事の本文です。");
    });

    it("PDFからコンテンツを抽出できること", async () => {
      // モックデータ
      const url = "https://example.com/document.pdf";
      const mockPdfBuffer = Buffer.from("dummy pdf data");

      // axiosのモック
      (axios.get as jest.Mock).mockResolvedValue({ data: mockPdfBuffer });

      // pdfParseのモック
      const mockPdfData = {
        info: { Title: "テストPDF" },
        text: "これはテストPDFの本文です。",
      };
      (pdfParse as unknown as jest.Mock).mockResolvedValue(mockPdfData);

      // テスト実行
      const result = await service.extractContent(url);

      // 検証
      expect(axios.get).toHaveBeenCalledWith(url, expect.any(Object));
      expect(pdfParse).toHaveBeenCalled();
      expect(result).toContain("# テストPDF");
      expect(result).toContain("これはテストPDFの本文です。");
    });

    it("Webページの取得に失敗した場合はエラーをスローすること", async () => {
      // axiosのモック
      (axios.get as jest.Mock).mockRejectedValue(new Error("Network error"));

      // テスト実行と検証
      await expect(service.extractContent("https://example.com/article")).rejects.toThrow(
        "Webページからのコンテンツ抽出に失敗しました: Network error"
      );
    });
  });

  describe("extractAndSaveContent", () => {
    it("ブックマークIDからコンテンツを抽出して保存できること", async () => {
      // モックデータ
      const bookmarkId = 1;
      const mockBookmark = {
        id: bookmarkId,
        url: "https://example.com/article",
        title: "テスト記事",
        bookmark_date: new Date(),
        processed: false,
      };
      const mockContent = {
        id: 1,
        bookmark_id: bookmarkId,
        raw_content: "# テスト記事\n\nこれはテスト記事の本文です。",
      };

      // BookmarkModelのモック
      mockBookmarkModel.findById.mockResolvedValue(mockBookmark);
      mockContentModel.findByBookmarkId.mockResolvedValue(null);
      mockContentModel.create.mockResolvedValue(1);
      mockBookmarkModel.update.mockResolvedValue(true);

      // extractContentのモック
      jest.spyOn(service, "extractContent").mockResolvedValue("# テスト記事\n\nこれはテスト記事の本文です。");

      // テスト実行
      const result = await service.extractAndSaveContent(bookmarkId);

      // 検証
      expect(mockBookmarkModel.findById).toHaveBeenCalledWith(bookmarkId);
      expect(mockContentModel.findByBookmarkId).toHaveBeenCalledWith(bookmarkId);
      expect(service.extractContent).toHaveBeenCalledWith(mockBookmark.url);
      expect(mockContentModel.create).toHaveBeenCalled();
      expect(mockBookmarkModel.update).toHaveBeenCalledWith(bookmarkId, { processed: true });
      expect(result.status).toBe(ProcessStatus.SUCCESS);
      expect(result.data).toEqual(expect.objectContaining({
        id: 1,
        bookmark_id: bookmarkId,
        raw_content: "# テスト記事\n\nこれはテスト記事の本文です。",
      }));
    });

    it("既存のコンテンツがある場合はスキップすること", async () => {
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
        raw_content: "# テスト記事\n\nこれはテスト記事の本文です。",
      };

      // BookmarkModelのモック
      mockBookmarkModel.findById.mockResolvedValue(mockBookmark);
      mockContentModel.findByBookmarkId.mockResolvedValue(mockContent);

      // テスト実行
      const result = await service.extractAndSaveContent(bookmarkId);

      // 検証
      expect(mockBookmarkModel.findById).toHaveBeenCalledWith(bookmarkId);
      expect(mockContentModel.findByBookmarkId).toHaveBeenCalledWith(bookmarkId);
      expect(service.extractContent).not.toHaveBeenCalled();
      expect(mockContentModel.create).not.toHaveBeenCalled();
      expect(result.status).toBe(ProcessStatus.SKIPPED);
      expect(result.data).toEqual(mockContent);
    });

    it("ブックマークが見つからない場合はエラーを返すこと", async () => {
      // BookmarkModelのモック
      mockBookmarkModel.findById.mockResolvedValue(null);

      // テスト実行
      const result = await service.extractAndSaveContent(1);

      // 検証
      expect(mockBookmarkModel.findById).toHaveBeenCalledWith(1);
      expect(result.status).toBe(ProcessStatus.ERROR);
      expect(result.message).toContain("ブックマークが見つかりません");
    });
  });

  describe("processUnprocessedBookmarks", () => {
    it("未処理のブックマークからコンテンツを抽出して保存できること", async () => {
      // モックデータ
      const mockBookmarks = [
        {
          id: 1,
          url: "https://example.com/article1",
          title: "テスト記事1",
          bookmark_date: new Date(),
          processed: false,
        },
        {
          id: 2,
          url: "https://example.com/article2",
          title: "テスト記事2",
          bookmark_date: new Date(),
          processed: false,
        },
      ];
      const mockContents = [
        {
          id: 1,
          bookmark_id: 1,
          raw_content: "# テスト記事1\n\nこれはテスト記事1の本文です。",
        },
        {
          id: 2,
          bookmark_id: 2,
          raw_content: "# テスト記事2\n\nこれはテスト記事2の本文です。",
        },
      ];

      // BookmarkModelのモック
      mockBookmarkModel.findUnprocessed.mockResolvedValue(mockBookmarks);

      // extractAndSaveContentのモック
      const extractAndSaveContentSpy = jest.spyOn(service, "extractAndSaveContent");
      extractAndSaveContentSpy.mockResolvedValueOnce({
        status: ProcessStatus.SUCCESS,
        message: "コンテンツを抽出して保存しました: ブックマークID 1",
        data: mockContents[0],
      });
      extractAndSaveContentSpy.mockResolvedValueOnce({
        status: ProcessStatus.SUCCESS,
        message: "コンテンツを抽出して保存しました: ブックマークID 2",
        data: mockContents[1],
      });

      // テスト実行
      const result = await service.processUnprocessedBookmarks(2);

      // 検証
      expect(mockBookmarkModel.findUnprocessed).toHaveBeenCalledWith(2);
      expect(extractAndSaveContentSpy).toHaveBeenCalledTimes(2);
      expect(extractAndSaveContentSpy).toHaveBeenCalledWith(1);
      expect(extractAndSaveContentSpy).toHaveBeenCalledWith(2);
      expect(result.status).toBe(ProcessStatus.SUCCESS);
      expect(result.data).toHaveLength(2);
      expect(result.data?.[0]).toEqual(mockContents[0]);
      expect(result.data?.[1]).toEqual(mockContents[1]);
    });

    it("未処理のブックマークがない場合はスキップすること", async () => {
      // BookmarkModelのモック
      mockBookmarkModel.findUnprocessed.mockResolvedValue([]);

      // テスト実行
      const result = await service.processUnprocessedBookmarks();

      // 検証
      expect(mockBookmarkModel.findUnprocessed).toHaveBeenCalled();
      expect(result.status).toBe(ProcessStatus.SKIPPED);
      expect(result.message).toContain("未処理のブックマークはありません");
    });

    it("一部のブックマーク処理に失敗した場合も成功したものは保存すること", async () => {
      // モックデータ
      const mockBookmarks = [
        {
          id: 1,
          url: "https://example.com/article1",
          title: "テスト記事1",
          bookmark_date: new Date(),
          processed: false,
        },
        {
          id: 2,
          url: "https://example.com/article2",
          title: "テスト記事2",
          bookmark_date: new Date(),
          processed: false,
        },
      ];
      const mockContent = {
        id: 1,
        bookmark_id: 1,
        raw_content: "# テスト記事1\n\nこれはテスト記事1の本文です。",
      };

      // BookmarkModelのモック
      mockBookmarkModel.findUnprocessed.mockResolvedValue(mockBookmarks);

      // extractAndSaveContentのモック
      const extractAndSaveContentSpy = jest.spyOn(service, "extractAndSaveContent");
      extractAndSaveContentSpy.mockResolvedValueOnce({
        status: ProcessStatus.SUCCESS,
        message: "コンテンツを抽出して保存しました: ブックマークID 1",
        data: mockContent,
      });
      extractAndSaveContentSpy.mockResolvedValueOnce({
        status: ProcessStatus.ERROR,
        message: "コンテンツの抽出と保存に失敗しました: Network error",
      });

      // テスト実行
      const result = await service.processUnprocessedBookmarks();

      // 検証
      expect(mockBookmarkModel.findUnprocessed).toHaveBeenCalled();
      expect(extractAndSaveContentSpy).toHaveBeenCalledTimes(2);
      expect(result.status).toBe(ProcessStatus.SUCCESS);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0]).toEqual(mockContent);
      expect(result.message).toContain("1件のコンテンツを抽出して保存しました");
      expect(result.message).toContain("1件のエラーが発生しました");
    });
  });
});
