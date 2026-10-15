import express, { Request, Response } from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import { DownloadItem } from './history';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 1500;

app.use(cors({
    origin: 'http://localhost:3000',
    methods: ['POST']
}));

app.use(express.json());

const TEMP_DIR = path.join(__dirname, 'temp_downloads');
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR);
}

app.post('/api/download', (req: Request, res: Response): any => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    const uniqueId = Date.now().toString();
    const outputPath = path.join(TEMP_DIR, `video_${uniqueId}.mp4`);

const downloadProcess = spawn('yt-dlp', [
    // 1. Try best under 100MB
    '-f', 'bestvideo[filesize_approx<=100M][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best', 
    '-o', outputPath, 
    url
], { shell: true });
    downloadProcess.on('error', (err) => {
        console.error(`Failed to start yt-dlp: ${err.message}`);
    });

    downloadProcess.stderr.on('data', (data) => {
        console.error(`yt-dlp log: ${data}`);
    });

    downloadProcess.on('close', (code) => {
        if (code === 0 && fs.existsSync(outputPath)) {

            res.download(outputPath, 'video.mp4', (err) => {
                // 4. Cleanup: Delete the file AFTER the user finishes downloading
                // (or if they cancel the download halfway)
                fs.unlink(outputPath, (unlinkErr) => {
                    if (unlinkErr) console.error(`Failed to delete ${outputPath}`, unlinkErr);
                });
            });
        } else {
             res.status(500).json({ error: 'Failed to process video' });
        }
    });

    req.on('close', () => {
        if (!res.headersSent) {
            console.log('Client aborted request. Killing yt-dlp...');
            downloadProcess.kill('SIGTERM');
            
            if (fs.existsSync(outputPath)) {
                fs.unlinkSync(outputPath);
            }
        }
    });
});

// const saveToHistory = (url: string, format: 'mp4' | 'mp3') => {
//   const existing: DownloadItem[] = JSON.parse(localStorage.getItem('download_history') || '[]');
  
//   const newItem: DownloadItem = {
//     id: crypto.randomUUID(),
//     url,
//     format,
//     timestamp: Date.now(),
//   };

//   const updated = [newItem, ...existing.filter(item => item.url !== url)].slice(0, 10);
//   localStorage.setItem('download_history', JSON.stringify(updated));
// };
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});