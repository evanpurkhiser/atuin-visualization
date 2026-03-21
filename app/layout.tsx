import './globals.css';

import type {Metadata} from 'next';

export const metadata: Metadata = {
  title: 'Atuin Visualization',
  description: 'Shell history contribution graph',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-black text-white antialiased">{children}</body>
    </html>
  );
}
