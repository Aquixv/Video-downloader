"use client"
import { useState } from "react";
import styles from './DownloadForm.module.css';

export default function DownloadForm() {
  type DownloadState = 'idle' | 'fetching_metadata' | 'selecting_quality' | 'downloading';
  
  const [status, setStatus] = useState<DownloadState>('idle');
  const [url, setUrl] = useState('');

  const handleDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    
    setStatus('downloading');
    try {
      const res = await fetch('http://localhost:1500/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      
      if (!res.ok) throw new Error('Download failed');
      
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = 'video.mp4';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);

      const existing = JSON.parse(localStorage.getItem('download_history') || '[]');
      const newItem = {
        id: crypto.randomUUID(),
        url,
        format: 'mp4',
        timestamp: Date.now(),
      };
      const updated = [newItem, ...existing.filter((item: any) => item.url !== url)].slice(0, 10);
      localStorage.setItem('download_history', JSON.stringify(updated));

      window.dispatchEvent(new Event('historyUpdated'));
    } catch (error) {
      console.error(error);
    } finally {
      setStatus('idle');
      setUrl(''); // Clears the input after completion
    }
  };

  return (
    <form onSubmit={handleDownload} className={styles.formContainer}>
      <input
        type="url"
        placeholder="Paste YouTube or TikTok link here..."
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        className={styles.inputField}
        required
      />
      <button 
        type="submit" 
        disabled={status !== 'idle'}
        className={styles.downloadBtn}
      >
        {status === 'downloading' ? 'Processing...' : 'Download'}
      </button>
      <p className={styles.disclaimer}>Max file size: 100MB. Larger videos will default to 720p.</p>
    </form>
  );
}