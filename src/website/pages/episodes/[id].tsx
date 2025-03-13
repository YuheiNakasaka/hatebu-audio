import { GetStaticPaths, GetStaticProps } from 'next';
import Link from 'next/link';
import Layout from '../../components/Layout';
import AudioPlayer from '../../components/AudioPlayer';
import styles from '../../styles/Episode.module.css';
import { PodcastEpisode, PodcastSettings } from '../../../types';
import {
  getAllEpisodeIds,
  getEpisodeById,
  getPodcastSettings,
  getDummyPodcastSettings,
} from '../../lib/api';

interface EpisodeProps {
  episode: PodcastEpisode;
  settings: PodcastSettings;
}

export default function Episode({ episode, settings }: EpisodeProps) {
  if (!episode) {
    return (
      <Layout title="エピソードが見つかりません" description="エピソードが見つかりません">
        <div className={styles.container}>
          <h1>エピソードが見つかりません</h1>
          <Link href="/" className={styles.backLink}>
            ← トップページに戻る
          </Link>
        </div>
      </Layout>
    );
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '公開日不明';
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <Layout title={`${episode.title} - ${settings.title}`} description={episode.description}>
      <div className={styles.container}>
        <h1 className={styles.title}>{episode.title}</h1>
        <span className={styles.date}>
          {formatDate(episode.published_at)}
        </span>
        
        <AudioPlayer audioUrl={episode.storage_url} />
        
        <div className={styles.description}>
          <h2>概要</h2>
          <p>{episode.description}</p>
        </div>
        
        <Link href="/" className={styles.backLink}>
          ← トップページに戻る
        </Link>
      </div>
    </Layout>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  try {
    const paths = await getAllEpisodeIds();
    return {
      paths,
      fallback: 'blocking',
    };
  } catch (error) {
    console.error('Error generating paths:', error);
    return {
      paths: [],
      fallback: 'blocking',
    };
  }
};

export const getStaticProps: GetStaticProps = async ({ params }) => {
  try {
    const id = params?.id as string;
    const episode = await getEpisodeById(id);
    const settings = await getPodcastSettings();
    
    if (!episode) {
      return {
        notFound: true,
      };
    }
    
    return {
      props: {
        episode,
        settings: settings || getDummyPodcastSettings(),
      },
      revalidate: 3600, // 1時間ごとに再生成
    };
  } catch (error) {
    console.error('Error fetching episode:', error);
    return {
      notFound: true,
    };
  }
};
