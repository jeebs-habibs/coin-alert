'use client'

import { useAuth } from "../providers/auth-provider";
import { signOut } from "../lib/firebase/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";

export const AppHeader = () => {
    const router = useRouter();
    const { user,loading } = useAuth();
  
    // Render the signed in experience.
    let authContent = null;
    if (user) {
      authContent = (
          <button 
            onClick={() => {
                signOut()
                router.push("/")
            }}
            className="flex items-center justify-center removeButton ml-auto"
            style={{marginLeft: "auto"}}
          >
            Sign out
          </button>
      );
    } else if (loading) {
      authContent = <div className="spinner-border m-auto" role="status"></div>;
    } else {
      authContent = (
          <Link href="/auth" passHref style={{marginLeft: "auto"}}>
            <button
              className="flex items-center justify-center button ml-auto"
              style={{marginLeft: "auto"}}
            >
             Sign in
            </button>
          </Link>
      );
    }
  
    return (
      <header>
        <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
          {authContent}
        </div>
      </header>
    );
  };