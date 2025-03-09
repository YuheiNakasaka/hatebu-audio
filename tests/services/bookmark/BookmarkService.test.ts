import { HatenaBookmarkService } from "../../../src/services/bookmark/BookmarkService";
import { BookmarkModel } from "../../../src/models";
import { ProcessStatus } from "../../../src/types";
import axios from "axios";
import RssParser from "rss-parser";

// モック
jest.mock("axios");
jest.mock("rss-parser");
jest.mock("../../../src/models/BookmarkModel");

describe("HatenaBookmarkService", () => {
  let service: HatenaBookmarkService;
  let mockBookmarkModel: jest.Mocked<BookmarkModel>;

  beforeEach(() => {
    // 環境変数の設定
    process.env.HATENA_USERNAME = "testuser";

    // モックのリセット
    jest.clearAllMocks();

    // BookmarkModelのモック
    mockBookmarkModel = new BookmarkModel() as jest.Mocked<BookmarkModel>;
    (BookmarkModel as jest.Mock).mockImplementation(() => mockBookmarkModel);

    // サービスのインスタンス化
    service = new HatenaBookmarkService();
  });

  describe("fetchBookmarks", () => {
    it("はてなブックマークのRSSフィードからブックマーク情報を取得できること", async () => {
      // モックデータ
      const mockRssData = `
        <rss version="2.0">
          <channel>
            <title>はてなブックマーク - testuser</title>
            <item>
              <title>テスト記事1</title>
              <link>https://example.com/article1</link>
              <pubDate>Mon, 01 Jan 2023 00:00:00 GMT</pubDate>
              <description>テスト記事1の説明</description>
              <category>Tech</category>
              <category>Programming</category>
            </item>
            <item>
              <title>テスト記事2</title>
              <link>https://example.com/article2</link>
              <pubDate>Tue, 02 Jan 2023 00:00:00 GMT</pubDate>
              <description>テスト記事2の説明</description>
              <category>Design</category>
            </item>
          </channel>
        </rss>
      `;

      const mockFeed = {
        items: [
          {
            title: "テスト記事1",
            link: "https://example.com/article1",
            pubDate: "Mon, 01 Jan 2023 00:00:00 GMT",
            contentSnippet: "テスト記事1の説明",
            categories: ["Tech", "Programming"],
          },
          {
            title: "テスト記事2",
            link: "https://example.com/article2",
            pubDate: "Tue, 02 Jan 2023 00:00:00 GMT",
            contentSnippet: "テスト記事2の説明",
            categories: ["Design"],
          },
        ],
      };

      // axiosのモック
      (axios.get as jest.Mock).mockResolvedValue({ data: mockRssData });

      // RssParserのモック
      const mockParseString = jest.fn().mockResolvedValue(mockFeed);
      (RssParser.prototype.parseString as jest.Mock) = mockParseString;

      // テスト実行
      const result = await service.fetchBookmarks();

      // 検証
      expect(axios.get).toHaveBeenCalledWith("https://b.hatena.ne.jp/testuser/rss");
      expect(mockParseString).toHaveBeenCalledWith(mockRssData);
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe("テスト記事1");
      expect(result[0].link).toBe("https://example.com/article1");
      expect(result[0].pubDate).toBe("Mon, 01 Jan 2023 00:00:00 GMT");
      expect(result[0].description).toBe("テスト記事1の説明");
      expect(result[0].categories).toEqual(["Tech", "Programming"]);
    });

    it("ユーザー名が指定されていない場合はエラーをスローすること", async () => {
      // 環境変数の削除
      delete process.env.HATENA_USERNAME;

      // テスト実行と検証
      await expect(service.fetchBookmarks()).rejects.toThrow(
        "はてなユーザー名が指定されていません。環境変数HATENA_USERNAMEを設定してください。"
      );
    });

    it("RSSフィードの取得に失敗した場合はエラーをスローすること", async () => {
      // axiosのモック
      (axios.get as jest.Mock).mockRejectedValue(new Error("Network error"));

      // テスト実行と検証
      await expect(service.fetchBookmarks()).rejects.toThrow(
        "RSSフィードの取得に失敗しました: Network error"
      );
    });
  });

  describe("saveBookmarks", () => {
    it("新規ブックマークをデータベースに保存できること", async () => {
      // モックデータ
      const mockBookmarkItems = [
        {
          title: "テスト記事1",
          link: "https://example.com/article1",
          pubDate: "Mon, 01 Jan 2023 00:00:00 GMT",
          description: "テスト記事1の説明",
          categories: ["Tech", "Programming"],
        },
        {
          title: "テスト記事2",
          link: "https://example.com/article2",
          pubDate: "Tue, 02 Jan 2023 00:00:00 GMT",
          description: "テスト記事2の説明",
          categories: ["Design"],
        },
      ];

      // BookmarkModelのモック
      mockBookmarkModel.findByUrl.mockImplementation((url) => {
        // 最初の記事は既存、2番目の記事は新規とする
        if (url === "https://example.com/article1") {
          return Promise.resolve({
            id: 1,
            url,
            title: "テスト記事1",
            bookmark_date: new Date("2023-01-01"),
            processed: false,
          });
        }
        return Promise.resolve(null);
      });

      mockBookmarkModel.create.mockResolvedValue(2);

      // テスト実行
      const result = await service.saveBookmarks(mockBookmarkItems);

      // 検証
      expect(result.status).toBe(ProcessStatus.SUCCESS);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0].id).toBe(2);
      expect(result.data?.[0].url).toBe("https://example.com/article2");
      expect(result.data?.[0].title).toBe("テスト記事2");
      expect(mockBookmarkModel.create).toHaveBeenCalledTimes(1);
    });

    it("新規ブックマークがない場合はスキップステータスを返すこと", async () => {
      // モックデータ
      const mockBookmarkItems = [
        {
          title: "テスト記事1",
          link: "https://example.com/article1",
          pubDate: "Mon, 01 Jan 2023 00:00:00 GMT",
          description: "テスト記事1の説明",
          categories: ["Tech", "Programming"],
        },
      ];

      // BookmarkModelのモック
      mockBookmarkModel.findByUrl.mockResolvedValue({
        id: 1,
        url: "https://example.com/article1",
        title: "テスト記事1",
        bookmark_date: new Date("2023-01-01"),
        processed: false,
      });

      // テスト実行
      const result = await service.saveBookmarks(mockBookmarkItems);

      // 検証
      expect(result.status).toBe(ProcessStatus.SKIPPED);
      expect(result.message).toBe("新規ブックマークはありませんでした。");
      expect(mockBookmarkModel.create).not.toHaveBeenCalled();
    });

    it("ブックマークの保存に失敗した場合はエラーステータスを返すこと", async () => {
      // モックデータ
      const mockBookmarkItems = [
        {
          title: "テスト記事1",
          link: "https://example.com/article1",
          pubDate: "Mon, 01 Jan 2023 00:00:00 GMT",
          description: "テスト記事1の説明",
          categories: ["Tech", "Programming"],
        },
      ];

      // BookmarkModelのモック
      mockBookmarkModel.findByUrl.mockResolvedValue(null);
      mockBookmarkModel.create.mockRejectedValue(new Error("Database error"));

      // テスト実行
      const result = await service.saveBookmarks(mockBookmarkItems);

      // 検証
      expect(result.status).toBe(ProcessStatus.ERROR);
      expect(result.message).toContain("ブックマークの保存に失敗しました");
    });
  });

  describe("fetchAndSaveNewBookmarks", () => {
    it("新規ブックマークを取得して保存できること", async () => {
      // fetchBookmarksのモック
      const mockBookmarkItems = [
        {
          title: "テスト記事1",
          link: "https://example.com/article1",
          pubDate: "Mon, 01 Jan 2023 00:00:00 GMT",
          description: "テスト記事1の説明",
          categories: ["Tech", "Programming"],
        },
      ];

      const fetchBookmarksSpy = jest.spyOn(service, "fetchBookmarks").mockResolvedValue(mockBookmarkItems);

      // saveBookmarksのモック
      const mockSaveResult = {
        status: ProcessStatus.SUCCESS,
        data: [
          {
            id: 1,
            url: "https://example.com/article1",
            title: "テスト記事1",
            bookmark_date: new Date("2023-01-01"),
            processed: false,
          },
        ],
        message: "1件のブックマークを保存しました。",
      };

      const saveBookmarksSpy = jest.spyOn(service, "saveBookmarks").mockResolvedValue(mockSaveResult);

      // テスト実行
      const result = await service.fetchAndSaveNewBookmarks();

      // 検証
      expect(fetchBookmarksSpy).toHaveBeenCalledWith(undefined, 20);
      expect(saveBookmarksSpy).toHaveBeenCalledWith(mockBookmarkItems);
      expect(result).toEqual(mockSaveResult);
    });

    it("ブックマークの取得に失敗した場合はエラーステータスを返すこと", async () => {
      // fetchBookmarksのモック
      const fetchBookmarksSpy = jest.spyOn(service, "fetchBookmarks").mockRejectedValue(new Error("Network error"));

      // テスト実行
      const result = await service.fetchAndSaveNewBookmarks();

      // 検証
      expect(fetchBookmarksSpy).toHaveBeenCalled();
      expect(result.status).toBe(ProcessStatus.ERROR);
      expect(result.message).toContain("ブックマークの取得と保存に失敗しました");
    });
  });
});
