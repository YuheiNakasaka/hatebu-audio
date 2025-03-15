import React, { ReactNode } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Header from './Header';
import Footer from './Footer';
import styles from '../styles/Layout.module.css';

interface LayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
}

const Layout: React.FC<LayoutProps> = ({ children, title, description }) => {
  return (
    <div className={styles.container}>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description || 'はてなブックマークの記事を要約して音声化したポッドキャスト'} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        
        {/* OGP用メタタグ */}
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description || 'はてなブックマークの記事を要約して音声化したポッドキャスト'} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content={`${process.env.PODCAST_WEBSITE_URL || ''}/ogp.png`} />
        <meta property="og:url" content={process.env.PODCAST_WEBSITE_URL} />
        
        {/* Twitter Card用メタタグ */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description || 'はてなブックマークの記事を要約して音声化したポッドキャスト'} />
        <meta name="twitter:image" content={`${process.env.PODCAST_WEBSITE_URL || ''}/ogp.png`} />
      </Head>

      <Header />
      
      <main className={styles.main}>
        {children}
      </main>

      <Footer />
    </div>
  );
};

export default Layout;
