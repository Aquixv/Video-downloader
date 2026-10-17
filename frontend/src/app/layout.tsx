// import './globals.css'; // Optional: Keep this only if you didn't delete globals.css too!

export const metadata = {
  title: 'Plug & Play Downloader',
  description: 'Download videos locally without tracking.',
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