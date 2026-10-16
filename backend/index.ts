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

app.post('/api/download', (req: Request, res: Response): any => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    const uniqueId = Date.now().toString();
    const outputPath = path.join(TEMP_DIR, `video_${uniqueId}.mp4`);

    const downloadProcess = spawn('yt-dlp', [
        '--cookies-from-browser', 'chrome',
        '-S', 'vcodec:h264,res:720,acodec:m4a',
        '--merge-output-format', 'mp4',
        '-o', `"${outputPath}"`,
        `"${url}"`
    ], { shell: true });

    downloadProcess.stdout.on('data', (data) => {
        console.log(`[YT-DLP OUTPUT]: ${data.toString().trim()}`);
    });

    downloadProcess.stderr.on('data', (data) => {
        console.error(`[YT-DLP ERROR]: ${data.toString().trim()}`);
    });

    downloadProcess.on('close', (code) => {
        console.log(`[PROCESS CLOSED] Exited with code ${code}`);
        
        if (code === 0 && fs.existsSync(outputPath)) {
            res.download(outputPath, 'video.mp4', (err) => {
                fs.unlink(outputPath, (unlinkErr) => {
                    if (unlinkErr) console.error(`[CLEANUP ERROR] Failed to delete ${outputPath}`, unlinkErr);
                });
            });
        } else {
            res.status(500).json({ error: 'Failed to process video. Check terminal logs.' });
        }
    });
    
    // The req.on('close') assassination block has been completely deleted.
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