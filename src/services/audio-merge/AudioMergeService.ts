import { MergedAudioFile, AudioFile, ProcessResult, ProcessStatus } from "../../types";
import { MergedAudioFileModel, AudioFileModel } from "../../models";
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
   * 音声ファイルを結合（ファイル間に無音を挿入）
   * @param inputFiles 入力ファイルパスの配列
   * @param outputFile 出力ファイルパス
   * @param silenceDuration ファイル間の無音の長さ（秒）
   * @returns 結合した音声ファイルのパス
   */
  mergeAudioFiles(
    inputFiles: string[],
    outputFile: string,
    silenceDuration?: number
  ): Promise<string>;

  /**
   * 音声ファイルを結合（挨拶と結びを追加）
   * @param inputFiles 入力ファイルパスの配列
   * @param outputFile 出力ファイルパス
   * @param introFile 挨拶音声ファイルパス
   * @param outroFile 結び音声ファイルパス
   * @param silenceDuration ファイル間の無音の長さ（秒）
   * @returns 結合した音声ファイルのパス
   */
  mergeAudioFilesWithIntro(
    inputFiles: string[],
    outputFile: string,
    introFile: string,
    outroFile: string,
    silenceDuration?: number
  ): Promise<string>;

  /**
   * 指定した音声ファイルIDの配列から結合音声ファイルを生成して保存
   * @param audioFileIds 音声ファイルIDの配列
   * @param name 結合音声ファイル名
   * @returns 処理結果
   */
  mergeAndSaveAudioFiles(
    audioFileIds: number[],
    name: string
  ): Promise<ProcessResult<MergedAudioFile>>;

  /**
   * 未処理の音声ファイル（まだマージされていない音声ファイル）を自動でマージする
   * @param name 結合音声ファイル名（指定しない場合は自動生成）
   * @returns 処理結果
   */
  mergeUnprocessedAudioFiles(name?: string): Promise<ProcessResult<MergedAudioFile>>;

  /**
   * 未処理の音声ファイルを結合（挨拶と結びを追加）
   * @param name 結合音声ファイル名（指定しない場合は自動生成）
   * @returns 処理結果
   */
  mergeUnprocessedAudioFilesWithIntro(name?: string): Promise<ProcessResult<MergedAudioFile>>;
}

/**
 * 音声ファイル結合サービスの実装クラス
 */
export class DefaultAudioMergeService implements AudioMergeService {
  private mergedAudioFileModel: MergedAudioFileModel;
  private audioFileModel: AudioFileModel;
  private audioOutputDir: string;

  /**
   * コンストラクタ
   */
  constructor() {
    this.mergedAudioFileModel = new MergedAudioFileModel();
    this.audioFileModel = new AudioFileModel();
    this.audioOutputDir = process.env.AUDIO_OUTPUT_DIR || "./data/audio";

    // 音声出力ディレクトリの確認と作成
    if (!fs.existsSync(this.audioOutputDir)) {
      fs.mkdirSync(this.audioOutputDir, { recursive: true });
    }
  }

  /**
   * 音声ファイルを結合（挨拶と結びを追加）
   * @param inputFiles 入力ファイルパスの配列
   * @param outputFile 出力ファイルパス
   * @param introFile 挨拶音声ファイルパス
   * @param outroFile 結び音声ファイルパス
   * @param silenceDuration ファイル間の無音の長さ（秒）
   * @returns 結合した音声ファイルのパス
   */
  async mergeAudioFilesWithIntro(
    inputFiles: string[],
    outputFile: string,
    introFile: string,
    outroFile: string,
    silenceDuration: number = 2.5
  ): Promise<string> {
    // 挨拶ファイルと結びファイルを含めた配列を作成
    const allFiles = [introFile, ...inputFiles, outroFile];

    // 既存のmergeAudioFilesメソッドを使用して結合
    return this.mergeAudioFiles(allFiles, outputFile, silenceDuration);
  }

  /**
   * 未処理の音声ファイルを結合（挨拶と結びを追加）
   * @param name 結合音声ファイル名（指定しない場合は自動生成）
   * @returns 処理結果
   */
  async mergeUnprocessedAudioFilesWithIntro(
    name?: string
  ): Promise<ProcessResult<MergedAudioFile>> {
    try {
      // 挨拶と結びの音声ファイルパス
      const introFilePath = path.join(this.audioOutputDir, "radio_intro.mp3");
      const outroFilePath = path.join(this.audioOutputDir, "radio_outro.mp3");

      // 挨拶と結びの音声ファイルが存在するか確認
      if (!fs.existsSync(introFilePath) || !fs.existsSync(outroFilePath)) {
        return {
          status: ProcessStatus.ERROR,
          message: "挨拶または結びの音声ファイルが見つかりません。",
        };
      }

      // 既存の結合音声ファイル情報を取得
      const mergedAudioFiles = await this.mergedAudioFileModel.findAll(100000, 0);

      // 既に結合済みの音声ファイルIDのセットを作成
      const mergedAudioFileIds = new Set<number>();
      mergedAudioFiles.forEach((mergedFile) => {
        if (Array.isArray(mergedFile.source_files)) {
          mergedFile.source_files.forEach((id) => mergedAudioFileIds.add(id));
        }
      });

      // 全ての音声ファイルを取得
      const allAudioFiles = await this.audioFileModel.findAll(100000, 0);

      // 未処理の音声ファイルIDを抽出
      const unprocessedAudioFileIds = allAudioFiles
        .filter((file) => file.id !== undefined && !mergedAudioFileIds.has(file.id))
        .map((file) => file.id as number);

      if (unprocessedAudioFileIds.length === 0) {
        return {
          status: ProcessStatus.SKIPPED,
          message: "未処理の音声ファイルが見つかりませんでした。",
        };
      }

      // 音声ファイル情報の取得
      const audioFiles: AudioFile[] = [];
      for (const id of unprocessedAudioFileIds) {
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
      const inputFiles = audioFiles
        .sort((a, b) => (a.id as number) - (b.id as number))
        .map((file) => file.file_path);

      // 出力ファイル名の生成
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const fileName = `${(name || `自動生成_${new Date().toISOString().slice(0, 10)}`).replace(
        /[^\w\s-]/g,
        "_"
      )}_${timestamp}.mp3`;
      const outputPath = path.join(this.audioOutputDir, fileName);

      // 音声ファイルの結合（挨拶と結びを追加）
      await this.mergeAudioFilesWithIntro(inputFiles, outputPath, introFilePath, outroFilePath);

      // 結合音声ファイル情報の保存
      const mergedAudioFile: MergedAudioFile = {
        name: name || `自動生成_${new Date().toISOString().slice(0, 10)}`,
        file_path: outputPath,
        source_files: unprocessedAudioFileIds,
      };

      const mergedAudioFileId = await this.mergedAudioFileModel.create(mergedAudioFile);
      mergedAudioFile.id = mergedAudioFileId;

      return {
        status: ProcessStatus.SUCCESS,
        message: `音声ファイルを結合して保存しました（挨拶と結びを追加）: ${mergedAudioFile.name}`,
        data: mergedAudioFile,
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          status: ProcessStatus.ERROR,
          message: `未処理の音声ファイルの結合に失敗しました: ${error.message}`,
          error: error,
        };
      }
      throw error;
    }
  }

  /**
   * 音声ファイルを結合（ファイル間に無音を挿入）
   * @param inputFiles 入力ファイルパスの配列
   * @param outputFile 出力ファイルパス
   * @param silenceDuration ファイル間の無音の長さ（秒）
   * @returns 結合した音声ファイルのパス
   */
  async mergeAudioFiles(
    inputFiles: string[],
    outputFile: string,
    silenceDuration: number = 1.3
  ): Promise<string> {
    try {
      // 入力ファイルの存在確認
      for (const file of inputFiles) {
        if (!(await existsAsync(file))) {
          throw new Error(`入力ファイルが見つかりません: ${file}`);
        }
      }

      // 出力ディレクトリの確認と作成
      const outputDir = path.dirname(outputFile);
      if (!(await existsAsync(outputDir))) {
        await mkdirAsync(outputDir, { recursive: true });
      }

      // FFmpegを使用して音声ファイルを結合
      return new Promise<string>((resolve, reject) => {
        const command = ffmpeg();

        // 入力ファイルを追加
        inputFiles.forEach((file) => {
          command.input(file);
        });

        // ファイル間に無音を挿入するフィルターを構築
        if (inputFiles.length > 1) {
          const filterComplex = inputFiles
            .map((_, index) => {
              // 最後のファイル以外に対して処理
              if (index < inputFiles.length - 1) {
                return `[${index}]apad=pad_dur=${silenceDuration}[s${index}];`;
              }
              return `[${index}]apad=pad_dur=0[s${index}];`;
            })
            .join("");

          // 全てのストリームを連結
          const concatParts = inputFiles.map((_, index) => `[s${index}]`).join("");
          const filterComplexFull = `${filterComplex}${concatParts}concat=n=${inputFiles.length}:v=0:a=1[out]`;

          command.complexFilter(filterComplexFull, "out");
        }

        // 結合処理を実行
        command
          .on("error", (err) => {
            reject(new Error(`音声ファイルの結合に失敗しました: ${err.message}`));
          })
          .on("end", () => {
            resolve(outputFile);
          })
          .save(outputFile);
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
  async mergeAndSaveAudioFiles(
    audioFileIds: number[],
    name: string
  ): Promise<ProcessResult<MergedAudioFile>> {
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
      const inputFiles = audioFiles.map((file) => file.file_path);

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
   * 未処理の音声ファイル（まだマージされていない音声ファイル）を自動でマージする
   * @param name 結合音声ファイル名（指定しない場合は自動生成）
   * @returns 処理結果
   */
  async mergeUnprocessedAudioFiles(name?: string): Promise<ProcessResult<MergedAudioFile>> {
    try {
      // 既存の結合音声ファイル情報を取得
      const mergedAudioFiles = await this.mergedAudioFileModel.findAll(1000, 0);

      // 既に結合済みの音声ファイルIDのセットを作成
      const mergedAudioFileIds = new Set<number>();
      mergedAudioFiles.forEach((mergedFile) => {
        if (Array.isArray(mergedFile.source_files)) {
          mergedFile.source_files.forEach((id) => mergedAudioFileIds.add(id));
        }
      });

      // 全ての音声ファイルを取得
      const allAudioFiles = await this.audioFileModel.findAll(1000, 0);

      // 未処理の音声ファイルIDを抽出
      const unprocessedAudioFileIds = allAudioFiles
        .filter((file) => file.id !== undefined && !mergedAudioFileIds.has(file.id))
        .map((file) => file.id as number);

      if (unprocessedAudioFileIds.length === 0) {
        return {
          status: ProcessStatus.SKIPPED,
          message: "未処理の音声ファイルが見つかりませんでした。",
        };
      }

      // 結合音声ファイル名の設定
      const timestamp = new Date().toISOString().slice(0, 10);
      const mergedName = name || `自動生成_${timestamp}`;

      // 音声ファイルの結合
      return this.mergeAndSaveAudioFiles(unprocessedAudioFileIds, mergedName);
    } catch (error) {
      if (error instanceof Error) {
        return {
          status: ProcessStatus.ERROR,
          message: `未処理の音声ファイルの結合に失敗しました: ${error.message}`,
          error: error,
        };
      }
      throw error;
    }
  }
}
