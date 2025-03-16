import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import styles from '../styles/AudioPlayer.module.css';

export interface AudioPlayerHandle {
  seekToTime: (timeString: string) => void;
}

interface AudioPlayerProps {
  audioUrl?: string;
  onTimeUpdate?: (time: number) => void;
}

const AudioPlayer = forwardRef<AudioPlayerHandle, AudioPlayerProps>(({ audioUrl, onTimeUpdate }, ref) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    const updateTime = () => {
      setCurrentTime(audio.currentTime);
      if (onTimeUpdate) {
        onTimeUpdate(audio.currentTime);
      }
    };
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioUrl, onTimeUpdate]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };
  
  const changePlaybackRate = (rate: number) => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;
    
    audio.playbackRate = rate;
    setPlaybackRate(rate);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    const newTime = parseFloat(e.target.value);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // 特定の時間位置に移動するメソッド
  const seekToTime = (timeString: string) => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;
    
    // "00:00:00" または "00:00" 形式の時間文字列をパース
    const parts = timeString.split(':').map(part => parseInt(part, 10));
    let seconds = 0;
    
    if (parts.length === 3) {
      // 時:分:秒形式
      seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      // 分:秒形式
      seconds = parts[0] * 60 + parts[1];
    }
    
    if (seconds >= 0 && seconds <= audio.duration) {
      audio.currentTime = seconds;
      setCurrentTime(seconds);
      if (!isPlaying) {
        audio.play();
        setIsPlaying(true);
      }
    }
  };
  
  // AudioPlayerの参照を外部に公開
  useImperativeHandle(ref, () => ({
    seekToTime
  }));

  if (!audioUrl) {
    return (
      <div className={styles.player}>
        <p className={styles.noAudio}>音声ファイルが利用できません</p>
      </div>
    );
  }

  return (
    <div className={styles.player}>
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      
      <div className={styles.controls}>
        <button onClick={togglePlay} className={styles.playButton}>
          {isPlaying ? '⏸️' : '▶️'}
        </button>
        
        <div className={styles.timeControls}>
          <span className={styles.time}>{formatTime(currentTime)}</span>
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            className={styles.progress}
          />
          <span className={styles.time}>{formatTime(duration)}</span>
        </div>
      </div>
      
      <div className={styles.playbackControls}>
        <div className={styles.playbackRateTitle}>再生速度:</div>
        <div className={styles.rateButtons}>
          {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((rate) => (
            <button
              key={rate}
              onClick={() => changePlaybackRate(rate)}
              className={`${styles.rateButton} ${playbackRate === rate ? styles.activeRate : ''}`}
            >
              {rate}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});

export default AudioPlayer;
