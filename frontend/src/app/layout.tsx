import './globals.css';

export const metadata = {
  title: 'Media Downloader',
  description: 'Download videos locally without watermark',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}