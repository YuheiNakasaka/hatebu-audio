import { GetStaticProps } from 'next';
import Layout from '../components/Layout';
import EpisodeCard from '../components/EpisodeCard';
import styles from '../styles/Home.module.css';
import { PodcastEpisode, PodcastSettings } from '../../types';
import { getAllEpisodes, getPodcastSettings, getDummyEpisodes, getDummyPodcastSettings } from '../lib/api';

interface HomeProps {
  episodes: PodcastEpisode[];
  settings: PodcastSettings;
}

export default function Home({ episodes, settings }: HomeProps) {
  return (
    <Layout title={settings.title} description={settings.description}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>{settings.title}</h1>
          {settings.description && (
            <p className={styles.description}>{settings.description}</p>
          )}
        </div>
        
        <div className={styles.episodeGrid}>
          {episodes.length > 0 ? (
            episodes.map((episode) => (
              <EpisodeCard key={episode.id} episode={episode} />
            ))
          ) : (
            <p>エピソードがまだありません。</p>
          )}
        </div>
      </div>
    </Layout>
  );
}

export const getStaticProps: GetStaticProps = async () => {
  try {
    // データベースからエピソードと設定を取得
    const episodes = await getAllEpisodes();
    const settings = await getPodcastSettings();
    
    return {
      props: {
        episodes: episodes || [],
        settings: settings || getDummyPodcastSettings(),
      }
    };
  } catch (error) {
    console.error('Error fetching data:', error);
    
    // エラー時はダミーデータを使用
    return {
      props: {
        episodes: getDummyEpisodes(),
        settings: getDummyPodcastSettings(),
      },
    };
  }
};
