import dotenv from "dotenv";
import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import fs from "fs";
import path from "path";
import { HatenaBookmarkService } from "./services/bookmark";
import { WebContentService } from "./services/content";
import { OpenAINarrationService } from "./services/narration";
import { GoogleCloudTTSService } from "./services/tts";
import { DefaultAudioMergeService } from "./services/audio-merge";
import { PodcastService } from "./services/podcast";
import { ProcessStatus } from "./types";

// 環境変数の読み込み
dotenv.config();

// サービスのインスタンス化
const bookmarkService = new HatenaBookmarkService();
const contentService = new WebContentService();
const narrationService = new OpenAINarrationService();
const ttsService = new GoogleCloudTTSService();
const audioMergeService = new DefaultAudioMergeService();
const podcastService = new PodcastService();

// コマンドラインインターフェースの設定
const program = new Command();

program
  .name("hatebu-audio")
  .description("はてなブックマークの記事を要約して音声化するシステム")
  .version("0.1.0");

// ブックマーク取得コマンド
program
  .command("fetch-bookmarks")
  .description("はてなブックマークからブックマーク情報を取得して保存")
  .option("-u, --username <username>", "はてなユーザー名")
  .option("-l, --limit <number>", "取得する最大件数", "20")
  .action(async (options) => {
    const spinner = ora("ブックマーク情報を取得中...").start();
    
    try {
      const result = await bookmarkService.fetchAndSaveNewBookmarks(
        options.username,
        parseInt(options.limit)
      );
      
      spinner.stop();
      
      if (result.status === ProcessStatus.SUCCESS) {
        console.log(chalk.green(`✓ ${result.message}`));
        if (result.data) {
          console.log(chalk.gray(`  保存されたブックマーク: ${result.data.length}件`));
        }
      } else if (result.status === ProcessStatus.SKIPPED) {
        console.log(chalk.yellow(`⚠ ${result.message}`));
      } else {
        console.log(chalk.red(`✗ ${result.message}`));
      }
    } catch (error) {
      spinner.stop();
      console.error(chalk.red(`エラー: ${error instanceof Error ? error.message : String(error)}`));
    }
  });

// コンテンツ抽出コマンド
program
  .command("extract-contents")
  .description("未処理のブックマークからコンテンツを抽出して保存")
  .option("-l, --limit <number>", "処理する最大件数", "10")
  .action(async (options) => {
    const spinner = ora("コンテンツを抽出中...").start();
    
    try {
      const result = await contentService.processUnprocessedBookmarks(
        parseInt(options.limit)
      );
      
      spinner.stop();
      
      if (result.status === ProcessStatus.SUCCESS) {
        console.log(chalk.green(`✓ ${result.message}`));
        if (result.data) {
          console.log(chalk.gray(`  抽出されたコンテンツ: ${result.data.length}件`));
        }
      } else if (result.status === ProcessStatus.SKIPPED) {
        console.log(chalk.yellow(`⚠ ${result.message}`));
      } else {
        console.log(chalk.red(`✗ ${result.message}`));
      }
    } catch (error) {
      spinner.stop();
      console.error(chalk.red(`エラー: ${error instanceof Error ? error.message : String(error)}`));
    }
  });

// ナレーション生成コマンド
program
  .command("generate-narrations")
  .description("未処理の要約からナレーションを生成して保存")
  .option("-l, --limit <number>", "処理する最大件数", "10")
  .action(async (options) => {
    const spinner = ora("ナレーションを生成中...").start();
    
    try {
      const result = await narrationService.processUnprocessedSummaries(
        parseInt(options.limit)
      );
      
      spinner.stop();
      
      if (result.status === ProcessStatus.SUCCESS) {
        console.log(chalk.green(`✓ ${result.message}`));
        if (result.data) {
          console.log(chalk.gray(`  生成されたナレーション: ${result.data.length}件`));
        }
      } else if (result.status === ProcessStatus.SKIPPED) {
        console.log(chalk.yellow(`⚠ ${result.message}`));
      } else {
        console.log(chalk.red(`✗ ${result.message}`));
      }
    } catch (error) {
      spinner.stop();
      console.error(chalk.red(`エラー: ${error instanceof Error ? error.message : String(error)}`));
    }
  });

// 音声ファイル生成コマンド
program
  .command("generate-audio-files")
  .description("未処理のナレーションから音声ファイルを生成して保存")
  .option("-l, --limit <number>", "処理する最大件数", "10")
  .action(async (options) => {
    const spinner = ora("音声ファイルを生成中...").start();
    
    try {
      const result = await ttsService.processUnprocessedNarrations(
        parseInt(options.limit)
      );
      
      spinner.stop();
      
      if (result.status === ProcessStatus.SUCCESS) {
        console.log(chalk.green(`✓ ${result.message}`));
        if (result.data) {
          console.log(chalk.gray(`  生成された音声ファイル: ${result.data.length}件`));
          console.log(chalk.gray(`  ファイルパス:`));
          result.data.forEach((audioFile) => {
            console.log(chalk.gray(`    - ${audioFile.file_path}`));
          });
        }
      } else if (result.status === ProcessStatus.SKIPPED) {
        console.log(chalk.yellow(`⚠ ${result.message}`));
      } else {
        console.log(chalk.red(`✗ ${result.message}`));
      }
    } catch (error) {
      spinner.stop();
      console.error(chalk.red(`エラー: ${error instanceof Error ? error.message : String(error)}`));
    }
  });

// プレイリストから音声ファイルを結合するコマンド
program
  .command("merge-playlist")
  .description("プレイリストの音声ファイルを一つのMP3ファイルに結合")
  .requiredOption("-p, --playlist-id <id>", "プレイリストID")
  .option("-n, --name <name>", "結合後のファイル名（指定しない場合はプレイリスト名を使用）")
  .action(async (options) => {
    const spinner = ora("音声ファイルを結合中...").start();
    
    try {
      const result = await audioMergeService.mergePlaylist(
        parseInt(options.playlistId),
        options.name
      );
      
      spinner.stop();
      
      if (result.status === ProcessStatus.SUCCESS) {
        console.log(chalk.green(`✓ ${result.message}`));
        if (result.data) {
          console.log(chalk.gray(`  結合された音声ファイル: ${result.data.name}`));
          console.log(chalk.gray(`  ファイルパス: ${result.data.file_path}`));
        }
      } else if (result.status === ProcessStatus.SKIPPED) {
        console.log(chalk.yellow(`⚠ ${result.message}`));
      } else {
        console.log(chalk.red(`✗ ${result.message}`));
      }
    } catch (error) {
      spinner.stop();
      console.error(chalk.red(`エラー: ${error instanceof Error ? error.message : String(error)}`));
    }
  });

// 指定した音声ファイルを結合するコマンド
program
  .command("merge-audio-files")
  .description("指定した音声ファイルを一つのMP3ファイルに結合")
  .requiredOption("-i, --ids <ids>", "音声ファイルIDのカンマ区切りリスト")
  .requiredOption("-n, --name <name>", "結合後のファイル名")
  .action(async (options) => {
    const spinner = ora("音声ファイルを結合中...").start();
    
    try {
      // カンマ区切りの文字列を数値の配列に変換
      const audioFileIds = options.ids.split(",").map((id: string) => parseInt(id.trim()));
      
      const result = await audioMergeService.mergeAndSaveAudioFiles(
        audioFileIds,
        options.name
      );
      
      spinner.stop();
      
      if (result.status === ProcessStatus.SUCCESS) {
        console.log(chalk.green(`✓ ${result.message}`));
        if (result.data) {
          console.log(chalk.gray(`  結合された音声ファイル: ${result.data.name}`));
          console.log(chalk.gray(`  ファイルパス: ${result.data.file_path}`));
        }
      } else if (result.status === ProcessStatus.SKIPPED) {
        console.log(chalk.yellow(`⚠ ${result.message}`));
      } else {
        console.log(chalk.red(`✗ ${result.message}`));
      }
    } catch (error) {
      spinner.stop();
      console.error(chalk.red(`エラー: ${error instanceof Error ? error.message : String(error)}`));
    }
  });

// 未処理の音声ファイルを結合するコマンド
program
  .command("merge-unprocessed")
  .description("未処理の音声ファイルを一つのMP3ファイルに結合")
  .option("-n, --name <name>", "結合後のファイル名（指定しない場合は自動生成）")
  .action(async (options) => {
    const spinner = ora("未処理の音声ファイルを結合中...").start();
    
    try {
      const result = await audioMergeService.mergeUnprocessedAudioFiles(options.name);
      
      spinner.stop();
      
      if (result.status === ProcessStatus.SUCCESS) {
        console.log(chalk.green(`✓ ${result.message}`));
        if (result.data) {
          console.log(chalk.gray(`  結合された音声ファイル: ${result.data.name}`));
          console.log(chalk.gray(`  ファイルパス: ${result.data.file_path}`));
        }
      } else if (result.status === ProcessStatus.SKIPPED) {
        console.log(chalk.yellow(`⚠ ${result.message}`));
      } else {
        console.log(chalk.red(`✗ ${result.message}`));
      }
    } catch (error) {
      spinner.stop();
      console.error(chalk.red(`エラー: ${error instanceof Error ? error.message : String(error)}`));
    }
  });

// 全処理実行コマンド
program
  .command("process-all")
  .description("ブックマーク取得から音声ファイル生成までの全処理を実行")
  .option("-u, --username <username>", "はてなユーザー名")
  .option("-l, --limit <number>", "処理する最大件数", "5")
  .action(async (options) => {
    console.log(chalk.blue("=== はてなブックマーク音声化処理開始 ==="));
    
    // ブックマーク取得
    console.log(chalk.blue("\n1. ブックマーク情報の取得"));
    const spinner1 = ora("ブックマーク情報を取得中...").start();
    
    try {
      const result1 = await bookmarkService.fetchAndSaveNewBookmarks(
        options.username,
        parseInt(options.limit)
      );
      
      spinner1.stop();
      
      if (result1.status === ProcessStatus.SUCCESS) {
        console.log(chalk.green(`✓ ${result1.message}`));
        if (result1.data) {
          console.log(chalk.gray(`  保存されたブックマーク: ${result1.data.length}件`));
        }
      } else if (result1.status === ProcessStatus.SKIPPED) {
        console.log(chalk.yellow(`⚠ ${result1.message}`));
      } else {
        console.log(chalk.red(`✗ ${result1.message}`));
        return;
      }
    } catch (error) {
      spinner1.stop();
      console.error(chalk.red(`エラー: ${error instanceof Error ? error.message : String(error)}`));
      return;
    }
    
    // コンテンツ抽出
    console.log(chalk.blue("\n2. コンテンツの抽出"));
    const spinner2 = ora("コンテンツを抽出中...").start();
    
    try {
      const result2 = await contentService.processUnprocessedBookmarks(
        parseInt(options.limit)
      );
      
      spinner2.stop();
      
      if (result2.status === ProcessStatus.SUCCESS) {
        console.log(chalk.green(`✓ ${result2.message}`));
        if (result2.data) {
          console.log(chalk.gray(`  抽出されたコンテンツ: ${result2.data.length}件`));
        }
      } else if (result2.status === ProcessStatus.SKIPPED) {
        console.log(chalk.yellow(`⚠ ${result2.message}`));
      } else {
        console.log(chalk.red(`✗ ${result2.message}`));
        return;
      }
    } catch (error) {
      spinner2.stop();
      console.error(chalk.red(`エラー: ${error instanceof Error ? error.message : String(error)}`));
      return;
    }
    
    // ナレーション生成
    console.log(chalk.blue("\n4. ナレーションの生成"));
    const spinner4 = ora("ナレーションを生成中...").start();
    
    try {
      const result4 = await narrationService.processUnprocessedSummaries(
        parseInt(options.limit)
      );
      
      spinner4.stop();
      
      if (result4.status === ProcessStatus.SUCCESS) {
        console.log(chalk.green(`✓ ${result4.message}`));
        if (result4.data) {
          console.log(chalk.gray(`  生成されたナレーション: ${result4.data.length}件`));
        }
      } else if (result4.status === ProcessStatus.SKIPPED) {
        console.log(chalk.yellow(`⚠ ${result4.message}`));
      } else {
        console.log(chalk.red(`✗ ${result4.message}`));
        return;
      }
    } catch (error) {
      spinner4.stop();
      console.error(chalk.red(`エラー: ${error instanceof Error ? error.message : String(error)}`));
      return;
    }
    
    // 音声ファイル生成
    console.log(chalk.blue("\n5. 音声ファイルの生成"));
    const spinner5 = ora("音声ファイルを生成中...").start();
    
    try {
      const result5 = await ttsService.processUnprocessedNarrations(
        parseInt(options.limit)
      );
      
      spinner5.stop();
      
      if (result5.status === ProcessStatus.SUCCESS) {
        console.log(chalk.green(`✓ ${result5.message}`));
        if (result5.data) {
          console.log(chalk.gray(`  生成された音声ファイル: ${result5.data.length}件`));
          console.log(chalk.gray(`  ファイルパス:`));
          result5.data.forEach((audioFile) => {
            console.log(chalk.gray(`    - ${audioFile.file_path}`));
          });
        }
      } else if (result5.status === ProcessStatus.SKIPPED) {
        console.log(chalk.yellow(`⚠ ${result5.message}`));
      } else {
        console.log(chalk.red(`✗ ${result5.message}`));
        return;
      }
    } catch (error) {
      spinner5.stop();
      console.error(chalk.red(`エラー: ${error instanceof Error ? error.message : String(error)}`));
      return;
    }
    
    // 音声ファイル結合（挨拶と結びを追加）
    console.log(chalk.blue("\n6. 未処理の音声ファイルの結合（挨拶と結びを追加）"));
    const spinner6 = ora("未処理の音声ファイルを結合中...").start();
    
    try {
      // 挨拶と結びの音声ファイルを生成（初回のみ）
      const audioOutputDir = process.env.AUDIO_OUTPUT_DIR || "./data/audio";
      const introFilePath = path.join(audioOutputDir, "radio_intro.mp3");
      const outroFilePath = path.join(audioOutputDir, "radio_outro.mp3");
      
      // ファイルが存在しない場合のみ生成
      if (!fs.existsSync(introFilePath)) {
        const introText = "こんにちは、はてなブックマークラジオへようこそ。今回のブックマークをご紹介します。";
        await ttsService.synthesizeSpeech(introText, introFilePath);
      }
      
      if (!fs.existsSync(outroFilePath)) {
        const outroText = "以上で今回のはてなブックマークラジオを終わります。お聴きいただきありがとうございました。";
        await ttsService.synthesizeSpeech(outroText, outroFilePath);
      }
      
      // 新しいメソッドを使用して音声ファイルを結合
      const result6 = await audioMergeService.mergeUnprocessedAudioFilesWithIntro(
        `自動生成_${new Date().toISOString().slice(0, 10)}`
      );
      
      spinner6.stop();
      
      if (result6.status === ProcessStatus.SUCCESS) {
        console.log(chalk.green(`✓ ${result6.message}`));
        if (result6.data) {
          console.log(chalk.gray(`  結合された音声ファイル: ${result6.data.name}`));
          console.log(chalk.gray(`  ファイルパス: ${result6.data.file_path}`));
        }
      } else if (result6.status === ProcessStatus.SKIPPED) {
        console.log(chalk.yellow(`⚠ ${result6.message}`));
      } else {
        console.log(chalk.red(`✗ ${result6.message}`));
      }
    } catch (error) {
      spinner6.stop();
      console.error(chalk.red(`エラー: ${error instanceof Error ? error.message : String(error)}`));
    }
    
    console.log(chalk.blue("\n=== はてなブックマーク音声化処理完了 ==="));
  });

// Podcast設定更新コマンド
program
  .command("update-podcast-settings")
  .description("Podcast設定を更新")
  .option("-t, --title <title>", "Podcastのタイトル")
  .option("-d, --description <description>", "Podcastの説明")
  .option("-a, --author <author>", "著者名")
  .option("-e, --email <email>", "連絡先メールアドレス")
  .option("-l, --language <language>", "言語（例: ja）")
  .option("-c, --category <category>", "カテゴリ（例: Technology）")
  .option("-x, --explicit", "露骨な表現を含む場合はtrueに設定")
  .option("-i, --image-url <imageUrl>", "アートワーク画像のURL")
  .action(async (options) => {
    const spinner = ora("Podcast設定を更新中...").start();
    
    try {
      const settings: any = {};
      
      if (options.title) settings.title = options.title;
      if (options.description) settings.description = options.description;
      if (options.author) settings.author = options.author;
      if (options.email) settings.email = options.email;
      if (options.language) settings.language = options.language;
      if (options.category) settings.category = options.category;
      if (options.explicit !== undefined) settings.explicit = options.explicit;
      if (options.imageUrl) settings.image_url = options.imageUrl;
      
      const result = await podcastService.updateSettings(settings);
      
      spinner.stop();
      
      if (result.status === ProcessStatus.SUCCESS) {
        console.log(chalk.green(`✓ ${result.message}`));
        if (result.data) {
          console.log(chalk.gray("  更新された設定:"));
          console.log(chalk.gray(`    タイトル: ${result.data.title}`));
          console.log(chalk.gray(`    説明: ${result.data.description}`));
          console.log(chalk.gray(`    著者: ${result.data.author}`));
          console.log(chalk.gray(`    言語: ${result.data.language}`));
          console.log(chalk.gray(`    カテゴリ: ${result.data.category}`));
        }
      } else {
        console.log(chalk.red(`✗ ${result.message}`));
      }
    } catch (error) {
      spinner.stop();
      console.error(chalk.red(`エラー: ${error instanceof Error ? error.message : String(error)}`));
    }
  });

// エピソード公開コマンド
program
  .command("publish-episode")
  .description("音声ファイルをアップロードしてPodcastエピソードとして公開")
  .requiredOption("-f, --file-id <id>", "結合音声ファイルID")
  .option("-t, --title <title>", "エピソードのタイトル")
  .option("-d, --description <description>", "エピソードの説明")
  .option("-a, --auto-metadata", "メタデータを自動生成する")
  .action(async (options) => {
    const spinner = ora("エピソードを公開中...").start();
    
    try {
      const result = await podcastService.publishEpisode(
        parseInt(options.fileId),
        {
          title: options.title,
          description: options.description,
          autoMetadata: options.autoMetadata,
        }
      );
      
      spinner.stop();
      
      if (result.status === ProcessStatus.SUCCESS) {
        console.log(chalk.green(`✓ ${result.message}`));
        if (result.data) {
          console.log(chalk.gray(`  エピソードタイトル: ${result.data.title}`));
          console.log(chalk.gray(`  ストレージURL: ${result.data.storage_url}`));
        }
      } else if (result.status === ProcessStatus.SKIPPED) {
        console.log(chalk.yellow(`⚠ ${result.message}`));
      } else {
        console.log(chalk.red(`✗ ${result.message}`));
      }
    } catch (error) {
      spinner.stop();
      console.error(chalk.red(`エラー: ${error instanceof Error ? error.message : String(error)}`));
    }
  });

// RSSフィード生成コマンド
program
  .command("generate-feed")
  .description("Podcast用のRSSフィードを生成")
  .action(async () => {
    const spinner = ora("RSSフィードを生成中...").start();
    
    try {
      const result = await podcastService.generateAndDeployFeed();
      
      spinner.stop();
      
      if (result.status === ProcessStatus.SUCCESS) {
        console.log(chalk.green(`✓ ${result.message}`));
        if (result.data) {
          console.log(chalk.gray(`  フィードURL: ${result.data}`));
        }
      } else if (result.status === ProcessStatus.SKIPPED) {
        console.log(chalk.yellow(`⚠ ${result.message}`));
      } else {
        console.log(chalk.red(`✗ ${result.message}`));
      }
    } catch (error) {
      spinner.stop();
      console.error(chalk.red(`エラー: ${error instanceof Error ? error.message : String(error)}`));
    }
  });

// Webサイトデプロイコマンド
program
  .command("deploy-website")
  .description("PodcastのWebサイトをデプロイ")
  .action(async () => {
    const spinner = ora("Webサイトをデプロイ中...").start();
    
    try {
      const result = await podcastService.deployWebsite();
      
      spinner.stop();
      
      if (result.status === ProcessStatus.SUCCESS) {
        console.log(chalk.green(`✓ ${result.message}`));
        if (result.data) {
          console.log(chalk.gray(`  WebサイトURL: ${result.data}`));
        }
      } else {
        console.log(chalk.red(`✗ ${result.message}`));
      }
    } catch (error) {
      spinner.stop();
      console.error(chalk.red(`エラー: ${error instanceof Error ? error.message : String(error)}`));
    }
  });

// Podcast公開コマンド（音声ファイルのアップロード、RSSフィード生成、Webサイトデプロイを一括実行）
program
  .command("publish-podcast")
  .description("音声ファイルをアップロードしてPodcastとして公開（RSSフィード生成、Webサイトデプロイを含む）")
  .requiredOption("-f, --file-id <id>", "結合音声ファイルID")
  .option("-t, --title <title>", "エピソードのタイトル")
  .option("-d, --description <description>", "エピソードの説明")
  .option("-a, --auto-metadata", "メタデータを自動生成する")
  .action(async (options) => {
    console.log(chalk.blue("=== Podcast公開処理開始 ==="));
    
    // エピソード公開
    console.log(chalk.blue("\n1. エピソードの公開"));
    const spinner1 = ora("エピソードを公開中...").start();
    
    try {
      const result1 = await podcastService.publishEpisode(
        parseInt(options.fileId),
        {
          title: options.title,
          description: options.description,
          autoMetadata: options.autoMetadata,
        }
      );
      
      spinner1.stop();
      
      if (result1.status === ProcessStatus.SUCCESS) {
        console.log(chalk.green(`✓ ${result1.message}`));
        if (result1.data) {
          console.log(chalk.gray(`  エピソードタイトル: ${result1.data.title}`));
          console.log(chalk.gray(`  ストレージURL: ${result1.data.storage_url}`));
        }
      } else if (result1.status === ProcessStatus.SKIPPED) {
        console.log(chalk.yellow(`⚠ ${result1.message}`));
      } else {
        console.log(chalk.red(`✗ ${result1.message}`));
        return;
      }
    } catch (error) {
      spinner1.stop();
      console.error(chalk.red(`エラー: ${error instanceof Error ? error.message : String(error)}`));
      return;
    }
    
    // RSSフィード生成
    console.log(chalk.blue("\n2. RSSフィードの生成"));
    const spinner2 = ora("RSSフィードを生成中...").start();
    
    try {
      const result2 = await podcastService.generateAndDeployFeed();
      
      spinner2.stop();
      
      if (result2.status === ProcessStatus.SUCCESS) {
        console.log(chalk.green(`✓ ${result2.message}`));
        if (result2.data) {
          console.log(chalk.gray(`  フィードURL: ${result2.data}`));
        }
      } else if (result2.status === ProcessStatus.SKIPPED) {
        console.log(chalk.yellow(`⚠ ${result2.message}`));
      } else {
        console.log(chalk.red(`✗ ${result2.message}`));
      }
    } catch (error) {
      spinner2.stop();
      console.error(chalk.red(`エラー: ${error instanceof Error ? error.message : String(error)}`));
    }
    
    // Webサイトデプロイ
    console.log(chalk.blue("\n3. Webサイトのデプロイ"));
    const spinner3 = ora("Webサイトをデプロイ中...").start();
    
    try {
      const result3 = await podcastService.deployWebsite();
      
      spinner3.stop();
      
      if (result3.status === ProcessStatus.SUCCESS) {
        console.log(chalk.green(`✓ ${result3.message}`));
        if (result3.data) {
          console.log(chalk.gray(`  WebサイトURL: ${result3.data}`));
        }
      } else {
        console.log(chalk.red(`✗ ${result3.message}`));
      }
    } catch (error) {
      spinner3.stop();
      console.error(chalk.red(`エラー: ${error instanceof Error ? error.message : String(error)}`));
    }
  });

// コマンドライン引数がない場合は対話型モードを実行
if (process.argv.length <= 2) {
  const cmd = program.commands.find((cmd) => cmd.name() === "interactive");
  if (cmd) {
    cmd.parseAsync([
      process.argv[0],
      process.argv[1],
      "interactive",
    ]);
  }
} else {
  program.parse(process.argv);
}
