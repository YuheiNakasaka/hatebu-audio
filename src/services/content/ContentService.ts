import { Content, ProcessResult, ProcessStatus } from "../../types";
import { ContentModel, BookmarkModel } from "../../models";
import axios from "axios";
import * as cheerio from "cheerio";
import pdfParse from "pdf-parse";
import TurndownService from "turndown";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import dotenv from "dotenv";

// 環境変数の読み込み
dotenv.config();

// fsのPromise版
const writeFileAsync = promisify(fs.writeFile);
const readFileAsync = promisify(fs.readFile);
const mkdirAsync = promisify(fs.mkdir);

/**
 * コンテンツ抽出サービスのインターフェース
 */
export interface ContentService {
  /**
   * URLからコンテンツを抽出
   * @param url 抽出対象のURL
   * @returns 抽出したコンテンツ
   */
  extractContent(url: string): Promise<string>;

  /**
   * ブックマークIDからコンテンツを抽出して保存
   * @param bookmarkId ブックマークID
   * @returns 処理結果
   */
  extractAndSaveContent(bookmarkId: number): Promise<ProcessResult<Content>>;

  /**
   * 未処理のブックマークからコンテンツを抽出して保存
   * @param limit 処理する最大件数（デフォルト: 10）
   * @returns 処理結果
   */
  processUnprocessedBookmarks(limit?: number): Promise<ProcessResult<Content[]>>;
}

/**
 * コンテンツ抽出サービスの実装クラス
 */
export class WebContentService implements ContentService {
  private contentModel: ContentModel;
  private bookmarkModel: BookmarkModel;
  private turndownService: TurndownService;

  /**
   * コンストラクタ
   */
  constructor() {
    this.contentModel = new ContentModel();
    this.bookmarkModel = new BookmarkModel();
    this.turndownService = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
    });
  }

  /**
   * URLからコンテンツを抽出
   * @param url 抽出対象のURL
   * @returns 抽出したコンテンツ
   */
  async extractContent(url: string): Promise<string> {
    // URLの種類に応じて抽出方法を切り替え
    if (url.endsWith(".pdf")) {
      return this.extractFromPdf(url);
    } else {
      return this.extractFromWebPage(url);
    }
  }

  /**
   * Webページからコンテンツを抽出
   * @param url 抽出対象のURL
   * @returns 抽出したコンテンツ
   */
  private async extractFromWebPage(url: string): Promise<string> {
    try {
      // HTMLの取得
      const response = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3864.0 Safari/537.36",
        },
      });

      const html = response.data;
      const $ = cheerio.load(html);

      // メタデータの取得
      const title = $("title").text().trim();
      const description = $('meta[name="description"]').attr("content") || "";

      // 不要な要素の削除
      $(
        "script, style, nav, footer, iframe, .ad, .advertisement, .banner, .social, .share, .comment"
      ).remove();

      // 本文の抽出（優先度順に試行）
      let content = "";

      // 1. article要素
      if (!content) {
        const article = $("article").first();
        if (article.length > 0) {
          content = article.html() || "";
        }
      }

      // 2. main要素
      if (!content) {
        const main = $("main").first();
        if (main.length > 0) {
          content = main.html() || "";
        }
      }

      // 3. .content, .entry, .post, .article クラス
      if (!content) {
        const contentElement = $(".content, .entry, .post, .article").first();
        if (contentElement.length > 0) {
          content = contentElement.html() || "";
        }
      }

      // 4. #content, #main, #entry, #post, #article ID
      if (!content) {
        const contentElement = $("#content, #main, #entry, #post, #article").first();
        if (contentElement.length > 0) {
          content = contentElement.html() || "";
        }
      }

      // 5. 最終手段: body全体
      if (!content) {
        content = $("body").html() || "";
      }

      // HTMLをMarkdownに変換
      const markdown = this.turndownService.turndown(content);

      // タイトルと説明を追加
      return `# ${title}\n\n${description ? `> ${description}\n\n` : ""}${markdown}`;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Webページからのコンテンツ抽出に失敗しました: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * PDFからコンテンツを抽出
   * @param url 抽出対象のURL
   * @returns 抽出したコンテンツ
   */
  private async extractFromPdf(url: string): Promise<string> {
    try {
      // PDFのダウンロード
      const response = await axios.get(url, {
        responseType: "arraybuffer",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; HatebuAudioBot/1.0)",
        },
      });

      // 一時ディレクトリの作成
      const tempDir = path.join(process.cwd(), "temp");
      if (!fs.existsSync(tempDir)) {
        await mkdirAsync(tempDir, { recursive: true });
      }

      // 一時ファイルの保存
      const tempFilePath = path.join(tempDir, `temp_${Date.now()}.pdf`);
      await writeFileAsync(tempFilePath, response.data);

      // PDFの解析
      const dataBuffer = await readFileAsync(tempFilePath);
      const pdfData = await pdfParse(dataBuffer);

      // 一時ファイルの削除
      fs.unlinkSync(tempFilePath);

      // タイトルと本文を抽出
      const title = pdfData.info?.Title || path.basename(url, ".pdf");
      const text = pdfData.text || "";

      return `# ${title}\n\n${text}`;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`PDFからのコンテンツ抽出に失敗しました: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * ブックマークIDからコンテンツを抽出して保存
   * @param bookmarkId ブックマークID
   * @returns 処理結果
   */
  async extractAndSaveContent(bookmarkId: number): Promise<ProcessResult<Content>> {
    try {
      // ブックマーク情報の取得
      const bookmark = await this.bookmarkModel.findById(bookmarkId);
      if (!bookmark) {
        return {
          status: ProcessStatus.ERROR,
          message: `ブックマークが見つかりません: ID ${bookmarkId}`,
        };
      }

      // 既存のコンテンツを確認
      const existingContent = await this.contentModel.findByBookmarkId(bookmarkId);
      if (existingContent) {
        return {
          status: ProcessStatus.SKIPPED,
          message: `コンテンツは既に抽出されています: ブックマークID ${bookmarkId}`,
          data: existingContent,
        };
      }

      // コンテンツの抽出
      const rawContent = await this.extractContent(bookmark.url);

      // コンテンツの保存
      const content: Content = {
        bookmark_id: bookmarkId,
        raw_content: rawContent,
      };

      const contentId = await this.contentModel.create(content);
      content.id = contentId;

      // ブックマークの処理状態を更新
      await this.bookmarkModel.update(bookmarkId, { processed: true });

      return {
        status: ProcessStatus.SUCCESS,
        message: `コンテンツを抽出して保存しました: ブックマークID ${bookmarkId}`,
        data: content,
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          status: ProcessStatus.ERROR,
          message: `コンテンツの抽出と保存に失敗しました: ${error.message}`,
          error: error,
        };
      }
      throw error;
    }
  }

  /**
   * 未処理のブックマークからコンテンツを抽出して保存
   * @param limit 処理する最大件数（デフォルト: 20）
   * @returns 処理結果
   */
  async processUnprocessedBookmarks(limit = 20): Promise<ProcessResult<Content[]>> {
    try {
      // 未処理のブックマークを取得
      const unprocessedBookmarks = await this.bookmarkModel.findUnprocessed(limit);

      if (unprocessedBookmarks.length === 0) {
        return {
          status: ProcessStatus.SKIPPED,
          message: "未処理のブックマークはありません。",
          data: [],
        };
      }

      const results: Content[] = [];
      const errors: string[] = [];

      // 各ブックマークを処理
      for (const bookmark of unprocessedBookmarks) {
        if (!bookmark.id) continue;

        try {
          console.info(`ブックマーク ${bookmark.id} - "${bookmark.title}" の処理を開始します...`);
          const result = await this.extractAndSaveContent(bookmark.id);

          if (result.status === ProcessStatus.SUCCESS && result.data) {
            results.push(result.data);
          } else if (result.status === ProcessStatus.ERROR) {
            errors.push(`ブックマーク "${bookmark.title}" の処理に失敗しました: ${result.message}`);
          }
        } catch (error) {
          if (error instanceof Error) {
            errors.push(`ブックマーク "${bookmark.title}" の処理に失敗しました: ${error.message}`);
          }
        }
      }

      // 結果の返却
      if (results.length > 0) {
        return {
          status: ProcessStatus.SUCCESS,
          data: results,
          message: `${results.length}件のコンテンツを抽出して保存しました。${
            errors.length > 0 ? `(${errors.length}件のエラーが発生しました)` : ""
          }`,
        };
      } else if (errors.length > 0) {
        return {
          status: ProcessStatus.ERROR,
          message: `コンテンツの抽出と保存に失敗しました: ${errors.join(", ")}`,
          data: [],
        };
      } else {
        return {
          status: ProcessStatus.SKIPPED,
          message: "処理するコンテンツはありませんでした。",
          data: [],
        };
      }
    } catch (error) {
      if (error instanceof Error) {
        return {
          status: ProcessStatus.ERROR,
          message: `未処理ブックマークの処理に失敗しました: ${error.message}`,
          error: error,
          data: [],
        };
      }
      throw error;
    }
  }
}
