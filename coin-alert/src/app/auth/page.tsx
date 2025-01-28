'use client'

import { useRouter } from "next/navigation";
import { signInWithGoogle, signOut } from "../lib/firebase/auth";
import { useAuth } from "../providers/auth-provider";

export default function Auth(){
  console.log("Inside auth page")
  const auth = useAuth()
  const router = useRouter()
  //const session = await getServerAuthSession();

  if (!auth.user) {
    return (
      <div>
        <h1>Please sign in</h1>
        <button onClick={signInWithGoogle}>Sign In with Google</button>
      </div>
    );
  }
  return (
    <div>
      <button onClick={() => router.push("/dashboard")}>My dashboard</button>
      <button onClick={signOut}>Sign Out</button>
    </div>
  )

}
