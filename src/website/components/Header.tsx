import React from 'react';
import Link from 'next/link';
import styles from '../styles/Header.module.css';

const Header: React.FC = () => {
  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <Link href="/" className={styles.logo}>
          はてなブックマークラジオ
        </Link>
        <nav className={styles.nav}>
          <Link href="/" className={styles.navLink}>
            エピソード一覧
          </Link>
          <Link href="/feed.xml" className={styles.navLink}>
            RSSフィード
          </Link>
        </nav>
      </div>
    </header>
  );
};

export default Header;
