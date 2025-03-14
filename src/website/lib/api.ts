import path from 'path';
import sqlite3 from 'sqlite3';
import { PodcastEpisode, PodcastSettings } from '../../types';

// データベース接続
const getDb = () => {
  // 絶対パスを使用する
  const dbPath = process.env.DB_PATH || path.resolve(process.cwd(), './data/db/hatebu-audio.db');
  console.log(`Opening database at path: ${dbPath}`);
  return new sqlite3.Database(dbPath);
};

// 全てのエピソードを取得
export async function getAllEpisodes(): Promise<PodcastEpisode[]> {
  try {
    return await new Promise((resolve, reject) => {
      try {
        const db = getDb();
        db.all(
          `SELECT * FROM podcast_episodes WHERE is_published = 1 ORDER BY published_at DESC`,
          (err, rows: any[]) => {
            db.close();
            if (err) {
              reject(err);
            } else {
              const episodes: PodcastEpisode[] = rows.map((row) => ({
                id: row.id,
                merged_audio_file_id: row.merged_audio_file_id,
                title: row.title,
                description: row.description,
                source_bookmarks: JSON.parse(row.source_bookmarks || "[]"),
                published_at: row.published_at,
                duration: row.duration,
                file_size: row.file_size,
                storage_url: row.storage_url,
                is_published: row.is_published === 1,
              }));
              resolve(episodes);
            }
          }
        );
      } catch (innerError) {
        reject(innerError);
      }
    });
  } catch (error) {
    console.error('Error getting all episodes:', error);
    // データベース接続エラーの場合はダミーデータを返す
    return getDummyEpisodes();
  }
}

// エピソードIDの一覧を取得
export async function getAllEpisodeIds(): Promise<{ params: { id: string } }[]> {
  try {
    const episodes = await getAllEpisodes();
    return episodes.map((episode) => ({
      params: {
        id: episode.id?.toString() || '',
      },
    }));
  } catch (error) {
    console.error('Error getting episode IDs:', error);
    // ダミーエピソードからIDを取得
    const dummyEpisodes = getDummyEpisodes();
    return dummyEpisodes.map((episode) => ({
      params: {
        id: episode.id?.toString() || '',
      },
    }));
  }
}

// 特定のエピソードを取得
export async function getEpisodeById(id: string): Promise<PodcastEpisode | null> {
  try {
    return await new Promise((resolve, reject) => {
      const db = getDb();
      db.get(
        `SELECT * FROM podcast_episodes WHERE id = ?`,
        [id],
        (err, row: any) => {
          db.close();
          if (err) {
            reject(err);
          } else if (!row) {
            resolve(null);
          } else {
            const episode: PodcastEpisode = {
              id: row.id,
              merged_audio_file_id: row.merged_audio_file_id,
              title: row.title,
              description: row.description,
              source_bookmarks: JSON.parse(row.source_bookmarks || "[]"),
              published_at: row.published_at,
              duration: row.duration,
              file_size: row.file_size,
              storage_url: row.storage_url,
              is_published: row.is_published === 1,
            };
            resolve(episode);
          }
        }
      );
    });
  } catch (error) {
    console.error('Error getting episode by ID:', error);
    // ダミーエピソードから該当IDのエピソードを返す
    const dummyEpisodes = getDummyEpisodes();
    const dummyEpisode = dummyEpisodes.find(ep => ep.id?.toString() === id);
    return dummyEpisode || null;
  }
}

// Podcast設定を取得
export async function getPodcastSettings(): Promise<PodcastSettings | null> {
  try {
    return await new Promise((resolve, reject) => {
      try {
        const db = getDb();
        db.get(
          `SELECT * FROM podcast_settings ORDER BY id LIMIT 1`,
          (err, row: any) => {
            db.close();
            if (err) {
              reject(err);
            } else if (!row) {
              resolve(null);
            } else {
              const settings: PodcastSettings = {
                id: row.id,
                title: row.title,
                description: row.description,
                author: row.author,
                email: row.email,
                language: row.language,
                category: row.category,
                explicit: row.explicit === 1,
                image_url: row.image_url,
                website_url: row.website_url,
                feed_url: row.feed_url,
              };
              resolve(settings);
            }
          }
        );
      } catch (innerError) {
        reject(innerError);
      }
    });
  } catch (error) {
    console.error('Error getting podcast settings:', error);
    // データベース接続エラーの場合はダミーデータを返す
    return getDummyPodcastSettings();
  }
}

// ダミーデータを生成（ビルド時にデータベースが利用できない場合用）
export function getDummyEpisodes(): PodcastEpisode[] {
  return [
    {
      id: 1,
      merged_audio_file_id: 1,
      title: 'エピソード #1: はてなブックマークの最新トレンド',
      description: 'このエピソードでは、はてなブックマークで話題になっている最新のテクノロジートレンドについて解説します。',
      published_at: '2025-03-01T00:00:00.000Z',
      duration: 1200,
      file_size: 24000000,
      storage_url: 'https://example.com/episodes/1.mp3',
      is_published: true,
    },
    {
      id: 2,
      merged_audio_file_id: 2,
      title: 'エピソード #2: プログラミング言語の最新動向',
      description: 'このエピソードでは、プログラミング言語の最新動向について解説します。',
      published_at: '2025-03-08T00:00:00.000Z',
      duration: 1500,
      file_size: 30000000,
      storage_url: 'https://example.com/episodes/2.mp3',
      is_published: true,
    },
  ];
}

// ダミーのPodcast設定を生成（ビルド時にデータベースが利用できない場合用）
export function getDummyPodcastSettings(): PodcastSettings {
  return {
    id: 1,
    title: 'Yuhei Nakasakaのはてなブックマークラジオ',
    description: 'はてなブックマークの記事を要約して音声化したポッドキャスト',
    author: 'Yuhei Nakasaka',
    language: 'ja',
    category: 'Technology',
    explicit: false,
  };
}
