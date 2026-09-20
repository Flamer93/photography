import "./globals.css";

export const metadata = {
  title: "Photography — Firebase Hello World",
  description: "Next.js on Firebase App Hosting with Auth, Firestore and Storage",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
