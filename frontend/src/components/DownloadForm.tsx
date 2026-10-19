"use client"
import { useState } from 'react';
import GalleryGrid from './GalleryGrid';
import styles from './DownloadForm.module.css';

export default function DownloadForm() {
  type DownloadState = 'idle' | 'fetching_metadata' | 'selecting_quality' | 'downloading';
  
  const [status, setStatus] = useState<DownloadState>('idle');
  const [url, setUrl] = useState('');
  const [galleryData, setGalleryData] = useState<{ images: string[]; isRawUrls: boolean } | null>(null);

  const handleDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setStatus('downloading');
    setGalleryData(null); // Reset previous gallery if any

    try {
      const res = await fetch('http://localhost:1500/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      if (!res.ok) throw new Error('Download request failed');

      const contentType = res.headers.get('content-type');

      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.type === 'gallery') {
          setGalleryData({
            images: data.images,
            isRawUrls: Boolean(data.isRawUrls)
          });
        }
      } else {
        // Video handling
        const blob = await res.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = 'video.mp4';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(blobUrl);
      }

      // Update history in localStorage
      const existing = JSON.parse(localStorage.getItem('download_history') || '[]');
      const newItem = {
        id: crypto.randomUUID(),
        url,
        format: contentType?.includes('application/json') ? 'gallery' : 'mp4',
        timestamp: Date.now(),
      };
      const updated = [newItem, ...existing.filter((item: any) => item.url !== url)].slice(0, 10);
      localStorage.setItem('download_history', JSON.stringify(updated));
      window.dispatchEvent(new Event('historyUpdated'));

    } catch (error) {
      console.error(error);
    } finally {
      setStatus('idle');
      setUrl('');
    }
  };

  return (
    <>
      <form onSubmit={handleDownload} className={styles.formContainer}>
        <input
          type="url"
          placeholder="Paste YouTube, TikTok, or photo link..."
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
          {status === 'downloading' ? 'Extracting...' : 'Download'}
        </button>
        <p className={styles.disclaimer}>Videos output as MP4. Galleries generate an image grid.</p>
      </form>

      {galleryData && (
        <GalleryGrid
          images={galleryData.images}
          isRawUrls={galleryData.isRawUrls}
        />
      )}
    </>
  );
}