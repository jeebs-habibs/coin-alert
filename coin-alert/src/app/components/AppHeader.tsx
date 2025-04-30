'use client';

import Image from "next/image";
import { CiSettings  } from "react-icons/ci";
import Link from "next/link";
import { useAuth } from "../providers/auth-provider";

export const AppHeader = () => {
  const { user } = useAuth();

  // Render the signed-in experience
  let authContent = null;
  if (user != null) {
    authContent = (
      <Link href="/settings" passHref>
        <CiSettings
          size={30}
          className="text-gray-600 hover:text-gray-800 cursor-pointer transition-colors"
          aria-label="Go to settings"
        />
      </Link>
    );
  }

  return (
    <header
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 16px', // Match container padding from your CSS
        maxWidth: '1400px', // Match your container max-width
        width: '100%',
        margin: '0 auto',
        boxSizing: 'border-box',
      }}
    >
      {/* Empty div to balance flex for space-between */}
      <div style={{ flex: 1 }}></div>

      {/* Centered logo */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <Link href={user != null ? "/dashboard" : "/"}>
          <Image
            src="/sirenLogo.png"
            alt="Siren Logo"
            width={50}
            height={50}
            priority
            style={{ cursor: 'pointer' }}
          />
        </Link>
      </div>

      {/* Settings icon on the right */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
        {authContent}
      </div>
    </header>
  );
};