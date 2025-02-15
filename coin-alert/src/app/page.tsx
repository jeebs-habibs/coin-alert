'use client'

import { useRouter } from "next/navigation";
import styles from "./page.module.css";
import { useAuth } from "./providers/auth-provider";
import { useEffect } from "react";

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();
  

  useEffect(() => {
    if(user && !loading){
      router.push("/dashboard")
    }
  })

  return (
    <div className={styles.page}>
      <main className={styles.main}>

{
  loading ? <h1>loading...</h1> :  <>
  <h1 className="largeHeading">
    Welcome to Siren
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
  <h3>Web/Mac/Windows</h3>
  <p>For web browsers, navigate to Settings → Notifications and confirm notifications are enabled. You can enable notifications only for CoinAlert if you so choose.</p>
  <p>Go to your system settings and confirm notifications are enabled for your browser.</p>
  <p>If on Mac you may be in Focus, Do Not Disturb or some other mode that is preventing you to enable notifications.</p>

  <h3>Mobile</h3>
  <p>On IOS, view this page on Safari and click the share icon. Click Add to Home Screen. Upon re-opening the app you will be prompted to enable notifications. Select yes. You can customize notifications anytime in your notification settings under the Siren app.</p>
  </>
}
       

      </main>

    </div>
  );
}
