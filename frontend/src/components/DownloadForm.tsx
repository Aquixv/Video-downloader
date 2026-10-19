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
 // Inside your handleDownload function...
    const res = await fetch('http://localhost:1500/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    
    if (!res.ok) throw new Error('Download failed');

    const contentType = res.headers.get('content-type');

    if (contentType && contentType.includes('application/json')) {
      // IT'S A PHOTO GALLERY
      const data = await res.json();
      if (data.type === 'gallery') {
        console.log("Received gallery with", data.images.length, "images!");
        
        // Loop through the array and download each image
        data.images.forEach(async (imgSrc: string, index: number) => {
            try {
                let downloadUrl = imgSrc;
                
                // If it's a raw YouTube URL, we have to fetch it as a blob first 
                // so the browser downloads it instead of just opening it in a new tab
                if (data.isRawUrls) {
                    const imgRes = await fetch(imgSrc);
                    const imgBlob = await imgRes.blob();
                    downloadUrl = window.URL.createObjectURL(imgBlob);
                }

                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = `photo_${index + 1}.jpg`;
                document.body.appendChild(a);
                a.click();
                a.remove();

                if (data.isRawUrls) {
                    window.URL.revokeObjectURL(downloadUrl);
                }
            } catch (err) {
                console.error('Failed to trigger image download', err);
            }
        });
      }
    } else {
      // IT'S A VIDEO
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