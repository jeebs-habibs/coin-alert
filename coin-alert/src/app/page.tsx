'use client'

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "./components/Button";
import styles from "./page.module.css";
import { useAuth } from "./providers/auth-provider";

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (user && !loading) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  return (
    <div className={styles.landingContainer}>
      <main className={styles.landingMain}>
        {loading ? (
          <div className={styles.loadingContainer}>
            <h1 className={styles.loadingText}>Loading...</h1>
          </div>
        ) : (
          <div className={styles.contentSections}>
            {/* Hero Section */}
            <section className={styles.heroSection}>
              <h1 className={styles.heroTitle}>
                Welcome to <span className={styles.heroTitleHighlight}>Siren</span>
              </h1>
              <p className={styles.heroDescription}>
                A mobile app to notify you on changes in your memecoins. No wallet connection required!
              </p>
              <Button
                onClick={() => router.push("/auth")}
                size="lg"
                variant="primary"
              >
                Get Started
              </Button>
            </section>

            {/* How It Works Section */}
            <section className={styles.howItWorksSection}>
              <div className={styles.card}>
                <h2 className={styles.howItWorks}>How It Works</h2>
                <ol className={styles.orderedList}>
                  <li>Sign up via Google</li>
                  <li>Enter up to 3 wallet addresses</li>
                  <li>Set up your notification preferences</li>
                  <li>Add app to your home screen on iOS to receive notifications</li>
                </ol>
              </div>
            </section>

            {/* Notifications Setup Section */}
            <section className={styles.notificationsSection}>
              <h2 className={styles.sectionTitle}>Setting Up Notifications</h2>
              <p className={styles.sectionDescription}>
                Siren alerts you on all devices when your coins change drastically in price. Follow these steps to ensure your devices are set up correctly.
              </p>
              <div className={styles.card}>
                <h3 className={styles.subsectionTitle}>Web/Mac/Windows</h3>
                <p className={styles.subsectionText}>
                  In your browser, go to <strong>Settings → Notifications</strong> and confirm notifications are enabled. You can enable notifications only for Siren if preferred.
                </p>
                <p className={styles.subsectionText}>
                  Check your system settings to ensure notifications are enabled for your browser.
                </p>
                <p className={styles.subsectionText}>
                  On Mac, ensure you’re not in Focus, Do Not Disturb, or another mode that may block notifications.
                </p>
              </div>
              <div className={styles.card}>
                <h3 className={styles.subsectionTitle}>Mobile</h3>
                <p className={styles.subsectionText}>
                  On iOS, open this page in Safari, tap the <strong>Share</strong> icon, and select <strong>Add to Home Screen</strong>. When you reopen the app, you’ll be prompted to enable notifications—select <strong>Yes</strong>. Customize notifications anytime in your device’s <strong>Notification Settings</strong> under the Siren app.
                </p>
              </div>
            </section>
          </div>
        )}
      </main>
      <a 
        href="https://x.com/siren_notify" 
        target="_blank" 
        rel="noopener noreferrer" 
        className={styles.xLink}
      >
        <svg 
          viewBox="0 0 24 24" 
          className={styles.xLogo}
          fill="white"
        >
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      </a>
    </div>
  );
}