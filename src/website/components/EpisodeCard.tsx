import React from 'react';
import Link from 'next/link';
import { PodcastEpisode } from '../../types';
import styles from '../styles/EpisodeCard.module.css';

interface EpisodeCardProps {
  episode: PodcastEpisode;
}

const EpisodeCard: React.FC<EpisodeCardProps> = ({ episode }) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '00:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className={styles.card}>
      <Link href={`/episodes/${episode.id}`} className={styles.link}>
        <h2 className={styles.title}>{episode.title}</h2>
        <div className={styles.meta}>
          <span className={styles.date}>
            {episode.published_at ? formatDate(episode.published_at) : '公開日不明'}
          </span>
          <span className={styles.duration}>
            {formatDuration(episode.duration)}
          </span>
        </div>
        {episode.description && (
          <p className={styles.description}>{episode.description}</p>
        )}
      </Link>
    </div>
  );
};

export default EpisodeCard;
