import { Podcast } from "podcast";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { ProcessResult, ProcessStatus, PodcastEpisode, PodcastSettings } from "../../types";
import { PodcastEpisodeModel, PodcastSettingsModel } from "../../models";

// 環境変数の読み込み
dotenv.config();

/**
 * Podcast RSSフィード生成サービスクラス
 */
export class PodcastFeedService {
  private podcastEpisodeModel: PodcastEpisodeModel;
  private podcastSettingsModel: PodcastSettingsModel;
  private outputDir: string;

  /**
   * コンストラクタ
   */
  constructor() {
    this.podcastEpisodeModel = new PodcastEpisodeModel();
    this.podcastSettingsModel = new PodcastSettingsModel();
    this.outputDir = path.join(process.cwd(), "data", "podcast");

    // 出力ディレクトリの確認と作成
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * RSSフィードを生成
   * @returns 処理結果
   */
  async generateFeed(): Promise<ProcessResult<string>> {
    try {
      // Podcast設定を取得
      const settings = await this.podcastSettingsModel.getSettings();
      if (!settings) {
        return {
          status: ProcessStatus.ERROR,
          message: "Podcast設定が見つかりません。",
        };
      }

      // 公開済みエピソードを取得
      const episodes = await this.podcastEpisodeModel.findAll(100, 0, true);
      if (episodes.length === 0) {
        return {
          status: ProcessStatus.SKIPPED,
          message: "公開済みエピソードが見つかりません。",
        };
      }

      // フィードの設定
      const feedOptions = {
        title: settings.title,
        description: settings.description || "",
        feed_url: settings.feed_url || process.env.PODCAST_FEED_URL || "",
        site_url: settings.website_url || process.env.PODCAST_WEBSITE_URL || "",
        image_url: settings.image_url || "",
        author: settings.author || "",
        language: settings.language || "ja",
        categories: [settings.category || "Technology"],
        pubDate: new Date(),
        itunesAuthor: settings.author || "",
        itunesSummary: settings.description || "",
        itunesOwner: {
          name: settings.author || "",
          email: settings.email || "",
        },
        itunesExplicit: settings.explicit || false,
        itunesCategory: [
          {
            text: settings.category || "Technology",
          },
        ],
        itunesImage: settings.image_url || "",
      };

      // フィードの作成
      const feed = new Podcast(feedOptions);

      // エピソードの追加
      for (const episode of episodes) {
        if (!episode.storage_url) {
          console.warn(`エピソード ${episode.id} にストレージURLがありません。スキップします。`);
          continue;
        }

        feed.addItem({
          title: episode.title,
          description: episode.description || "",
          url: `${settings.website_url || process.env.PODCAST_WEBSITE_URL || ""}/episodes/${episode.id}`,
          guid: `episode-${episode.id}`,
          date: new Date(episode.published_at || new Date()),
          enclosure: {
            url: episode.storage_url,
            type: "audio/mpeg",
            size: episode.file_size || 0,
          },
          itunesDuration: episode.duration ? this.formatDuration(episode.duration) : "00:00:00",
          itunesExplicit: settings.explicit || false,
        });
      }

      // XMLの生成
      const xml = feed.buildXml();

      // ファイルに保存
      const outputPath = path.join(this.outputDir, "feed.xml");
      fs.writeFileSync(outputPath, xml);

      return {
        status: ProcessStatus.SUCCESS,
        message: `RSSフィードの生成に成功しました: ${outputPath}`,
        data: outputPath,
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          status: ProcessStatus.ERROR,
          message: `RSSフィードの生成に失敗しました: ${error.message}`,
          error,
        };
      }
      throw error;
    }
  }

  /**
   * 秒数を時間:分:秒の形式に変換
   * @param seconds 秒数
   * @returns 時間:分:秒の形式の文字列
   */
  private formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    return [
      hours.toString().padStart(2, "0"),
      minutes.toString().padStart(2, "0"),
      secs.toString().padStart(2, "0"),
    ].join(":");
  }
}
