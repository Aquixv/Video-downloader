'use client';

import React from 'react';
import styles from './GalleryGrid.module.css';
import { useState } from 'react';

interface GalleryGridProps {
  images: string[];
  isRawUrls?: boolean;
}

export default function GalleryGrid({ images, isRawUrls = false }: GalleryGridProps) {
  if (!images || images.length === 0) return null;

  const triggerDownload = async (src: string, index: number) => {
    try {
      let downloadUrl = src;
      let extension = 'jpg'; // Default fallback

      if (isRawUrls) {
        // Fetch the file to get the raw data
        const res = await fetch(src);
        const blob = await res.blob();
        
        // Ask the blob what its true format is (e.g., "image/webp")
        if (blob.type.includes('webp')) extension = 'webp';
        else if (blob.type.includes('png')) extension = 'png';
        else if (blob.type.includes('gif')) extension = 'gif';
        else extension = 'jpg';

        downloadUrl = window.URL.createObjectURL(blob);
      } else {
        // It's a Base64 string from gallery-dl (data:image/webp;base64,...)
        // We extract the format directly from the string header
        const mimeMatch = src.match(/data:image\/([a-zA-Z0-9]+);/);
        if (mimeMatch && mimeMatch[1]) {
          extension = mimeMatch[1] === 'jpeg' ? 'jpg' : mimeMatch[1];
        }
      }

      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `photo_${index + 1}.${extension}`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      if (isRawUrls) {
        window.URL.revokeObjectURL(downloadUrl);
      }
    } catch (err) {
      console.error('Failed to download image:', err);
    }
  };

  const handleDownloadAll = () => {
    images.forEach((img, idx) => {
      // Small staggering timeout prevents browsers from throttling bulk link triggers
      setTimeout(() => {
        triggerDownload(img, idx);
      }, idx * 1500);
    });
  };

  return (
    <section className={styles.galleryWrapper}>
      <div className={styles.headerRow}>
        <span className={styles.countText}>Found {images.length} Image{images.length > 1 ? 's' : ''}</span>
        <button className={styles.downloadAllBtn} onClick={handleDownloadAll}>
          Download All
        </button>
      </div>

      <div className={styles.grid}>
        {images.map((imgSrc, index) => (
          <div key={index} className={styles.card}>
            <div className={styles.imageWrapper}>
              <img
                src={imgSrc}
                alt={`Extracted photo ${index + 1}`}
                className={styles.previewImg}
                loading="lazy"
              />
            </div>
            <button
              className={styles.downloadSingleBtn}
              onClick={() => triggerDownload(imgSrc, index)}
            >
              Download
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}