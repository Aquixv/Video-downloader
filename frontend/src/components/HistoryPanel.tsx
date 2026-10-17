'use client';

import { useEffect, useState } from 'react';
import styles from './HistoryPanel.module.css';

export interface DownloadItem {
  id: string;
  url: string;
  format: string;
  timestamp: number;
}

export default function HistoryPanel() {
  const [history, setHistory] = useState<DownloadItem[]>([]);

  const loadHistory = () => {
    const stored = JSON.parse(localStorage.getItem('download_history') || '[]');
    setHistory(stored);
  };

  useEffect(() => {
    loadHistory();
    // Listen for the custom event emitted by DownloadForm
    window.addEventListener('historyUpdated', loadHistory);
    return () => window.removeEventListener('historyUpdated', loadHistory);
  }, []);

  if (history.length === 0) return null;

  return (
    <div className={styles.panel}>
      <h3 className={styles.heading}>Recent Downloads</h3>
      <ul className={styles.list}>
        {history.map((item) => (
          <li key={item.id} className={styles.item}>
            <div className={styles.details}>
              <span className={styles.url} title={item.url}>{item.url}</span>
              <span className={styles.date}>
                {new Date(item.timestamp).toLocaleDateString()}
              </span>
            </div>
            <button 
              className={styles.reDownloadBtn}
              onClick={() => navigator.clipboard.writeText(item.url)}
            >
              Copy Link
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}