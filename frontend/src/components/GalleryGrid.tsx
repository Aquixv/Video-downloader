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
      // Create a hidden, off-screen image element
      const img = new window.Image();
      
      img.onload = () => {
        // Create an off-screen canvas matching the image dimensions
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          // Fill a white background first (so transparent PNGs don't get black backgrounds)
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          // Paint the WebP/PNG image on top
          ctx.drawImage(img, 0, 0);
          
          // Force the browser to natively encode the canvas back out as a pure JPEG
          const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.95); // 0.95 = 95% quality
          
          // Trigger the download of the new JPG
          const a = document.createElement('a');
          a.href = jpegDataUrl;
          a.download = `photo_${index + 1}.jpg`;
          document.body.appendChild(a);
          a.click();
          a.remove();
        }
      };

      // Feed the Base64 string to the hidden image to kick off the conversion
      img.src = src;

    } catch (err) {
      console.error('Failed to convert and download image:', err);
    }
  };

  const handleDownloadAll = () => {
    images.forEach((img, idx) => {
      // Small staggering timeout prevents browsers from throttling bulk link triggers
      setTimeout(() => {
        triggerDownload(img, idx);
      }, idx * 2000);
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