import dotenv from "dotenv";
import { Command } from "commander";
import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import { HatenaBookmarkService } from "./services/bookmark";
import { WebContentService } from "./services/content";
import { OpenAINarrationService } from "./services/narration";
import { GoogleCloudTTSService } from "./services/tts";
import { DefaultAudioMergeService } from "./services/audio-merge";
import { ProcessStatus } from "./types";

// 環境変数の読み込み
dotenv.config();

// サービスのインスタンス化
const bookmarkService = new HatenaBookmarkService();
const contentService = new WebContentService();
const narrationService = new OpenAINarrationService();
const ttsService = new GoogleCloudTTSService();
const audioMergeService = new DefaultAudioMergeService();

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
    
    console.log(chalk.blue("\n=== はてなブックマーク音声化処理完了 ==="));
  });

// ヘルプコマンド
program
  .command("help")
  .description("ヘルプを表示")
  .action(() => {
    program.outputHelp();
  });

// 対話型モード
program
  .command("interactive")
  .description("対話型モードで実行")
  .action(async () => {
    console.log(chalk.blue("=== はてなブックマーク音声化システム - 対話型モード ===\n"));
    
    const { action } = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: "実行する操作を選択してください:",
        choices: [
          { name: "ブックマーク情報の取得", value: "fetch-bookmarks" },
          { name: "コンテンツの抽出", value: "extract-contents" },
          { name: "ナレーションの生成", value: "generate-narrations" },
          { name: "音声ファイルの生成", value: "generate-audio-files" },
          { name: "プレイリストの音声ファイルを結合", value: "merge-playlist" },
          { name: "指定した音声ファイルを結合", value: "merge-audio-files" },
          { name: "全処理の実行", value: "process-all" },
          { name: "終了", value: "exit" },
        ],
      },
    ]);
    
    if (action === "exit") {
      console.log(chalk.blue("システムを終了します。"));
      return;
    }
    
    if (action === "fetch-bookmarks" || action === "process-all") {
      const { username, limit } = await inquirer.prompt([
        {
          type: "input",
          name: "username",
          message: "はてなユーザー名を入力してください (環境変数を使用する場合は空欄):",
        },
        {
          type: "input",
          name: "limit",
          message: "処理する最大件数を入力してください:",
          default: action === "process-all" ? "5" : "20",
          validate: (value) => {
            const num = parseInt(value);
            return !isNaN(num) && num > 0 ? true : "正の整数を入力してください";
          },
        },
      ]);
      
      if (action === "fetch-bookmarks") {
        const cmd = program.commands.find((cmd) => cmd.name() === "fetch-bookmarks");
        if (cmd) {
          await cmd.parseAsync([
            process.argv[0],
            process.argv[1],
            "fetch-bookmarks",
            username ? `--username=${username}` : "",
            `--limit=${limit}`,
          ].filter(Boolean));
        }
      } else {
        const cmd = program.commands.find((cmd) => cmd.name() === "process-all");
        if (cmd) {
          await cmd.parseAsync([
            process.argv[0],
            process.argv[1],
            "process-all",
            username ? `--username=${username}` : "",
            `--limit=${limit}`,
          ].filter(Boolean));
        }
      }
    } else if (action === "merge-playlist") {
      const { playlistId, name } = await inquirer.prompt([
        {
          type: "input",
          name: "playlistId",
          message: "プレイリストIDを入力してください:",
          validate: (value) => {
            const num = parseInt(value);
            return !isNaN(num) && num > 0 ? true : "正の整数を入力してください";
          },
        },
        {
          type: "input",
          name: "name",
          message: "結合後のファイル名を入力してください (空欄の場合はプレイリスト名を使用):",
        },
      ]);
      
      const cmd = program.commands.find((cmd) => cmd.name() === "merge-playlist");
      if (cmd) {
        await cmd.parseAsync([
          process.argv[0],
          process.argv[1],
          "merge-playlist",
          `--playlist-id=${playlistId}`,
          name ? `--name=${name}` : "",
        ].filter(Boolean));
      }
    } else if (action === "merge-audio-files") {
      const { ids, name } = await inquirer.prompt([
        {
          type: "input",
          name: "ids",
          message: "結合する音声ファイルIDをカンマ区切りで入力してください (例: 1,2,3):",
          validate: (value) => {
            const ids = value.split(",").map((id: string) => parseInt(id.trim()));
            return ids.every((id: number) => !isNaN(id) && id > 0) ? true : "カンマ区切りの正の整数を入力してください";
          },
        },
        {
          type: "input",
          name: "name",
          message: "結合後のファイル名を入力してください:",
          validate: (value) => {
            return value.trim() !== "" ? true : "ファイル名を入力してください";
          },
        },
      ]);
      
      const cmd = program.commands.find((cmd) => cmd.name() === "merge-audio-files");
      if (cmd) {
        await cmd.parseAsync([
          process.argv[0],
          process.argv[1],
          "merge-audio-files",
          `--ids=${ids}`,
          `--name=${name}`,
        ]);
      }
    } else {
      const { limit } = await inquirer.prompt([
        {
          type: "input",
          name: "limit",
          message: "処理する最大件数を入力してください:",
          default: "10",
          validate: (value) => {
            const num = parseInt(value);
            return !isNaN(num) && num > 0 ? true : "正の整数を入力してください";
          },
        },
      ]);
      
      const cmd = program.commands.find((cmd) => cmd.name() === action);
      if (cmd) {
        await cmd.parseAsync([
          process.argv[0],
          process.argv[1],
          action,
          `--limit=${limit}`,
        ]);
      }
    }
    
    // 続行の確認
    const { continue: shouldContinue } = await inquirer.prompt([
      {
        type: "confirm",
        name: "continue",
        message: "続けて操作を行いますか?",
        default: true,
      },
    ]);
    
    if (shouldContinue) {
      // 対話型モードを再帰的に呼び出し
      const cmd = program.commands.find((cmd) => cmd.name() === "interactive");
      if (cmd) {
        await cmd.parseAsync([
          process.argv[0],
          process.argv[1],
          "interactive",
        ]);
      }
    } else {
      console.log(chalk.blue("システムを終了します。"));
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
