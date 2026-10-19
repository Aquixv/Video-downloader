import express, { Request, Response } from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import { DownloadItem } from './history';
import fs from 'fs';
import path from 'path';
import { error } from 'console';

const app = express();
const PORT = process.env.PORT || 1500;

app.use(cors({
  origin: '*',
  exposedHeaders: ['Content-Disposition'],
  methods: ['GET', 'POST', 'OPTIONS'],
}));

app.use(express.json());

const TEMP_DIR = path.join(__dirname, 'temp_downloads');
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR);
}
const scrapeYouTubePost = async (url: string) => {
    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        const html = await response.text();

        let images: string[] = [];
        const jsonMatch = html.match(/var ytInitialData = (\{.*?\});<\/script>/);
        
        if (jsonMatch && jsonMatch[1]) {
            const ytData = JSON.parse(jsonMatch[1]);
            const imageRegex = /"url":"(https:\/\/yt3\.ggpht\.com\/[a-zA-Z0-9_-]+-[a-zA-Z0-9_-]+-[a-zA-Z0-9_-]+)"/g;
            
            let match;
            while ((match = imageRegex.exec(jsonMatch[1])) !== null) {
                if (!images.includes(match[1])) {
                    images.push(match[1]);
                }
            }
        }

        if (images.length === 0) {
            const metaMatch = html.match(/<meta property="og:image" content="([^"]+)">/);
            if (metaMatch && metaMatch[1]) {
                images.push(metaMatch[1]);
            }
        }

        return images;
    } catch (error) {
        console.error('Scraping failed:', error);
        return [];
    }
};
// Added "async" and "Promise<any>" here
app.post('/api/download', async (req: Request, res: Response): Promise<any> => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    const uniqueId = Date.now().toString();
    const outputPath = path.join(TEMP_DIR, `video_${uniqueId}.mp4`);
    const galleryDir = path.join(TEMP_DIR, `gallery_${uniqueId}`);

    // --- ROUTE 1: YOUTUBE COMMUNITY POSTS (Custom Scraper) ---
    if (url.includes('youtube.com/post/')) {
        console.log('[ROUTER] YouTube Post detected. Running custom HTML scraper...');
        
        const imageUrls = await scrapeYouTubePost(url);
        
        if (imageUrls.length > 0) {
            return res.json({ type: 'gallery', images: imageUrls, isRawUrls: true });
        } else {
            return res.status(500).json({ error: 'Failed to extract images from post.' });
        }
    }

    // --- ROUTE 2: TIKTOK PHOTOS & REDDIT (gallery-dl) ---
    const isImageGallery = url.includes('tiktok.com/photo/') || url.includes('reddit.com/r/');

 if (isImageGallery) {
        console.log('[ROUTER] Image URL detected. Routing directly to gallery-dl...');
        
        const galleryProcess = spawn('gallery-dl', [
            '--dest', `"${galleryDir}"`,
            '--cookies-from-browser', 'edge',
            `"${url}"`
        ], { shell: true });

        galleryProcess.stdout.on('data', (data) => console.log(`[GALLERY-DL]: ${data.toString().trim()}`));
        galleryProcess.stderr.on('data', (data) => console.error(`[GALLERY-DL ERROR]: ${data.toString().trim()}`));

        galleryProcess.on('close', (code) => {
            if (code === 0 && fs.existsSync(galleryDir)) {
                try {
                    // Recursive file finder
                    const findFilesInDir = (dirPath: string): string[] => {
                        let results: string[] = [];
                        const list = fs.readdirSync(dirPath);
                        list.forEach((file) => {
                            const fullPath = path.join(dirPath, file);
                            if (fs.statSync(fullPath).isDirectory()) {
                                results = results.concat(findFilesInDir(fullPath));
                            } else {
                                results.push(fullPath);
                            }
                        });
                        return results;
                    };

                    const allFiles = findFilesInDir(galleryDir);
                    const imagesBase64 = allFiles.map(filePath => {
                        const base64 = fs.readFileSync(filePath, { encoding: 'base64' });
                        const ext = path.extname(filePath).replace('.', '') || 'jpeg';
                        return `data:image/${ext};base64,${base64}`;
                    });

                    fs.rmSync(galleryDir, { recursive: true, force: true });
                    return res.json({ type: 'gallery', images: imagesBase64 });
                } catch (err) {
                    console.error('[GALLERY ERROR]:', err);
                    return res.status(500).json({ error: 'Failed to process gallery images.' });
                }
            } else {
                return res.status(500).json({ error: 'Gallery extraction failed.' });
            }
        });

        return;
    }

    console.log('[ROUTER] Video URL suspected. Routing to yt-dlp...');
    const downloadProcess = spawn('yt-dlp', [
        '--cookies-from-browser', 'edge',
        '-S', 'vcodec:h264,res:720,acodec:m4a',
        '--merge-output-format', 'mp4',
        '-o', `"${outputPath}"`,
        `"${url}"`
    ], { shell: true });

    downloadProcess.stdout.on('data', (data) => console.log(`[YT-DLP]: ${data.toString().trim()}`));
    downloadProcess.stderr.on('data', (data) => console.error(`[YT-DLP ERROR]: ${data.toString().trim()}`));

    downloadProcess.on('close', (code) => {
        if (code === 0 && fs.existsSync(outputPath)) {
            res.download(outputPath, 'video.mp4', (err) => {
                fs.unlink(outputPath, (unlinkErr) => {
                    if (unlinkErr) console.error(`[CLEANUP ERROR] Failed to delete ${outputPath}`, unlinkErr);
                });
            });
        } else {
            res.status(500).json({ error: 'Failed to process video.' });
        }
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});