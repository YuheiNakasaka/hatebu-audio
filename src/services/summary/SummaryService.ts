import { Summary, Content, ProcessResult, ProcessStatus } from "../../types";
import { SummaryModel, ContentModel, BookmarkModel } from "../../models";
import { Configuration, OpenAIApi } from "openai";
import dotenv from "dotenv";

// 環境変数の読み込み
dotenv.config();

/**
 * 要約生成サービスのインターフェース
 */
export interface SummaryService {
  /**
   * コンテンツから要約を生成
   * @param content コンテンツ
   * @returns 生成した要約テキスト
   */
  generateSummary(content: string): Promise<string>;

  /**
   * ブックマークIDから要約を生成して保存
   * @param bookmarkId ブックマークID
   * @returns 処理結果
   */
  generateAndSaveSummary(bookmarkId: number): Promise<ProcessResult<Summary>>;

  /**
   * 未処理のコンテンツから要約を生成して保存
   * @param limit 処理する最大件数（デフォルト: 10）
   * @returns 処理結果
   */
  processUnprocessedContents(limit?: number): Promise<ProcessResult<Summary[]>>;
}

/**
 * OpenAI APIを使用した要約生成サービスの実装クラス
 */
export class OpenAISummaryService implements SummaryService {
  private summaryModel: SummaryModel;
  private contentModel: ContentModel;
  private bookmarkModel: BookmarkModel;
  private openai: OpenAIApi;

  /**
   * コンストラクタ
   */
  constructor() {
    this.summaryModel = new SummaryModel();
    this.contentModel = new ContentModel();
    this.bookmarkModel = new BookmarkModel();

    // OpenAI APIの設定
    const configuration = new Configuration({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.openai = new OpenAIApi(configuration);
  }

  /**
   * コンテンツから要約を生成
   * @param content コンテンツ
   * @returns 生成した要約テキスト
   */
  async generateSummary(content: string): Promise<string> {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI APIキーが設定されていません。環境変数OPENAI_API_KEYを設定してください。");
    }

    try {
      // コンテンツの長さを確認し、必要に応じて切り詰める
      const maxTokens = 60000; // GPT-4o-miniの最大トークン数の約半分
      let truncatedContent = content;
      
      // 簡易的なトークン数の見積もり（日本語の場合は文字数の約2倍がトークン数の目安）
      if (content.length > maxTokens * 2) {
        truncatedContent = content.substring(0, maxTokens * 2);
        truncatedContent += "\n\n[コンテンツが長すぎるため切り詰められました]";
      }

      // OpenAI APIを使用して要約を生成
      const response = await this.openai.createChatCompletion({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
あなたは優秀な放送作家です。与えられた情報をもとに、ラジオMCが読み上げる台本を作成してください。
ラジオは楽しい雰囲気で、スピーカーは日本のFMラジオのような喋り方をします。ラジオのMCは1人で、名前は「サラ」です。サラは気さくで陽気な人物です。口調は優しく丁寧で、フレンドリーです。
記事の紹介、内容の解説、この記事に登場した一般的なソフトウェアエンジニアにとって難しめな概念や用語があればその補足解説、最後にMCなりの視点での感想を含めてください。
聞き手が内容を理解しやすいよう工夫してください。生成する文章はそのまま読み上げられるので不要な記号文字などは含まないでください。絶対に前後に挨拶や結びの文章は含めず、本題に関する話だけを作成してください。ここで作成された台本`,
          },
          {
            role: "user",
            content: `以下の記事を基に台本を作成してください:\n\n${truncatedContent}`,
          },
        ],
        max_tokens: 6000,
        temperature: 0.5,
      });

      // 応答から要約テキストを取得
      const summaryText = response.data.choices[0]?.message?.content?.trim() || "";
      
      if (!summaryText) {
        throw new Error("要約の生成に失敗しました。APIからの応答が空です。");
      }

      return summaryText;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`要約の生成に失敗しました: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * ブックマークIDから要約を生成して保存
   * @param bookmarkId ブックマークID
   * @returns 処理結果
   */
  async generateAndSaveSummary(bookmarkId: number): Promise<ProcessResult<Summary>> {
    try {
      // ブックマーク情報の取得
      const bookmark = await this.bookmarkModel.findById(bookmarkId);
      if (!bookmark) {
        return {
          status: ProcessStatus.ERROR,
          message: `ブックマークが見つかりません: ID ${bookmarkId}`,
        };
      }

      // 既存の要約を確認
      const existingSummary = await this.summaryModel.findByBookmarkId(bookmarkId);
      if (existingSummary) {
        return {
          status: ProcessStatus.SKIPPED,
          message: `要約は既に生成されています: ブックマークID ${bookmarkId}`,
          data: existingSummary,
        };
      }

      // コンテンツの取得
      const content = await this.contentModel.findByBookmarkId(bookmarkId);
      if (!content) {
        return {
          status: ProcessStatus.ERROR,
          message: `コンテンツが見つかりません: ブックマークID ${bookmarkId}`,
        };
      }

      // 要約の生成
      const summaryText = await this.generateSummary(content.raw_content);

      // 要約の保存
      const summary: Summary = {
        bookmark_id: bookmarkId,
        summary_text: summaryText,
      };

      const summaryId = await this.summaryModel.create(summary);
      summary.id = summaryId;

      return {
        status: ProcessStatus.SUCCESS,
        message: `要約を生成して保存しました: ブックマークID ${bookmarkId}`,
        data: summary,
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          status: ProcessStatus.ERROR,
          message: `要約の生成と保存に失敗しました: ${error.message}`,
          error: error,
        };
      }
      throw error;
    }
  }

  /**
   * 未処理のコンテンツから要約を生成して保存
   * @param limit 処理する最大件数（デフォルト: 10）
   * @returns 処理結果
   */
  async processUnprocessedContents(limit = 10): Promise<ProcessResult<Summary[]>> {
    try {
      // 処理済みのブックマークIDを取得
      const processedBookmarkIds = new Set<number>();
      const summaries = await this.summaryModel.findAll();
      summaries.forEach((summary: Summary) => {
        if (summary.bookmark_id) {
          processedBookmarkIds.add(summary.bookmark_id);
        }
      });

      // コンテンツを持つブックマークを取得
      const bookmarks = await this.bookmarkModel.findAll();
      const unprocessedBookmarkIds: number[] = [];

      for (const bookmark of bookmarks) {
        if (!bookmark.id || processedBookmarkIds.has(bookmark.id)) {
          continue;
        }

        // コンテンツの確認
        const content = await this.contentModel.findByBookmarkId(bookmark.id);
        if (content) {
          unprocessedBookmarkIds.push(bookmark.id);
        }

        // 上限に達したら終了
        if (unprocessedBookmarkIds.length >= limit) {
          break;
        }
      }

      if (unprocessedBookmarkIds.length === 0) {
        return {
          status: ProcessStatus.SKIPPED,
          message: "未処理のコンテンツはありません。",
          data: [],
        };
      }

      const results: Summary[] = [];
      const errors: string[] = [];

      // 各ブックマークを処理
      for (const bookmarkId of unprocessedBookmarkIds) {
        try {
          const result = await this.generateAndSaveSummary(bookmarkId);
          
          if (result.status === ProcessStatus.SUCCESS && result.data) {
            results.push(result.data);
          } else if (result.status === ProcessStatus.ERROR) {
            const bookmark = await this.bookmarkModel.findById(bookmarkId);
            errors.push(`ブックマーク "${bookmark?.title || bookmarkId}" の処理に失敗しました: ${result.message}`);
          }
        } catch (error) {
          if (error instanceof Error) {
            const bookmark = await this.bookmarkModel.findById(bookmarkId);
            errors.push(`ブックマーク "${bookmark?.title || bookmarkId}" の処理に失敗しました: ${error.message}`);
          }
        }
      }

      // 結果の返却
      if (results.length > 0) {
        return {
          status: ProcessStatus.SUCCESS,
          data: results,
          message: `${results.length}件の要約を生成して保存しました。${errors.length > 0 ? `(${errors.length}件のエラーが発生しました)` : ""}`,
        };
      } else if (errors.length > 0) {
        return {
          status: ProcessStatus.ERROR,
          message: `要約の生成と保存に失敗しました: ${errors.join(", ")}`,
          data: [],
        };
      } else {
        return {
          status: ProcessStatus.SKIPPED,
          message: "処理する要約はありませんでした。",
          data: [],
        };
      }
    } catch (error) {
      if (error instanceof Error) {
        return {
          status: ProcessStatus.ERROR,
          message: `未処理コンテンツの処理に失敗しました: ${error.message}`,
          error: error,
          data: [],
        };
      }
      throw error;
    }
  }
}
