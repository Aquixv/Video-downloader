import DownloadForm from '@/components/DownloadForm'
import HistoryPanel from '@/components/HistoryPanel';

export default function Home() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '0.5rem' }}>Plug & Play Downloader</h1>
      <p style={{ textAlign: 'center', color: '#888', marginBottom: '2rem' }}>
        No accounts. No history stored on our servers.
      </p>
      <DownloadForm />
      <HistoryPanel />
    </main>
  );
}