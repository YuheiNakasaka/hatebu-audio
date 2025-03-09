import { Narration, Summary, ProcessResult, ProcessStatus } from "../../types";
import { NarrationModel, SummaryModel, BookmarkModel } from "../../models";
import { Configuration, OpenAIApi } from "openai";
import dotenv from "dotenv";

// 環境変数の読み込み
dotenv.config();

/**
 * ナレーション生成サービスのインターフェース
 */
export interface NarrationService {
  /**
   * 要約からナレーションテキストを生成
   * @param summary 要約テキスト
   * @param title タイトル
   * @returns 生成したナレーションテキスト
   */
  generateNarration(summary: string, title: string): Promise<string>;

  /**
   * ブックマークIDからナレーションを生成して保存
   * @param bookmarkId ブックマークID
   * @returns 処理結果
   */
  generateAndSaveNarration(bookmarkId: number): Promise<ProcessResult<Narration>>;

  /**
   * 未処理の要約からナレーションを生成して保存
   * @param limit 処理する最大件数（デフォルト: 10）
   * @returns 処理結果
   */
  processUnprocessedSummaries(limit?: number): Promise<ProcessResult<Narration[]>>;
}

/**
 * OpenAI APIを使用したナレーション生成サービスの実装クラス
 */
export class OpenAINarrationService implements NarrationService {
  private narrationModel: NarrationModel;
  private summaryModel: SummaryModel;
  private bookmarkModel: BookmarkModel;
  private openai: OpenAIApi;

  /**
   * コンストラクタ
   */
  constructor() {
    this.narrationModel = new NarrationModel();
    this.summaryModel = new SummaryModel();
    this.bookmarkModel = new BookmarkModel();

    // OpenAI APIの設定
    const configuration = new Configuration({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.openai = new OpenAIApi(configuration);
  }

  /**
   * 要約からナレーションテキストを生成
   * @param summary 要約テキスト
   * @param title タイトル
   * @returns 生成したナレーションテキスト
   */
  async generateNarration(summary: string, title: string): Promise<string> {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI APIキーが設定されていません。環境変数OPENAI_API_KEYを設定してください。");
    }

    try {
      // OpenAI APIを使用してナレーションを生成
      const response = await this.openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "あなたは優秀なポッドキャストのナレーターです。与えられた要約を、1人のナレーターによるポッドキャスト形式に変換してください。記事の紹介、内容の解説、最後に簡潔なコメントを含めてください。カジュアルで親しみやすい口調を使用し、聞き手が内容を理解しやすいよう工夫してください。",
          },
          {
            role: "user",
            content: `以下の記事「${title}」の要約をポッドキャスト形式に変換してください:\n\n${summary}`,
          },
        ],
        max_tokens: 1500,
        temperature: 0.7,
      });

      // 応答からナレーションテキストを取得
      const narrationText = response.data.choices[0]?.message?.content?.trim() || "";
      
      if (!narrationText) {
        throw new Error("ナレーションの生成に失敗しました。APIからの応答が空です。");
      }

      return narrationText;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`ナレーションの生成に失敗しました: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * ブックマークIDからナレーションを生成して保存
   * @param bookmarkId ブックマークID
   * @returns 処理結果
   */
  async generateAndSaveNarration(bookmarkId: number): Promise<ProcessResult<Narration>> {
    try {
      // ブックマーク情報の取得
      const bookmark = await this.bookmarkModel.findById(bookmarkId);
      if (!bookmark) {
        return {
          status: ProcessStatus.ERROR,
          message: `ブックマークが見つかりません: ID ${bookmarkId}`,
        };
      }

      // 既存のナレーションを確認
      const existingNarration = await this.narrationModel.findByBookmarkId(bookmarkId);
      if (existingNarration) {
        return {
          status: ProcessStatus.SKIPPED,
          message: `ナレーションは既に生成されています: ブックマークID ${bookmarkId}`,
          data: existingNarration,
        };
      }

      // 要約の取得
      const summary = await this.summaryModel.findByBookmarkId(bookmarkId);
      if (!summary) {
        return {
          status: ProcessStatus.ERROR,
          message: `要約が見つかりません: ブックマークID ${bookmarkId}`,
        };
      }

      // ナレーションの生成
      const narrationText = await this.generateNarration(summary.summary_text, bookmark.title);

      // ナレーションの保存
      const narration: Narration = {
        bookmark_id: bookmarkId,
        narration_text: narrationText,
      };

      const narrationId = await this.narrationModel.create(narration);
      narration.id = narrationId;

      return {
        status: ProcessStatus.SUCCESS,
        message: `ナレーションを生成して保存しました: ブックマークID ${bookmarkId}`,
        data: narration,
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          status: ProcessStatus.ERROR,
          message: `ナレーションの生成と保存に失敗しました: ${error.message}`,
          error: error,
        };
      }
      throw error;
    }
  }

  /**
   * 未処理の要約からナレーションを生成して保存
   * @param limit 処理する最大件数（デフォルト: 10）
   * @returns 処理結果
   */
  async processUnprocessedSummaries(limit = 10): Promise<ProcessResult<Narration[]>> {
    try {
      // 処理済みのブックマークIDを取得
      const processedBookmarkIds = new Set<number>();
      const narrations = await this.narrationModel.findAll();
      narrations.forEach((narration: Narration) => {
        if (narration.bookmark_id) {
          processedBookmarkIds.add(narration.bookmark_id);
        }
      });

      // 要約を持つブックマークを取得
      const summaries = await this.summaryModel.findAll();
      const unprocessedBookmarkIds: number[] = [];

      for (const summary of summaries) {
        if (!summary.bookmark_id || processedBookmarkIds.has(summary.bookmark_id)) {
          continue;
        }

        unprocessedBookmarkIds.push(summary.bookmark_id);

        // 上限に達したら終了
        if (unprocessedBookmarkIds.length >= limit) {
          break;
        }
      }

      if (unprocessedBookmarkIds.length === 0) {
        return {
          status: ProcessStatus.SKIPPED,
          message: "未処理の要約はありません。",
          data: [],
        };
      }

      const results: Narration[] = [];
      const errors: string[] = [];

      // 各ブックマークを処理
      for (const bookmarkId of unprocessedBookmarkIds) {
        try {
          const result = await this.generateAndSaveNarration(bookmarkId);
          
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
          message: `${results.length}件のナレーションを生成して保存しました。${errors.length > 0 ? `(${errors.length}件のエラーが発生しました)` : ""}`,
        };
      } else if (errors.length > 0) {
        return {
          status: ProcessStatus.ERROR,
          message: `ナレーションの生成と保存に失敗しました: ${errors.join(", ")}`,
          data: [],
        };
      } else {
        return {
          status: ProcessStatus.SKIPPED,
          message: "処理するナレーションはありませんでした。",
          data: [],
        };
      }
    } catch (error) {
      if (error instanceof Error) {
        return {
          status: ProcessStatus.ERROR,
          message: `未処理要約の処理に失敗しました: ${error.message}`,
          error: error,
          data: [],
        };
      }
      throw error;
    }
  }
}
