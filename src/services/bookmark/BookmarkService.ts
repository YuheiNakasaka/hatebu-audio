import { Bookmark, HatenaBookmarkItem, ProcessResult, ProcessStatus } from "../../types";
import { BookmarkModel } from "../../models";
import RssParser from "rss-parser";
import axios from "axios";
import dotenv from "dotenv";

// 環境変数の読み込み
dotenv.config();

/**
 * はてなブックマーク取得サービスのインターフェース
 */
export interface BookmarkService {
  /**
   * はてなブックマークのRSSフィードからブックマーク情報を取得
   * @param username はてなユーザー名（省略時は環境変数から取得）
   * @param limit 取得する最大件数（デフォルト: 20）
   * @returns 取得したブックマーク情報の配列
   */
  fetchBookmarks(username?: string, limit?: number): Promise<HatenaBookmarkItem[]>;

  /**
   * ブックマーク情報をデータベースに保存
   * @param bookmarkItems ブックマーク情報の配列
   * @returns 保存結果
   */
  saveBookmarks(bookmarkItems: HatenaBookmarkItem[]): Promise<ProcessResult<Bookmark[]>>;

  /**
   * 新規ブックマークを取得して保存
   * @param username はてなユーザー名（省略時は環境変数から取得）
   * @param limit 取得する最大件数（デフォルト: 20）
   * @returns 保存結果
   */
  fetchAndSaveNewBookmarks(username?: string, limit?: number): Promise<ProcessResult<Bookmark[]>>;
}

/**
 * はてなブックマーク取得サービスの実装クラス
 */
export class HatenaBookmarkService implements BookmarkService {
  private bookmarkModel: BookmarkModel;
  private parser: RssParser;

  /**
   * コンストラクタ
   */
  constructor() {
    this.bookmarkModel = new BookmarkModel();
    this.parser = new RssParser({
      customFields: {
        item: ["dc:subject"]
      }
    });
  }

  /**
   * はてなブックマークのRSSフィードからブックマーク情報を取得
   * @param username はてなユーザー名（省略時は環境変数から取得）
   * @param limit 取得する最大件数（デフォルト: 20）
   * @returns 取得したブックマーク情報の配列
   */
  async fetchBookmarks(username?: string, limit = 20): Promise<HatenaBookmarkItem[]> {
    // ユーザー名の取得
    const hatenaUsername = username || process.env.HATENA_USERNAME;
    if (!hatenaUsername) {
      throw new Error("はてなユーザー名が指定されていません。環境変数HATENA_USERNAMEを設定してください。");
    }

    // RSSフィードのURL
    const rssUrl = `https://b.hatena.ne.jp/${hatenaUsername}/rss`;

    try {
      // RSSフィードの取得
      const response = await axios.get(rssUrl);
      const feed = await this.parser.parseString(response.data);

      // ブックマーク情報の抽出
      const bookmarkItems: HatenaBookmarkItem[] = feed.items
        .slice(0, limit)
        .map((item) => ({
          title: item.title || "",
          link: item.link || "",
          pubDate: item.pubDate || new Date().toISOString(),
          description: item.contentSnippet || "",
          categories: item.categories || (item["dc:subject"] ? [item["dc:subject"]] : []),
        }));

      return bookmarkItems;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`RSSフィードの取得に失敗しました: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * ブックマーク情報をデータベースに保存
   * @param bookmarkItems ブックマーク情報の配列
   * @returns 保存結果
   */
  async saveBookmarks(bookmarkItems: HatenaBookmarkItem[]): Promise<ProcessResult<Bookmark[]>> {
    try {
      const savedBookmarks: Bookmark[] = [];
      const errors: string[] = [];

      for (const item of bookmarkItems) {
        try {
          // URLでブックマークを検索
          const existingBookmark = await this.bookmarkModel.findByUrl(item.link);
          
          // 既存のブックマークがある場合はスキップ
          if (existingBookmark) {
            continue;
          }

          // 新規ブックマークの作成
          const bookmark: Bookmark = {
            url: item.link,
            title: item.title,
            description: item.description,
            bookmark_date: new Date(item.pubDate),
            tags: item.categories ? item.categories.join(",") : "",
            content_type: this.detectContentType(item.link),
            processed: false,
          };

          // ブックマークの保存
          const bookmarkId = await this.bookmarkModel.create(bookmark);
          
          // IDを設定して保存済みブックマークに追加
          bookmark.id = bookmarkId;
          savedBookmarks.push(bookmark);
        } catch (error) {
          if (error instanceof Error) {
            errors.push(`ブックマーク "${item.title}" の保存に失敗しました: ${error.message}`);
          }
        }
      }

      // 結果の返却
      if (savedBookmarks.length > 0) {
        return {
          status: ProcessStatus.SUCCESS,
          data: savedBookmarks,
          message: `${savedBookmarks.length}件のブックマークを保存しました。${errors.length > 0 ? `(${errors.length}件のエラーが発生しました)` : ""}`,
        };
      } else if (errors.length > 0) {
        return {
          status: ProcessStatus.ERROR,
          message: `ブックマークの保存に失敗しました: ${errors.join(", ")}`,
        };
      } else {
        return {
          status: ProcessStatus.SKIPPED,
          message: "新規ブックマークはありませんでした。",
        };
      }
    } catch (error) {
      if (error instanceof Error) {
        return {
          status: ProcessStatus.ERROR,
          message: `ブックマークの保存に失敗しました: ${error.message}`,
          error: error,
        };
      }
      throw error;
    }
  }

  /**
   * 新規ブックマークを取得して保存
   * @param username はてなユーザー名（省略時は環境変数から取得）
   * @param limit 取得する最大件数（デフォルト: 20）
   * @returns 保存結果
   */
  async fetchAndSaveNewBookmarks(username?: string, limit = 20): Promise<ProcessResult<Bookmark[]>> {
    try {
      // ブックマークの取得
      const bookmarkItems = await this.fetchBookmarks(username, limit);

      // タグがついているものだけを保存
      const filteredBookmarkItems = bookmarkItems.filter((item) => item.categories && item.categories.length > 0);
      
      // ブックマークの保存
      return await this.saveBookmarks(filteredBookmarkItems);
    } catch (error) {
      if (error instanceof Error) {
        return {
          status: ProcessStatus.ERROR,
          message: `ブックマークの取得と保存に失敗しました: ${error.message}`,
          error: error,
        };
      }
      throw error;
    }
  }

  /**
   * コンテンツタイプの検出
   * @param url URL
   * @returns コンテンツタイプ
   */
  private detectContentType(url: string): string {
    // URLの拡張子からコンテンツタイプを判定
    if (url.endsWith(".pdf")) {
      return "pdf";
    }
    
    // デフォルトはarticle
    return "article";
  }
}
