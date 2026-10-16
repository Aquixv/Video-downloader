import { spawn } from 'child_process';

const url = "https://youtu.be/xPEr4jxDXLM";
console.log(`Starting yt-dlp download for: ${url} ...\n`);

const downloadProcess = spawn('yt-dlp', [
    '--cookies-from-browser', 'chrome',
    '-S', 'vcodec:h264,res:720,acodec:m4a',
    '--merge-output-format', 'mp4',
    '-o', 'debug_test.mp4',
    url
], { shell: true });

downloadProcess.stdout.on('data', (data) => {
    console.log(`[STDOUT]: ${data.toString().trim()}`);
});

downloadProcess.stderr.on('data', (data) => {
    console.error(`[STDERR]: ${data.toString().trim()}`);
});

downloadProcess.on('error', (err) => {
    console.error(`[CRITICAL SPAWN ERROR]:`, err);
});

downloadProcess.on('close', (code) => {
    console.log(`\n[PROCESS FINISHED] Exited with code ${code}`);
});