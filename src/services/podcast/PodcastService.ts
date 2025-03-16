import { ProcessResult, ProcessStatus, PodcastEpisode, PodcastSettings } from "../../types";
import { PodcastEpisodeModel, PodcastSettingsModel, MergedAudioFileModel } from "../../models";
import { CloudflareR2UploadService } from "./upload";
import { PodcastMetadataService } from "./metadata";
import { PodcastFeedService } from "./feed";
import { CloudflarePagesDeployService } from "./deploy";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { execSync } from "child_process";
import { BookmarkModel } from "../../models";

// 環境変数の読み込み
dotenv.config();

/**
 * Podcastサービスクラス
 */
export class PodcastService {
  private podcastEpisodeModel: PodcastEpisodeModel;
  private podcastSettingsModel: PodcastSettingsModel;
  private mergedAudioFileModel: MergedAudioFileModel;
  private uploadService: CloudflareR2UploadService;
  private metadataService: PodcastMetadataService;
  private feedService: PodcastFeedService;
  private deployService: CloudflarePagesDeployService;

  /**
   * コンストラクタ
   */
  constructor() {
    this.podcastEpisodeModel = new PodcastEpisodeModel();
    this.podcastSettingsModel = new PodcastSettingsModel();
    this.mergedAudioFileModel = new MergedAudioFileModel();
    this.uploadService = new CloudflareR2UploadService();
    this.metadataService = new PodcastMetadataService();
    this.feedService = new PodcastFeedService();
    this.deployService = new CloudflarePagesDeployService();
  }

  /**
   * Podcast設定を更新
   * @param settings 更新する設定情報
   * @returns 処理結果
   */
  async updateSettings(
    settings: Partial<PodcastSettings>
  ): Promise<ProcessResult<PodcastSettings>> {
    try {
      const success = await this.podcastSettingsModel.updateSettings(settings);
      if (!success) {
        return {
          status: ProcessStatus.ERROR,
          message: "Podcast設定の更新に失敗しました。",
        };
      }

      const updatedSettings = await this.podcastSettingsModel.getSettings();
      if (!updatedSettings) {
        return {
          status: ProcessStatus.ERROR,
          message: "更新後のPodcast設定の取得に失敗しました。",
        };
      }

      return {
        status: ProcessStatus.SUCCESS,
        message: "Podcast設定を更新しました。",
        data: updatedSettings,
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          status: ProcessStatus.ERROR,
          message: `Podcast設定の更新に失敗しました: ${error.message}`,
          error,
        };
      }
      throw error;
    }
  }

  /**
   * エピソードを公開
   * @param mergedAudioFileId 結合音声ファイルID
   * @param options オプション（タイトルと説明を手動で指定する場合）
   * @returns 処理結果
   */
  async publishEpisode(
    mergedAudioFileId: number,
    options?: { title?: string; description?: string; autoMetadata?: boolean }
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

      // 音声ファイルの存在確認
      if (!fs.existsSync(mergedAudioFile.file_path)) {
        return {
          status: ProcessStatus.ERROR,
          message: `音声ファイルが見つかりません: ${mergedAudioFile.file_path}`,
        };
      }

      // 既存のエピソードを確認
      let episode = await this.podcastEpisodeModel.findByMergedAudioFileId(mergedAudioFileId);

      // エピソードが存在しない場合は作成
      if (!episode) {
        if (options?.autoMetadata) {
          // メタデータを自動生成
          const metadataResult =
            await this.metadataService.generateEpisodeMetadata(mergedAudioFileId);
          if (metadataResult.status !== ProcessStatus.SUCCESS || !metadataResult.data) {
            return {
              status: ProcessStatus.ERROR,
              message: `エピソードメタデータの生成に失敗しました: ${metadataResult.message}`,
            };
          }
          episode = metadataResult.data;
        } else {
          // エピソード番号を取得
          const episodeNumber = (await this.podcastEpisodeModel.getLatestEpisodeNumber()) + 1;

          // エピソード情報を作成
          const newEpisode: PodcastEpisode = {
            merged_audio_file_id: mergedAudioFileId,
            title: options?.title || `エピソード #${episodeNumber}: ${mergedAudioFile.name}`,
            description: options?.description || `エピソード #${episodeNumber}`,
            published_at: new Date().toISOString(),
            is_published: false,
          };

          // エピソードをデータベースに保存
          const episodeId = await this.podcastEpisodeModel.create(newEpisode);
          newEpisode.id = episodeId;
          episode = newEpisode;
        }
      }

      // エピソード番号を取得
      const episodeNumber = episode.id || (await this.podcastEpisodeModel.getLatestEpisodeNumber());

      // 音声ファイルをアップロード
      const uploadResult = await this.uploadService.uploadAudioFile(
        mergedAudioFile.file_path,
        episodeNumber
      );
      if (uploadResult.status !== ProcessStatus.SUCCESS || !uploadResult.data) {
        return {
          status: ProcessStatus.ERROR,
          message: `音声ファイルのアップロードに失敗しました: ${uploadResult.message}`,
        };
      }

      // エピソード情報を更新
      await this.podcastEpisodeModel.update(episode.id as number, {
        storage_url: uploadResult.data.url,
        file_size: uploadResult.data.size,
        is_published: true,
      });

      // 更新されたエピソード情報を取得
      const updatedEpisode = await this.podcastEpisodeModel.findById(episode.id as number);
      if (!updatedEpisode) {
        return {
          status: ProcessStatus.ERROR,
          message: `更新後のエピソード情報の取得に失敗しました: ID ${episode.id}`,
        };
      }

      // RSSフィードを生成
      const feedResult = await this.feedService.generateFeed();
      if (feedResult.status !== ProcessStatus.SUCCESS || !feedResult.data) {
        return {
          status: ProcessStatus.ERROR,
          message: `RSSフィードの生成に失敗しました: ${feedResult.message}`,
        };
      }

      // RSSフィードをデプロイ
      const deployResult = await this.deployService.deployFeed(feedResult.data);
      if (deployResult.status !== ProcessStatus.SUCCESS) {
        return {
          status: ProcessStatus.ERROR,
          message: `RSSフィードのデプロイに失敗しました: ${deployResult.message}`,
        };
      }

      // Podcast設定を更新（フィードURLが設定されていない場合）
      const settings = await this.podcastSettingsModel.getSettings();
      if (settings && !settings.feed_url && deployResult.data) {
        await this.podcastSettingsModel.updateSettings({
          feed_url: deployResult.data,
        });
      }

      return {
        status: ProcessStatus.SUCCESS,
        message: `エピソードを公開しました: ${updatedEpisode.title}`,
        data: updatedEpisode,
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          status: ProcessStatus.ERROR,
          message: `エピソードの公開に失敗しました: ${error.message}`,
          error,
        };
      }
      throw error;
    }
  }

  /**
   * RSSフィードを生成してデプロイ
   * @returns 処理結果
   */
  async generateAndDeployFeed(): Promise<ProcessResult<string>> {
    try {
      // RSSフィードを生成
      const feedResult = await this.feedService.generateFeed();
      if (feedResult.status !== ProcessStatus.SUCCESS || !feedResult.data) {
        return {
          status: ProcessStatus.ERROR,
          message: `RSSフィードの生成に失敗しました: ${feedResult.message}`,
        };
      }

      // RSSフィードをデプロイ
      const deployResult = await this.deployService.deployFeed(feedResult.data);
      if (deployResult.status !== ProcessStatus.SUCCESS || !deployResult.data) {
        return {
          status: ProcessStatus.ERROR,
          message: `RSSフィードのデプロイに失敗しました: ${deployResult.message}`,
        };
      }

      // Podcast設定を更新（フィードURLが設定されていない場合）
      const settings = await this.podcastSettingsModel.getSettings();
      if (settings && !settings.feed_url) {
        await this.podcastSettingsModel.updateSettings({
          feed_url: deployResult.data,
        });
      }

      return {
        status: ProcessStatus.SUCCESS,
        message: `RSSフィードを生成してデプロイしました: ${deployResult.data}`,
        data: deployResult.data,
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          status: ProcessStatus.ERROR,
          message: `RSSフィードの生成とデプロイに失敗しました: ${error.message}`,
          error,
        };
      }
      throw error;
    }
  }

  /**
   * Webサイトをビルド
   * @returns 処理結果
   */
  async buildWebsite(): Promise<ProcessResult<string>> {
    try {
      const websiteDir = path.join(process.cwd(), "src", "website");
      const outputDir = path.join(process.cwd(), "dist", "website");

      // 出力ディレクトリが存在しない場合は作成
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Next.jsのビルドコマンドを実行
      const command = `cd ${websiteDir} && npx next build`;
      execSync(command, { stdio: "inherit" });

      // ビルド結果のoutディレクトリをdist/websiteディレクトリにコピー
      const outDir = path.join(websiteDir, "out");
      if (!fs.existsSync(outDir)) {
        return {
          status: ProcessStatus.ERROR,
          message: "Webサイトのビルドに失敗しました。outディレクトリが見つかりません。",
        };
      }

      // dist/websiteディレクトリの中身を空にする
      const files = fs.readdirSync(outputDir);
      for (const file of files) {
        const filePath = path.join(outputDir, file);
        if (fs.lstatSync(filePath).isDirectory()) {
          fs.rmSync(filePath, { recursive: true });
        } else {
          fs.unlinkSync(filePath);
        }
      }

      // outディレクトリの中身をdist/websiteディレクトリにコピー
      const outFiles = fs.readdirSync(outDir);
      for (const file of outFiles) {
        const srcPath = path.join(outDir, file);
        const destPath = path.join(outputDir, file);
        if (fs.lstatSync(srcPath).isDirectory()) {
          fs.cpSync(srcPath, destPath, { recursive: true });
        } else {
          fs.copyFileSync(srcPath, destPath);
        }
      }

      return {
        status: ProcessStatus.SUCCESS,
        message: "Webサイトのビルドに成功しました",
        data: outputDir,
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          status: ProcessStatus.ERROR,
          message: `Webサイトのビルドに失敗しました: ${error.message}`,
          error,
        };
      }
      throw error;
    }
  }

  /**
   * エピソードの情報を取得
   * @param episodeId エピソードID
   * @returns 処理結果
   */
  async getEpisodeById(episodeId: number): Promise<ProcessResult<PodcastEpisode>> {
    try {
      const episode = await this.podcastEpisodeModel.findById(episodeId);
      if (!episode) {
        return {
          status: ProcessStatus.ERROR,
          message: `エピソードが見つかりません: ID ${episodeId}`,
        };
      }

      return {
        status: ProcessStatus.SUCCESS,
        message: `エピソード情報を取得しました: ${episode.title}`,
        data: episode,
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          status: ProcessStatus.ERROR,
          message: `エピソード情報の取得に失敗しました: ${error.message}`,
          error,
        };
      }
      throw error;
    }
  }

  /**
   * エピソードメタデータを更新
   * @param episodeId エピソードID
   * @returns 処理結果
   */
  async updateEpisodeMetadata(episodeId: number): Promise<ProcessResult<PodcastEpisode>> {
    try {
      // エピソードの取得
      const episode = await this.podcastEpisodeModel.findById(episodeId);
      if (!episode) {
        return {
          status: ProcessStatus.ERROR,
          message: `エピソードが見つかりません: ID ${episodeId}`,
        };
      }

      // source_bookmarksからブックマーク情報を取得
      if (!episode.source_bookmarks || episode.source_bookmarks.length === 0) {
        return {
          status: ProcessStatus.ERROR,
          message: `エピソードにブックマーク情報がありません: ID ${episodeId}`,
        };
      }

      const bookmarkModel = new BookmarkModel();
      const bookmarks = [];

      for (const bookmarkId of episode.source_bookmarks) {
        const bookmark = await bookmarkModel.findById(bookmarkId);
        if (bookmark) {
          bookmarks.push(bookmark);
        }
      }

      if (bookmarks.length === 0) {
        return {
          status: ProcessStatus.ERROR,
          message: `エピソードに関連するブックマークが見つかりません: ID ${episodeId}`,
        };
      }

      // タイトルと説明を生成
      const episodeNumber = episode.id || (await this.podcastEpisodeModel.getLatestEpisodeNumber());
      const { title, description } = await this.metadataService.generateTitleAndDescription(
        bookmarks,
        episodeNumber
      );

      // エピソード情報を更新
      await this.podcastEpisodeModel.update(episodeId, {
        title,
        description,
      });

      // 更新されたエピソード情報を取得
      const updatedEpisode = await this.podcastEpisodeModel.findById(episodeId);
      if (!updatedEpisode) {
        return {
          status: ProcessStatus.ERROR,
          message: `更新後のエピソード情報の取得に失敗しました: ID ${episodeId}`,
        };
      }

      return {
        status: ProcessStatus.SUCCESS,
        message: `エピソードメタデータを更新しました: ${updatedEpisode.title}`,
        data: updatedEpisode,
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          status: ProcessStatus.ERROR,
          message: `エピソードメタデータの更新に失敗しました: ${error.message}`,
          error,
        };
      }
      throw error;
    }
  }

  /**
   * Webサイトをデプロイ
   * @returns 処理結果
   */
  async deployWebsite(): Promise<ProcessResult<string>> {
    try {
      // Webサイトをデプロイ
      const deployResult = await this.deployService.deployWebsite();
      if (deployResult.status !== ProcessStatus.SUCCESS || !deployResult.data) {
        return {
          status: ProcessStatus.ERROR,
          message: `Webサイトのデプロイに失敗しました: ${deployResult.message}`,
        };
      }

      // Podcast設定を更新（WebサイトURLが設定されていない場合）
      const settings = await this.podcastSettingsModel.getSettings();
      if (settings && !settings.website_url) {
        await this.podcastSettingsModel.updateSettings({
          website_url: deployResult.data,
        });
      }

      return {
        status: ProcessStatus.SUCCESS,
        message: `Webサイトをデプロイしました: ${deployResult.data}`,
        data: deployResult.data,
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          status: ProcessStatus.ERROR,
          message: `Webサイトのデプロイに失敗しました: ${error.message}`,
          error,
        };
      }
      throw error;
    }
  }
}
