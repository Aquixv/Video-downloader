import DownloadForm from '@/components/DownloadForm';
import HistoryPanel from '@/components/HistoryPanel';
import styles from './page.module.css';

export default function Home() {
  return (
    <main style={{ padding: '3rem 1.5rem', minHeight: '100vh' }}>
      
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem', marginTop: 0 }}>
          Media Downloader
        </h1>
        <p style={{ color: '#888', marginBottom: '0.5rem' }}>
          No accounts. No history stored on our servers.
        </p>
        <p style={{ color: '#ff5555', fontSize: '0.85rem', fontWeight: 500 }}>
         Note: TikTok photo gallery extraction is currently unavailable.
        </p>
      </div>

      {/* TWO-COLUMN LAYOUT */}
      <div className={styles.layoutWrapper}>
        <div className={styles.mainContent}>
          <DownloadForm />
        </div>
        
        <aside className={styles.sidebar}>
          <HistoryPanel />
        </aside>
      </div>
      
    </main>
  );
}