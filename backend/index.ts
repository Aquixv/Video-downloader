import express, { Request, Response } from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import { DownloadItem } from './history';
import fs from 'fs';
import path from 'path';
const app = express();
const PORT = process.env.PORT || 1500;

app.use(cors({
  origin: '*',
  exposedHeaders: ['Content-Disposition'],
  methods: ['GET', 'POST', 'OPTIONS'],
}));

app.use(express.json());
app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});
const TEMP_DIR = path.join(__dirname, 'temp_downloads');
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR);
}

const createTempCookieFile = (cookieHeader: string, filePath: string) => {
    let fileContent = "# Netscape HTTP Cookie File\n";
    const cookies = cookieHeader.split(';');
    
    cookies.forEach(cookie => {
        const [name, ...rest] = cookie.trim().split('=');
        if (name && rest.length > 0) {
            const value = rest.join('=');
            const expiry = Math.floor(Date.now() / 1000) + 86400; // Expires in 24 hours
            fileContent += `.youtube.com\tTRUE\t/\tTRUE\t${expiry}\t${name}\t${value}\n`;
        }
    });
    
    fs.writeFileSync(filePath, fileContent);
};
const WRITABLE_COOKIE_PATH = path.join(TEMP_DIR, 'cookies.txt');
try {
    if (fs.existsSync('/etc/secrets/cookies.txt')) {
        fs.copyFileSync('/etc/secrets/cookies.txt', WRITABLE_COOKIE_PATH);
        console.log('[INIT] Copied secret cookies to writable temp directory.');
    }
} catch (err) {
    console.error('[INIT ERROR] Failed to copy cookies file:', err);
}
setInterval(() => {
    try {
        const files = fs.readdirSync(TEMP_DIR);
        const now = Date.now();
        
        files.forEach((file) => {
            const filePath = path.join(TEMP_DIR, file);
            const stats = fs.statSync(filePath);
            
            // If the file is older than 60 minutes (3600000 ms)
            if (now - stats.mtimeMs > 3600000) {
                fs.unlinkSync(filePath);
                console.log(`[CLEANUP] Deleted orphaned temp file: ${file}`);
            }
        });
    } catch (err) {
        console.error('[CLEANUP ERROR] Failed to run garbage collection:', err);
    }
}, 3600000);
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

            // Recursive hunter function
            const findImagesInJson = (obj: any): string[] => {
                let urls: string[] = [];
                
                if (Array.isArray(obj)) {
                    for (const item of obj) urls = urls.concat(findImagesInJson(item));
                } else if (typeof obj === 'object' && obj !== null) {
                    
                    // TARGET 1: Multi-Image Carousels
                    if (obj.postMultiImageRenderer && obj.postMultiImageRenderer.images) {
                        obj.postMultiImageRenderer.images.forEach((imgObj: any) => {
                            if (imgObj.backstageImageRenderer?.image?.thumbnails) {
                                const thumbs = imgObj.backstageImageRenderer.image.thumbnails;
                                const largest = thumbs[thumbs.length - 1]; // YouTube orders them smallest to largest
                                if (largest && largest.url) urls.push(largest.url);
                            }
                        });
                        return urls; // We found the carousel, stop digging this branch
                    }
                    
                    // TARGET 2: Single Image Posts
                    if (obj.backstageAttachment?.backstageImageRenderer?.image?.thumbnails) {
                        const thumbs = obj.backstageAttachment.backstageImageRenderer.image.thumbnails;
                        const largest = thumbs[thumbs.length - 1];
                        if (largest && largest.url) urls.push(largest.url);
                        return urls;
                    }

                    // Keep digging down the tree
                    for (const key of Object.keys(obj)) {
                        urls = urls.concat(findImagesInJson(obj[key]));
                    }
                }
                return urls;
            };

            images = findImagesInJson(ytData);
        }

        // The Meta Tag Fallback (just in case the JSON structure ever breaks)
        if (images.length === 0) {
            const metaMatch = html.match(/<meta property="og:image" content="([^"]+)">/);
            if (metaMatch && metaMatch[1]) {
                images.push(metaMatch[1]);
            }
        }

        // YouTube URLs sometimes omit the 'https:' prefix (e.g. "//yt3.ggpht.com/...")
        return images.map(img => img.startsWith('//') ? `https:${img}` : img);

    } catch (error) {
        console.error('Scraping failed:', error);
        return [];
    }
};
app.post('/api/download', async (req: Request, res: Response): Promise<any> => {
        const { url, cookieHeader } = req.body;
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
            console.log(`[ROUTER] Found ${imageUrls.length} images. Proxying sequentially to avoid 429...`);
            const imagesBase64 = [];

            for (let i = 0; i < imageUrls.length; i++) {
                try {
                    const imgRes = await fetch(imageUrls[i], {
                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
                    });
                    
                    if (imgRes.ok) {
                        const buffer = await imgRes.arrayBuffer();
                        const base64 = Buffer.from(buffer).toString('base64');
                        // YouTube serves these natively as WebP or JPEG
                        imagesBase64.push(`data:image/webp;base64,${base64}`);
                    }

                    // Force the backend to wait 800ms before asking YouTube for the next image
                    if (i < imageUrls.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 1600));
                    }
                } catch (err) {
                    console.error(`[PROXY ERROR] Failed to fetch image ${i + 1}`, err);
                }
            }

            // Send back the exact same Base64 format as the TikTok fallback
            // We no longer need isRawUrls: true!
            return res.json({ type: 'gallery', images: imagesBase64 });
        } else {
            return res.status(500).json({ error: 'Failed to extract images from post.' });
        }
    }

    // --- ROUTE 2: TIKTOK PHOTOS & REDDIT (gallery-dl) ---
    const isImageGallery = url.includes('tiktok.com/@') && url.includes('/photo/') || url.includes('reddit.com/r/');

 if (isImageGallery) {
        console.log('[ROUTER] Image URL detected. Routing directly to gallery-dl...');
        
        const galleryProcess = spawn('gallery-dl', [
            '--dest', `"${galleryDir}"`,
            '--cookies', `"${WRITABLE_COOKIE_PATH}"`,
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

                    // Inside your galleryProcess.on('close') block:
                        const allFiles = findFilesInDir(galleryDir);
                        
                        const imageFiles = allFiles.filter(file => {
                            const ext = path.extname(file).toLowerCase();
                            return ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);
                        });

                        // Isolate the background audio file if it exists
                        const audioFile = allFiles.find(file => {
                            const ext = path.extname(file).toLowerCase();
                            return ['.mp3', '.m4a', '.wav'].includes(ext);
                        });
                        
                        const imagesBase64 = imageFiles.map(filePath => {
                            const base64 = fs.readFileSync(filePath, { encoding: 'base64' });
                            const ext = path.extname(filePath).replace('.', '') || 'jpeg';
                            return `data:image/${ext};base64,${base64}`;
                        });

                        let audioBase64 = null;
                        if (audioFile) {
                            const base64 = fs.readFileSync(audioFile, { encoding: 'base64' });
                            const ext = path.extname(audioFile).replace('.', '') || 'mp3';
                            audioBase64 = `data:audio/${ext};base64,${base64}`;
                        }

                        fs.rmSync(galleryDir, { recursive: true, force: true });
                        
                        // Send both back
                        res.json({ type: 'gallery', images: imagesBase64, audio: audioBase64 });
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
    
    const uniqueCookiePath = path.join(TEMP_DIR, `cookie_${uniqueId}.txt`);

    const ytDlpArgs = [
        '-S', 'vcodec:h264,res:720,acodec:m4a',
        '--merge-output-format', 'mp4',
        '--js-runtime', 'deno', 
        '--impersonate', 'chrome', // Spoofs Chrome TLS fingerprint via curl-cffi
        '--extractor-args', '"youtube:player_client=ios,tv"', 
        '--no-playlist',
        '-o', `"${outputPath}"`
    ];

    // Simply append the URL; no cookie branching needed
    ytDlpArgs.push(`"${url}"`);

    if (cookieHeader) {
        console.log('[YT-DLP] Converting live browser cookies to temp file...');
        createTempCookieFile(cookieHeader, uniqueCookiePath);
        ytDlpArgs.push('--cookies', `"${uniqueCookiePath}"`);
    } else {
        console.log('[YT-DLP] Falling back to static cookies.txt');
        ytDlpArgs.push('--cookies', `"${WRITABLE_COOKIE_PATH}"`);
    }

    ytDlpArgs.push(`"${url}"`);

    const downloadProcess = spawn('yt-dlp', ytDlpArgs, { shell: true });

    downloadProcess.stdout.on('data', (data) => console.log(`[YT-DLP]: ${data.toString().trim()}`));
    downloadProcess.stderr.on('data', (data) => console.error(`[YT-DLP ERROR]: ${data.toString().trim()}`));

    downloadProcess.on('close', (code) => {
        // Clean up the temporary cookie file immediately after the process ends
        if (fs.existsSync(uniqueCookiePath)) {
            fs.unlinkSync(uniqueCookiePath);
        }

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
app.post('/api/audio', (req: Request, res: Response): any => {
    const { url, cookieHeader } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    const uniqueId = Date.now().toString();
    const outputPath = path.join(TEMP_DIR, `audio_${uniqueId}.mp3`);

    const audioArgs = [
        '-x', '--audio-format', 'mp3',
        '--js-runtime', 'deno', 
        '--impersonate', 'chrome',
        '--extractor-args', '"youtube:player_client=ios,tv"', 
        '--no-playlist',
        '-o', `"${outputPath}"`
    ];
    audioArgs.push(`"${url}"`);

    if (cookieHeader) {
        audioArgs.push('--add-header', `"Cookie: ${cookieHeader}"`);
    } else {
        audioArgs.push('--cookies', `"${WRITABLE_COOKIE_PATH}"`);
    }

    audioArgs.push(`"${url}"`);

    const audioProcess = spawn('yt-dlp', audioArgs, { shell: true });

    audioProcess.on('close', (code) => {
        if (code === 0 && fs.existsSync(outputPath)) {
            res.download(outputPath, 'audio.mp3', () => {
                fs.unlink(outputPath, () => {});
            });
        } else {
            res.status(500).json({ error: 'Failed to extract audio.' });
        }
    });
});
app.listen(PORT as number, '0.0.0.0', () => {
    console.log(`[SERVER] Running and bound to 0.0.0.0 on port ${PORT}`);
});