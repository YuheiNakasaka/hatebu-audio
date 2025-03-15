import { OpenAI } from "openai";
import dotenv from "dotenv";
import { ProcessResult, ProcessStatus, Bookmark, PodcastEpisode } from "../../types";
import { BookmarkModel, MergedAudioFileModel, PodcastEpisodeModel } from "../../models";
import fs from "fs";
import { getAudioDurationInSeconds } from "get-audio-duration";

// 環境変数の読み込み
dotenv.config();

/**
 * Podcastメタデータ生成サービスクラス
 */
export class PodcastMetadataService {
  private openai: OpenAI;
  private bookmarkModel: BookmarkModel;
  private mergedAudioFileModel: MergedAudioFileModel;
  private podcastEpisodeModel: PodcastEpisodeModel;

  /**
   * コンストラクタ
   */
  constructor() {
    // OpenAI APIクライアントの初期化
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OpenAI APIキーが設定されていません。");
    }
    this.openai = new OpenAI({ apiKey });

    // モデルの初期化
    this.bookmarkModel = new BookmarkModel();
    this.mergedAudioFileModel = new MergedAudioFileModel();
    this.podcastEpisodeModel = new PodcastEpisodeModel();
  }

  /**
   * 結合音声ファイルからPodcastエピソードのメタデータを生成
   * @param mergedAudioFileId 結合音声ファイルID
   * @returns 処理結果
   */
  async generateEpisodeMetadata(
    mergedAudioFileId: number
  ): Promise<ProcessResult<PodcastEpisode>> {
    try {
      // 結合音声ファイルの取得
      const mergedAudioFile = await this.mergedAudioFileModel.findById(mergedAudioFileId);
      if (!mergedAudioFile) {
        return {
          status: ProcessStatus.ERROR,
          message: `結合音声ファイルが見つかりません: ID ${mergedAudioFileId}`,
        };
      }

      // 既存のエピソードを確認
      const existingEpisode = await this.podcastEpisodeModel.findByMergedAudioFileId(mergedAudioFileId);
      if (existingEpisode) {
        return {
          status: ProcessStatus.SKIPPED,
          message: `このファイルのエピソードは既に存在します: ID ${existingEpisode.id}`,
          data: existingEpisode,
        };
      }

      // 音声ファイルの存在確認
      if (!fs.existsSync(mergedAudioFile.file_path)) {
        return {
          status: ProcessStatus.ERROR,
          message: `音声ファイルが見つかりません: ${mergedAudioFile.file_path}`,
        };
      }

      // 音声ファイルの長さを取得
      const duration = await getAudioDurationInSeconds(mergedAudioFile.file_path);

      // 元のブックマーク情報を取得
      const sourceFiles = Array.isArray(mergedAudioFile.source_files) 
        ? mergedAudioFile.source_files 
        : JSON.parse(mergedAudioFile.source_files as unknown as string);
      
      const bookmarkIds: number[] = [];
      const bookmarks: Bookmark[] = [];

      for (const audioFileId of sourceFiles) {
        const result = await this.bookmarkModel.findByAudioFileId(audioFileId);
        if (result && result.bookmark) {
          bookmarkIds.push(result.bookmark.id as number);
          bookmarks.push(result.bookmark);
        }
      }

      // エピソード番号を取得
      const episodeNumber = await this.podcastEpisodeModel.getLatestEpisodeNumber() + 1;

      // タイトルと説明を生成
      const { title, description } = await this.generateTitleAndDescription(bookmarks, episodeNumber);

      // エピソード情報を作成
      const episode: PodcastEpisode = {
        merged_audio_file_id: mergedAudioFileId,
        title,
        description,
        source_bookmarks: bookmarkIds,
        published_at: new Date().toISOString(),
        duration: Math.round(duration),
        file_size: fs.statSync(mergedAudioFile.file_path).size,
        is_published: false,
      };

      // エピソードをデータベースに保存
      const episodeId = await this.podcastEpisodeModel.create(episode);
      episode.id = episodeId;

      return {
        status: ProcessStatus.SUCCESS,
        message: `エピソードメタデータの生成に成功しました: ${title}`,
        data: episode,
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          status: ProcessStatus.ERROR,
          message: `エピソードメタデータの生成に失敗しました: ${error.message}`,
          error,
        };
      }
      throw error;
    }
  }

  /**
   * ブックマーク情報からタイトルと説明を生成
   * @param bookmarks ブックマーク情報の配列
   * @param episodeNumber エピソード番号
   * @returns タイトルと説明
   */
  private async generateTitleAndDescription(
    bookmarks: Bookmark[],
    episodeNumber: number
  ): Promise<{ title: string; description: string }> {
    try {
      // ブックマーク情報の文字列を作成
      const bookmarkInfo = bookmarks
        .map((bookmark) => `タイトル: ${bookmark.title}\n説明: ${bookmark.description || "なし"}`)
        .join("\n\n");

      // プロンプトの作成
      const prompt = `
以下のブックマーク情報から、Podcastエピソードのタイトルと説明文を生成してください。
タイトルは簡潔で魅力的なものにし、説明文はエピソードの内容を要約したものにしてください。

タイトル形式: 「Yuhei Nakasakaのはてなブックマークラジオ #${episodeNumber}: [タイトル]」

ブックマーク情報:
${bookmarkInfo}

以下の形式で回答してください：
タイトル: [生成されたタイトル]
説明: [生成された説明文]
`;

      // OpenAI APIを使用してタイトルと説明を生成
      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 500,
      });

      // レスポンスからタイトルと説明を抽出
      const content = response.choices[0]?.message?.content || "";
      const titleMatch = content.match(/タイトル: (.+)/);
      const descriptionMatch = content.match(/説明: ([\s\S]+)/);

      const title = titleMatch
        ? titleMatch[1]
        : `#${episodeNumber}: ${bookmarks[0]?.title || "新着ブックマーク"}`;
      const description = descriptionMatch
        ? descriptionMatch[1]
        : `このエピソードでは、${bookmarks.length}件のブックマークを紹介します。`;

      return { title, description };
    } catch (error) {
      console.error("タイトルと説明の生成に失敗しました:", error);
      // エラー時のデフォルト値
      return {
        title: `#${episodeNumber}: ${bookmarks[0]?.title || "新着ブックマーク"}`,
        description: `このエピソードでは、${bookmarks.length}件のブックマークを紹介します。`,
      };
    }
  }
}
