'use client'

import { FaSignInAlt, FaSignOutAlt  } from "react-icons/fa";
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
            className="p-4 flex items-center justify-center iconButton ml-auto"
            style={{backgroundColor: "red", marginLeft: "auto"}}
          >
            <FaSignOutAlt size={30} />
          </button>
      );
    } else if (loading) {
      authContent = <div className="spinner-border m-auto" role="status"></div>;
    } else {
      authContent = (
          <Link href="/auth" passHref style={{marginLeft: "auto"}}>
            <button
              className="p-4 flex items-center justify-center iconButton ml-auto"
              style={{marginLeft: "auto"}}
            >
             <FaSignInAlt size={30} />
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