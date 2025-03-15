import { exec } from 'child_process';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import dotenv from 'dotenv';

// 環境変数の読み込み
dotenv.config();

const execPromise = promisify(exec);
const dbPath = process.env.DB_PATH || "./data/db/hatebu-audio.db";

async function getLatestPodcastEpisodeId(): Promise<number> {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    db.get(
      "SELECT id FROM podcast_episodes ORDER BY id DESC LIMIT 1",
      (err, row: { id: number } | undefined) => {
        db.close();
        if (err) reject(err);
        resolve(row?.id || 1); // デフォルト値として1を返す
      }
    );
  });
}

async function runCommand(command: string): Promise<void> {
  try {
    console.log(`実行中: ${command}`);
    const { stdout, stderr } = await execPromise(command);
    console.log('出力:', stdout);
    if (stderr) console.error('エラー:', stderr);
  } catch (error) {
    console.error('コマンド実行エラー:', error);
    throw error;
  }
}

async function main() {
  try {
    // 1. process-allの実行
    await runCommand('npm run dev -- process-all --username=razokulover --limit=20');

    // 2. 最新のpodcast_episodeのIDを取得
    const latestId = await getLatestPodcastEpisodeId();
    
    // 3. publish-podcastの実行
    await runCommand(`npm run dev -- publish-podcast --file-id=${latestId}`);

    // 4. generate-feedの実行
    await runCommand('npm run dev -- generate-feed');

    console.log('全てのコマンドが正常に実行されました。');
  } catch (error) {
    console.error('ワークフロー実行中にエラーが発生しました:', error);
    process.exit(1);
  }
}

main();
