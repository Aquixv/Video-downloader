"use client"
import { useState } from 'react';
import GalleryGrid from './GalleryGrid';
import styles from './DownloadForm.module.css';

export default function DownloadForm() {
  type DownloadState = 'idle' | 'fetching' | 'success';
  
  const [status, setStatus] = useState<DownloadState>('idle');
  const [url, setUrl] = useState('');
  
  // New States for in-page previews
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [galleryData, setGalleryData] = useState<{ images: string[]; audio?: string | null } | null>(null);

  const handleFetch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setStatus('fetching');
    setGalleryData(null);
    setVideoPreview(null);

    try {
      const res = await fetch('https://video-downloader-jjay.onrender.com/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      if (!res.ok) throw new Error('Request failed');

      const contentType = res.headers.get('content-type');

      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.type === 'gallery') {
          setGalleryData({ images: data.images, audio: data.audio });
        }
      } else {
        // Create a local blob URL and set it to state INSTEAD of auto-downloading
        const blob = await res.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        setVideoPreview(blobUrl);
      }
      
// 1. Determine format type for the UI
      const formatType = contentType && contentType.includes('application/json') ? 'gallery' : 'mp4';
      
      // 2. Retrieve the existing history array
      const existing = JSON.parse(localStorage.getItem('download_history') || '[]');
      
      // 3. Create the new entry
      const newItem = {
        id: crypto.randomUUID(),
        url,
        format: formatType,
        timestamp: Date.now(),
      };
      
      // 4. Push new item to the front, filter out older duplicates of the same URL, and cap at 10 items
      const updated = [newItem, ...existing.filter((item: any) => item.url !== url)].slice(0, 10);
      
      localStorage.setItem('download_history', JSON.stringify(updated));
      
      // 5. Fire the custom event so your new HistoryPanel sidebar updates instantly
      window.dispatchEvent(new Event('historyUpdated'));

    } catch (error) {
      console.error(error);
    } finally {
      setStatus('success');
    }
  };

  // Dedicated function for the new Audio route
  const handleExtractAudio = async () => {
    try {
      const res = await fetch('https://video-downloader-jjay.onrender.com/api/audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = 'extracted_audio.mp3';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Audio extraction failed', error);
    }
  };

  return (
    <>
      <form onSubmit={handleFetch} className={styles.formContainer}>
        <input
          type="url"
          placeholder="Paste YouTube, TikTok, or photo link..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className={styles.inputField}
          required
        />
        <button type="submit" disabled={status === 'fetching'} className={styles.downloadBtn}>
          {status === 'fetching' ? 'Processing...' : 'Load Media'}
        </button>
      </form>

      {/* IN-PAGE VIDEO PREVIEW */}
      {videoPreview && (
        <div style={{ maxWidth: '800px', margin: '2rem auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <video src={videoPreview} controls style={{ width: '100%', borderRadius: '8px', background: '#000' }} />
          
          <div style={{ display: 'flex', gap: '1rem' }}>
            {/* Native anchor download using the blob URL */}
            <a href={videoPreview} download="video.mp4" style={{ flex: 1 }}>
              <button className={styles.downloadBtn} style={{ width: '100%' }}>Download Video</button>
            </a>
            
            <button className={styles.downloadBtn} style={{ flex: 1, background: '#333' }} onClick={handleExtractAudio}>
              Extract Audio (MP3)
            </button>
          </div>
        </div>
      )}

      {/* IN-PAGE GALLERY & TIKTOK AUDIO PREVIEW */}
      {galleryData && (
        <div style={{ maxWidth: '800px', margin: '2rem auto' }}>
          {galleryData.audio && (
            <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#111', borderRadius: '8px' }}>
              <p style={{ margin: '0 0 0.5rem 0', fontWeight: 500 }}>Background Audio:</p>
              <audio src={galleryData.audio} controls style={{ width: '100%' }} />
            </div>
          )}
          <GalleryGrid images={galleryData.images} />
        </div>
      )}
    </>
  );
}