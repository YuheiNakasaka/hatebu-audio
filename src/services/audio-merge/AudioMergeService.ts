import { MergedAudioFile, AudioFile, ProcessResult, ProcessStatus } from "../../types";
import { MergedAudioFileModel, AudioFileModel, PlaylistModel } from "../../models";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import dotenv from "dotenv";

// 環境変数の読み込み
dotenv.config();

// fsのPromise版
const existsAsync = promisify(fs.exists);
const mkdirAsync = promisify(fs.mkdir);

/**
 * 音声ファイル結合サービスのインターフェース
 */
export interface AudioMergeService {
  /**
   * 音声ファイルを結合
   * @param inputFiles 入力ファイルパスの配列
   * @param outputFile 出力ファイルパス
   * @returns 結合した音声ファイルのパス
   */
  mergeAudioFiles(inputFiles: string[], outputFile: string): Promise<string>;

  /**
   * 指定した音声ファイルIDの配列から結合音声ファイルを生成して保存
   * @param audioFileIds 音声ファイルIDの配列
   * @param name 結合音声ファイル名
   * @returns 処理結果
   */
  mergeAndSaveAudioFiles(audioFileIds: number[], name: string): Promise<ProcessResult<MergedAudioFile>>;

  /**
   * プレイリストから結合音声ファイルを生成して保存
   * @param playlistId プレイリストID
   * @param name 結合音声ファイル名（指定しない場合はプレイリスト名を使用）
   * @returns 処理結果
   */
  mergePlaylist(playlistId: number, name?: string): Promise<ProcessResult<MergedAudioFile>>;
}

/**
 * 音声ファイル結合サービスの実装クラス
 */
export class DefaultAudioMergeService implements AudioMergeService {
  private mergedAudioFileModel: MergedAudioFileModel;
  private audioFileModel: AudioFileModel;
  private playlistModel: PlaylistModel;
  private audioOutputDir: string;

  /**
   * コンストラクタ
   */
  constructor() {
    this.mergedAudioFileModel = new MergedAudioFileModel();
    this.audioFileModel = new AudioFileModel();
    this.playlistModel = new PlaylistModel();
    this.audioOutputDir = process.env.AUDIO_OUTPUT_DIR || "./data/audio";

    // 音声出力ディレクトリの確認と作成
    if (!fs.existsSync(this.audioOutputDir)) {
      fs.mkdirSync(this.audioOutputDir, { recursive: true });
    }
  }

  /**
   * 音声ファイルを結合
   * @param inputFiles 入力ファイルパスの配列
   * @param outputFile 出力ファイルパス
   * @returns 結合した音声ファイルのパス
   */
  async mergeAudioFiles(inputFiles: string[], outputFile: string): Promise<string> {
    try {
      // 入力ファイルの存在確認
      for (const file of inputFiles) {
        if (!await existsAsync(file)) {
          throw new Error(`入力ファイルが見つかりません: ${file}`);
        }
      }

      // 出力ディレクトリの確認と作成
      const outputDir = path.dirname(outputFile);
      if (!await existsAsync(outputDir)) {
        await mkdirAsync(outputDir, { recursive: true });
      }

      // FFmpegを使用して音声ファイルを結合
      return new Promise<string>((resolve, reject) => {
        const command = ffmpeg();
        
        // 入力ファイルを追加
        inputFiles.forEach(file => {
          command.input(file);
        });
        
        // 結合処理を実行
        command
          .on('error', (err) => {
            reject(new Error(`音声ファイルの結合に失敗しました: ${err.message}`));
          })
          .on('end', () => {
            resolve(outputFile);
          })
          .mergeToFile(outputFile, path.dirname(outputFile));
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`音声ファイルの結合に失敗しました: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * 指定した音声ファイルIDの配列から結合音声ファイルを生成して保存
   * @param audioFileIds 音声ファイルIDの配列
   * @param name 結合音声ファイル名
   * @returns 処理結果
   */
  async mergeAndSaveAudioFiles(audioFileIds: number[], name: string): Promise<ProcessResult<MergedAudioFile>> {
    try {
      if (audioFileIds.length === 0) {
        return {
          status: ProcessStatus.ERROR,
          message: "結合する音声ファイルが指定されていません。",
        };
      }

      // 音声ファイル情報の取得
      const audioFiles: AudioFile[] = [];
      for (const id of audioFileIds) {
        const audioFile = await this.audioFileModel.findById(id);
        if (!audioFile) {
          return {
            status: ProcessStatus.ERROR,
            message: `音声ファイルが見つかりません: ID ${id}`,
          };
        }
        audioFiles.push(audioFile);
      }

      // 入力ファイルパスの配列を作成
      const inputFiles = audioFiles.map(file => file.file_path);

      // 出力ファイル名の生成
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const fileName = `${name.replace(/[^\w\s-]/g, "_")}_${timestamp}.mp3`;
      const outputPath = path.join(this.audioOutputDir, fileName);

      // 音声ファイルの結合
      await this.mergeAudioFiles(inputFiles, outputPath);

      // 結合音声ファイル情報の保存
      const mergedAudioFile: MergedAudioFile = {
        name,
        file_path: outputPath,
        source_files: audioFileIds,
      };

      const mergedAudioFileId = await this.mergedAudioFileModel.create(mergedAudioFile);
      mergedAudioFile.id = mergedAudioFileId;

      return {
        status: ProcessStatus.SUCCESS,
        message: `音声ファイルを結合して保存しました: ${name}`,
        data: mergedAudioFile,
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          status: ProcessStatus.ERROR,
          message: `音声ファイルの結合と保存に失敗しました: ${error.message}`,
          error: error,
        };
      }
      throw error;
    }
  }

  /**
   * プレイリストから結合音声ファイルを生成して保存
   * @param playlistId プレイリストID
   * @param name 結合音声ファイル名（指定しない場合はプレイリスト名を使用）
   * @returns 処理結果
   */
  async mergePlaylist(playlistId: number, name?: string): Promise<ProcessResult<MergedAudioFile>> {
    try {
      // プレイリストの存在確認
      const playlist = await this.playlistModel.findById(playlistId);
      if (!playlist) {
        return {
          status: ProcessStatus.ERROR,
          message: `プレイリストが見つかりません: ID ${playlistId}`,
        };
      }

      // プレイリスト内の音声ファイルIDを取得
      const audioFileIds = await this.playlistModel.getAudioFileIds(playlistId);
      if (audioFileIds.length === 0) {
        return {
          status: ProcessStatus.SKIPPED,
          message: `プレイリストに音声ファイルが含まれていません: ${playlist.name}`,
        };
      }

      // 結合音声ファイル名の設定
      const mergedName = name || `プレイリスト_${playlist.name}`;

      // 音声ファイルの結合
      return this.mergeAndSaveAudioFiles(audioFileIds, mergedName);
    } catch (error) {
      if (error instanceof Error) {
        return {
          status: ProcessStatus.ERROR,
          message: `プレイリストの音声ファイル結合に失敗しました: ${error.message}`,
          error: error,
        };
      }
      throw error;
    }
  }
}
