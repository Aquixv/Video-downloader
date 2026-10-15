import { z } from 'zod';

const DownloadRequestSchema = z.object({
  url: z.string().url("Must be a valid URL"),
  format: z.enum(['mp4', 'mp3']).optional().default('mp4'),
});