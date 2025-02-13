'use client'

import Image from "next/image";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

export default function Home() {
  const router = useRouter();
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1>
          Welcome to CoinAlert
        </h1>
        <p>A mobile app to notify you on changes in your memecoins. No wallet connection required!</p>
        <h2>How it works</h2>
        <ol>
          <li>
            Sign up via Google
          </li>
          <li>
            Enter up to 3 wallet addresses
          </li>
          <li>
            Set up your notification preferences
          </li>
          <li>
            App app to your home screen on IOS to receive notifications
          </li>
        </ol>
        <button
      onClick={() => router.push("/auth")}
      className="button">
        Get started
      </button>
        <h2>Setting up notifications</h2>
        <p>CoinAlert will alert you on all devices when your coins change drastically in price. Below are checks to ensure your devices are properly set up to receive notifications.</p>
        <h3>Web/Mac/Desktop</h3>
        <p>For web browsers, navigate to Settings  Notifications and confirm notifications are enabled. You can enable notifications only for CoinAlert if you so choose.</p>
        <p>Go to your system settings and confirm notifications are enabled for your browser.</p>
        <p>If on Mac you may be in Focus or some other Do Not Disturb mode, which in this case you will only receive criticial alerts</p>

        <h3>Mobile</h3>
        <p>...</p>



      </main>
      <footer className={styles.footer}>
        <a
          href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/file.svg"
            alt="File icon"
            width={16}
            height={16}
          />
          Learn
        </a>
        <a
          href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/window.svg"
            alt="Window icon"
            width={16}
            height={16}
          />
          Examples
        </a>
        <a
          href="https://nextjs.org?utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/globe.svg"
            alt="Globe icon"
            width={16}
            height={16}
          />
          Go to nextjs.org →
        </a>
      </footer>
    </div>
  );
}
