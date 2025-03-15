import { AudioFile, ProcessResult, ProcessStatus } from "../../types";
import { AudioFileModel, NarrationModel, BookmarkModel } from "../../models";
import { TextToSpeechClient } from "@google-cloud/text-to-speech";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import dotenv from "dotenv";

// 環境変数の読み込み
dotenv.config();

// fsのPromise版
const writeFileAsync = promisify(fs.writeFile);
const mkdirAsync = promisify(fs.mkdir);

/**
 * 音声合成サービスのインターフェース
 */
export interface TTSService {
  /**
   * ナレーションテキストから音声ファイルを生成
   * @param text ナレーションテキスト
   * @param outputPath 出力ファイルパス
   * @returns 生成した音声ファイルのパス
   */
  synthesizeSpeech(text: string, outputPath: string): Promise<string>;

  /**
   * ブックマークIDから音声ファイルを生成して保存
   * @param bookmarkId ブックマークID
   * @returns 処理結果
   */
  generateAndSaveAudioFile(bookmarkId: number): Promise<ProcessResult<AudioFile>>;

  /**
   * 未処理のナレーションから音声ファイルを生成して保存
   * @param limit 処理する最大件数（デフォルト: 10）
   * @returns 処理結果
   */
  processUnprocessedNarrations(limit?: number): Promise<ProcessResult<AudioFile[]>>;
}

/**
 * Google Cloud TTSを使用した音声合成サービスの実装クラス
 */
export class GoogleCloudTTSService implements TTSService {
  private audioFileModel: AudioFileModel;
  private narrationModel: NarrationModel;
  private bookmarkModel: BookmarkModel;
  private ttsClient: TextToSpeechClient;
  private audioOutputDir: string;

  /**
   * コンストラクタ
   */
  constructor() {
    this.audioFileModel = new AudioFileModel();
    this.narrationModel = new NarrationModel();
    this.bookmarkModel = new BookmarkModel();
    this.ttsClient = new TextToSpeechClient();
    this.audioOutputDir = process.env.AUDIO_OUTPUT_DIR || "./data/audio";

    // 音声出力ディレクトリの確認と作成
    if (!fs.existsSync(this.audioOutputDir)) {
      fs.mkdirSync(this.audioOutputDir, { recursive: true });
    }
  }

  /**
   * ナレーションテキストから音声ファイルを生成
   * @param text ナレーションテキスト
   * @param outputPath 出力ファイルパス
   * @returns 生成した音声ファイルのパス
   */
  async synthesizeSpeech(text: string, outputPath: string): Promise<string> {
    try {
      // 出力ディレクトリの確認と作成
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        await mkdirAsync(outputDir, { recursive: true });
      }

      // テキストを適切な長さに分割
      const textChunks = this.splitTextIntoChunks(text);

      // 各チャンクを音声に変換して結合
      const audioBuffers: Buffer[] = [];

      for (const chunk of textChunks) {
        // Google Cloud TTSリクエスト
        const [response] = await this.ttsClient.synthesizeSpeech({
          input: { text: chunk },
          voice: {
            languageCode: "ja-JP",
            name: "ja-JP-Chirp3-HD-Charon", // 男性声
            ssmlGender: "MALE",
          },
          audioConfig: {
            audioEncoding: "MP3",
            speakingRate: 1.2,
            pitch: 0.0,
          },
        });

        if (response.audioContent) {
          audioBuffers.push(Buffer.from(response.audioContent as Uint8Array));
        }
      }

      // 音声ファイルの保存
      const combinedAudioBuffer = Buffer.concat(audioBuffers);
      await writeFileAsync(outputPath, combinedAudioBuffer);

      return outputPath;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`音声合成に失敗しました: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * テキストを適切な長さのチャンクに分割
   * @param text 分割するテキスト
   * @param maxChunkLength 最大チャンク長（デフォルト: 5000文字）
   * @returns 分割されたテキストの配列
   */
  private splitTextIntoChunks(text: string, maxChunkLength = 5000): string[] {
    const chunks: string[] = [];
    
    // テキストが最大チャンク長より短い場合はそのまま返す
    if (text.length <= maxChunkLength) {
      return [text];
    }

    // テキストを文単位で分割
    const sentences = text.split(/(?<=[。．！？])/);
    let currentChunk = "";

    for (const sentence of sentences) {
      // 現在のチャンクに文を追加した場合の長さを確認
      if (currentChunk.length + sentence.length <= maxChunkLength) {
        currentChunk += sentence;
      } else {
        // 現在のチャンクを配列に追加し、新しいチャンクを開始
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        
        // 文が最大チャンク長より長い場合は分割
        if (sentence.length > maxChunkLength) {
          // 文字単位で分割
          let remainingSentence = sentence;
          while (remainingSentence.length > 0) {
            const chunk = remainingSentence.substring(0, maxChunkLength);
            chunks.push(chunk);
            remainingSentence = remainingSentence.substring(maxChunkLength);
          }
          currentChunk = "";
        } else {
          currentChunk = sentence;
        }
      }
    }

    // 最後のチャンクを追加
    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  /**
   * ブックマークIDから音声ファイルを生成して保存
   * @param bookmarkId ブックマークID
   * @returns 処理結果
   */
  async generateAndSaveAudioFile(bookmarkId: number): Promise<ProcessResult<AudioFile>> {
    try {
      // ブックマーク情報の取得
      const bookmark = await this.bookmarkModel.findById(bookmarkId);
      if (!bookmark) {
        return {
          status: ProcessStatus.ERROR,
          message: `ブックマークが見つかりません: ID ${bookmarkId}`,
        };
      }

      // 既存の音声ファイルを確認
      const existingAudioFile = await this.audioFileModel.findByBookmarkId(bookmarkId);
      if (existingAudioFile) {
        return {
          status: ProcessStatus.SKIPPED,
          message: `音声ファイルは既に生成されています: ブックマークID ${bookmarkId}`,
          data: existingAudioFile,
        };
      }

      // ナレーションの取得
      const narration = await this.narrationModel.findByBookmarkId(bookmarkId);
      if (!narration) {
        return {
          status: ProcessStatus.ERROR,
          message: `ナレーションが見つかりません: ブックマークID ${bookmarkId}`,
        };
      }

      // ファイル名の生成（ブックマークIDと日時を含む）
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const fileName = `bookmark_${bookmarkId}_${timestamp}.mp3`;
      const outputPath = path.join(this.audioOutputDir, fileName);

      // 音声ファイルの生成
      await this.synthesizeSpeech(narration.narration_text, outputPath);

      // 音声ファイル情報の保存
      const audioFile: AudioFile = {
        bookmark_id: bookmarkId,
        file_path: outputPath,
        // 音声の長さは現在は設定しない（将来的に実装）
      };

      const audioFileId = await this.audioFileModel.create(audioFile);
      audioFile.id = audioFileId;

      return {
        status: ProcessStatus.SUCCESS,
        message: `音声ファイルを生成して保存しました: ブックマークID ${bookmarkId}`,
        data: audioFile,
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          status: ProcessStatus.ERROR,
          message: `音声ファイルの生成と保存に失敗しました: ${error.message}`,
          error: error,
        };
      }
      throw error;
    }
  }

  /**
   * 未処理のナレーションから音声ファイルを生成して保存
   * @param limit 処理する最大件数（デフォルト: 10）
   * @returns 処理結果
   */
  async processUnprocessedNarrations(limit = 10): Promise<ProcessResult<AudioFile[]>> {
    try {
      // 処理済みのブックマークIDを取得
      const processedBookmarkIds = new Set<number>();
      const audioFiles = await this.audioFileModel.findAll();
      audioFiles.forEach((audioFile: AudioFile) => {
        if (audioFile.bookmark_id) {
          processedBookmarkIds.add(audioFile.bookmark_id);
        }
      });

      // ナレーションを持つブックマークを取得
      const narrations = await this.narrationModel.findAll();
      const unprocessedBookmarkIds: number[] = [];

      for (const narration of narrations) {
        if (!narration.bookmark_id || processedBookmarkIds.has(narration.bookmark_id)) {
          continue;
        }

        unprocessedBookmarkIds.push(narration.bookmark_id);

        // 上限に達したら終了
        if (unprocessedBookmarkIds.length >= limit) {
          break;
        }
      }

      if (unprocessedBookmarkIds.length === 0) {
        return {
          status: ProcessStatus.SKIPPED,
          message: "未処理のナレーションはありません。",
          data: [],
        };
      }

      const results: AudioFile[] = [];
      const errors: string[] = [];

      // 各ブックマークを処理
      console.log(unprocessedBookmarkIds);
      
      for (const bookmarkId of unprocessedBookmarkIds) {
        try {
          const result = await this.generateAndSaveAudioFile(bookmarkId);
          
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
          message: `${results.length}件の音声ファイルを生成して保存しました。${errors.length > 0 ? `(${errors.length}件のエラーが発生しました)` : ""}`,
        };
      } else if (errors.length > 0) {
        return {
          status: ProcessStatus.ERROR,
          message: `音声ファイルの生成と保存に失敗しました: ${errors.join(", ")}`,
          data: [],
        };
      } else {
        return {
          status: ProcessStatus.SKIPPED,
          message: "処理する音声ファイルはありませんでした。",
          data: [],
        };
      }
    } catch (error) {
      if (error instanceof Error) {
        return {
          status: ProcessStatus.ERROR,
          message: `未処理ナレーションの処理に失敗しました: ${error.message}`,
          error: error,
          data: [],
        };
      }
      throw error;
    }
  }
}
