import React from "react";
import styles from "../styles/Footer.module.css";

const Footer: React.FC = () => {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <p className={styles.copyright}>
          &copy; {new Date().getFullYear()} はてなブックマークラジオ by{" "}
          <a href="https://x.com/razokulover" target="_blank" rel="noopener noreferrer">
            Yuhei Nakasaka
          </a>
        </p>
      </div>
    </footer>
  );
};

export default Footer;
