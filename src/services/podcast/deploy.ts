import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { ProcessResult, ProcessStatus } from "../../types";

// 環境変数の読み込み
dotenv.config();

/**
 * Cloudflare Pagesデプロイサービスクラス
 */
export class CloudflarePagesDeployService {
  private projectName: string;
  private websiteDir: string;

  /**
   * コンストラクタ
   */
  constructor() {
    this.projectName = process.env.CLOUDFLARE_PAGES_PROJECT || "";
    this.websiteDir = path.join(process.cwd(), "dist", "website");

    // 必要な環境変数が設定されているか確認
    if (!this.projectName) {
      throw new Error(
        "Cloudflare Pagesプロジェクト名が設定されていません。環境変数を確認してください。"
      );
    }
  }

  /**
   * Webサイトをデプロイ
   * @returns 処理結果
   */
  async deployWebsite(): Promise<ProcessResult<string>> {
    try {
      // ビルド済みWebサイトの存在確認
      if (!fs.existsSync(this.websiteDir)) {
        return {
          status: ProcessStatus.ERROR,
          message: `ビルド済みWebサイトが見つかりません: ${this.websiteDir}`,
        };
      }

      // wranglerコマンドの実行
      const command = `npx wrangler pages deploy ${this.websiteDir} --project-name=${this.projectName}`;
      const output = execSync(command, { encoding: "utf-8" });

      // デプロイURLの抽出
      const urlMatch = output.match(/https:\/\/[^\s]+\.pages\.dev/);
      const deployUrl = urlMatch ? urlMatch[0] : "";

      return {
        status: ProcessStatus.SUCCESS,
        message: `Webサイトのデプロイに成功しました: ${deployUrl}`,
        data: deployUrl,
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

  /**
   * RSSフィードをデプロイ
   * @param feedPath RSSフィードのパス
   * @returns 処理結果
   */
  async deployFeed(feedPath: string): Promise<ProcessResult<string>> {
    try {
      // RSSフィードの存在確認
      if (!fs.existsSync(feedPath)) {
        return {
          status: ProcessStatus.ERROR,
          message: `RSSフィードが見つかりません: ${feedPath}`,
        };
      }

      // Webサイトディレクトリの確認と作成
      if (!fs.existsSync(this.websiteDir)) {
        fs.mkdirSync(this.websiteDir, { recursive: true });
      }

      // RSSフィードをWebサイトディレクトリにコピー
      const destPath = path.join(this.websiteDir, "feed.xml");
      fs.copyFileSync(feedPath, destPath);

      // wranglerコマンドの実行
      const command = `npx wrangler pages deploy ${this.websiteDir} --project-name=${this.projectName}`;
      const output = execSync(command, { encoding: "utf-8" });

      // デプロイURLの抽出
      const urlMatch = output.match(/https:\/\/[^\s]+\.pages\.dev/);
      const deployUrl = urlMatch ? `${urlMatch[0]}/feed.xml` : "";

      return {
        status: ProcessStatus.SUCCESS,
        message: `RSSフィードのデプロイに成功しました: ${deployUrl}`,
        data: deployUrl,
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          status: ProcessStatus.ERROR,
          message: `RSSフィードのデプロイに失敗しました: ${error.message}`,
          error,
        };
      }
      throw error;
    }
  }
}
