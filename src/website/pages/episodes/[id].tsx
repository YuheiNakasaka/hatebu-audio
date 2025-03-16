import { GetStaticPaths, GetStaticProps } from "next";
import Link from "next/link";
import { useRef } from "react";
import Layout from "../../components/Layout";
import AudioPlayer, { AudioPlayerHandle } from "../../components/AudioPlayer";
import styles from "../../styles/Episode.module.css";
import { PodcastEpisode, PodcastSettings } from "../../../types";
import {
  getAllEpisodeIds,
  getEpisodeById,
  getPodcastSettings,
  getDummyPodcastSettings,
} from "../../lib/api.server";

interface EpisodeProps {
  episode: PodcastEpisode;
  settings: PodcastSettings;
}

export default function Episode({ episode, settings }: EpisodeProps) {
  const audioPlayerRef = useRef<AudioPlayerHandle>(null);
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
    if (!dateString) return "公開日不明";
    const date = new Date(dateString);
    return date.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // タイムコードを検出してクリック可能なリンクに変換する関数
  const convertTimecodesToLinks = (text: string): string => {
    if (!text) return "";

    // HH:MM:SS または MM:SS 形式のタイムコードを検出する正規表現
    const timecodeRegex =
      /(\d{2}:\d{2}:\d{2}|\d{2}:\d{2})\s+(.*?)(?=\n\n|\n\d{2}:\d{2}|\n\d{2}:\d{2}:\d{2}|$)/g;

    return text.replace(timecodeRegex, (match, timecode, title) => {
      return `<a href="#" class="${styles.timecodeLink}" data-timecode="${timecode}">${timecode}</a> ${title}`;
    });
  };

  // タイムコードリンクのクリックイベントハンドラ
  const handleTimecodeClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;

    if (target.classList.contains(styles.timecodeLink)) {
      e.preventDefault();
      const timecode = target.getAttribute("data-timecode");

      if (timecode && audioPlayerRef.current) {
        audioPlayerRef.current.seekToTime(timecode);
      }
    }
  };

  return (
    <Layout title={`${episode.title} - ${settings.title}`} description={episode.description}>
      <div className={styles.container}>
        <h1 className={styles.title}>{episode.title}</h1>
        <span className={styles.date}>{formatDate(episode.published_at)}</span>

        <AudioPlayer ref={audioPlayerRef} audioUrl={episode.storage_url} />

        <div className={styles.description}>
          <h2>概要</h2>
          <div
            onClick={handleTimecodeClick}
            dangerouslySetInnerHTML={{ __html: convertTimecodesToLinks(episode.description || "") }}
          />
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
      fallback: false,
    };
  } catch (error) {
    console.error("Error generating paths:", error);
    return {
      paths: [],
      fallback: false,
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
    };
  } catch (error) {
    console.error("Error fetching episode:", error);
    return {
      notFound: true,
    };
  }
};
