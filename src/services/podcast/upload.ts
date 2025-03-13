import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { ProcessResult, ProcessStatus } from "../../types";

// 環境変数の読み込み
dotenv.config();

/**
 * Cloudflare R2アップロードサービスクラス
 */
export class CloudflareR2UploadService {
  private s3Client: S3Client;
  private bucketName: string;
  private publicUrl: string;

  /**
   * コンストラクタ
   */
  constructor() {
    // 環境変数から設定を読み込む
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const accessKeyId = process.env.CLOUDFLARE_ACCESS_KEY_ID;
    const secretAccessKey = process.env.CLOUDFLARE_SECRET_ACCESS_KEY;
    this.bucketName = process.env.CLOUDFLARE_R2_BUCKET || "";
    this.publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL || "";

    // 必要な環境変数が設定されているか確認
    if (!accountId || !accessKeyId || !secretAccessKey || !this.bucketName) {
      throw new Error("Cloudflare R2の設定が不足しています。環境変数を確認してください。");
    }

    // S3クライアントの初期化
    this.s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  /**
   * ファイルをアップロード
   * @param filePath アップロードするファイルのパス
   * @param key アップロード先のキー（ファイル名）
   * @param contentType コンテンツタイプ
   * @returns アップロード結果
   */
  async uploadFile(
    filePath: string,
    key: string,
    contentType: string = "audio/mpeg"
  ): Promise<ProcessResult<{ url: string; size: number }>> {
    try {
      // ファイルの存在確認
      if (!fs.existsSync(filePath)) {
        return {
          status: ProcessStatus.ERROR,
          message: `ファイルが見つかりません: ${filePath}`,
        };
      }

      // ファイルサイズの取得
      const stats = fs.statSync(filePath);
      const fileSize = stats.size;

      // ファイルストリームの作成
      const fileStream = fs.createReadStream(filePath);

      // アップロードパラメータの設定
      const uploadParams = {
        Bucket: this.bucketName,
        Key: key,
        Body: fileStream,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000", // 1年間のキャッシュ
      };

      // アップロードの実行
      const upload = new Upload({
        client: this.s3Client,
        params: uploadParams,
      });

      await upload.done();

      // 公開URLの生成
      const url = `${this.publicUrl}/${key}`;

      return {
        status: ProcessStatus.SUCCESS,
        message: `ファイルのアップロードに成功しました: ${key}`,
        data: {
          url,
          size: fileSize,
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          status: ProcessStatus.ERROR,
          message: `ファイルのアップロードに失敗しました: ${error.message}`,
          error,
        };
      }
      throw error;
    }
  }

  /**
   * 音声ファイルをアップロード
   * @param filePath アップロードするファイルのパス
   * @param episodeNumber エピソード番号
   * @returns アップロード結果
   */
  async uploadAudioFile(
    filePath: string,
    episodeNumber: number
  ): Promise<ProcessResult<{ url: string; size: number }>> {
    try {
      // ファイル名の取得
      const fileName = path.basename(filePath);
      
      // アップロード先のキーを生成
      const key = `episodes/episode-${episodeNumber}/${fileName}`;
      
      // ファイルをアップロード
      return await this.uploadFile(filePath, key);
    } catch (error) {
      if (error instanceof Error) {
        return {
          status: ProcessStatus.ERROR,
          message: `音声ファイルのアップロードに失敗しました: ${error.message}`,
          error,
        };
      }
      throw error;
    }
  }
}
