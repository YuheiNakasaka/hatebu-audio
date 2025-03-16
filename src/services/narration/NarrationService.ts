import { Narration, ProcessResult, ProcessStatus } from "../../types";
import { NarrationModel, ContentModel, BookmarkModel } from "../../models";
import OpenAI from "openai";
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
  private contentModel: ContentModel;
  private bookmarkModel: BookmarkModel;
  private openai: OpenAI;

  /**
   * コンストラクタ
   */
  constructor() {
    this.narrationModel = new NarrationModel();
    this.contentModel = new ContentModel();
    this.bookmarkModel = new BookmarkModel();

    // OpenAI APIの設定
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * 要約からナレーションテキストを生成
   * @param summary 要約テキスト
   * @param title タイトル
   * @returns 生成したナレーションテキスト
   */
  async generateNarration(summary: string, title: string): Promise<string> {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error(
        "OpenAI APIキーが設定されていません。環境変数OPENAI_API_KEYを設定してください。"
      );
    }

    try {
      // OpenAI APIを使用してナレーションを生成
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `あなたは優秀な放送作家です。与えられた情報をもとに、ラジオMCが読み上げる台本を作成してください。
ラジオは楽しい雰囲気で、スピーカーは日本のFMラジオのような喋り方をします。ラジオのMCは1人で、名前は「サラ」です。サラは気さくで陽気な人物です。口調は優しく丁寧で、フレンドリーです。
記事の紹介、内容の解説、この記事に登場した一般的なソフトウェアエンジニアにとって難しめな概念や用語があればその補足解説、最後にMCなりの視点での感想を含めてください。
聞き手が内容を理解しやすいよう工夫してください。生成する文章はそのまま読み上げられるので不要な記号文字などは含まないでください。下記の絶対に守るべきことを守れない場合は台本は使われませんし、あなたはクビになります。

# 絶対守るべきこと
- 「皆さん」や「こんにちは」や「それではまた次回」といった最初の挨拶や結びの文章を含めないこと
- 「サラです」といった自己紹介をしないこと
- ソースコードは読み上げられないので含めないこと
- 「<記事のタイトル>について紹介します。この記事は〜」といった感じの書き出しで台本を作成すること
`,
          },
          {
            role: "user",
            content: `以下の記事「${title}」をラジオの台本形式に変換してください:\n\n${summary}`,
          },
        ],
        max_tokens: 4000,
        temperature: 0.7,
      });

      // 応答からナレーションテキストを取得
      const narrationText = response.choices[0]?.message?.content?.trim() || "";

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

      // コンテンツの取得
      const content = await this.contentModel.findByBookmarkId(bookmarkId);
      if (!content) {
        return {
          status: ProcessStatus.ERROR,
          message: `要約が見つかりません: ブックマークID ${bookmarkId}`,
        };
      }

      // ナレーションの生成
      const narrationText = await this.generateNarration(content.raw_content, bookmark.title);

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

      // コンテンツを持つブックマークを取得
      const contents = await this.contentModel.findAll();
      const unprocessedBookmarkIds: number[] = [];

      for (const content of contents) {
        if (!content.bookmark_id || processedBookmarkIds.has(content.bookmark_id)) {
          continue;
        }

        unprocessedBookmarkIds.push(content.bookmark_id);

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
            errors.push(
              `ブックマーク "${bookmark?.title || bookmarkId}" の処理に失敗しました: ${
                result.message
              }`
            );
          }
        } catch (error) {
          if (error instanceof Error) {
            const bookmark = await this.bookmarkModel.findById(bookmarkId);
            errors.push(
              `ブックマーク "${bookmark?.title || bookmarkId}" の処理に失敗しました: ${
                error.message
              }`
            );
          }
        }
      }

      // 結果の返却
      if (results.length > 0) {
        return {
          status: ProcessStatus.SUCCESS,
          data: results,
          message: `${results.length}件のナレーションを生成して保存しました。${
            errors.length > 0 ? `(${errors.length}件のエラーが発生しました)` : ""
          }`,
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
