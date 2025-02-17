'use client'

import { useRouter } from "next/navigation";
import { signInWithGoogle, signOut } from "../lib/firebase/auth";
import { useAuth } from "../providers/auth-provider";
import GoogleButton from 'react-google-button'

export default function Auth(){
  const auth = useAuth()
  const router = useRouter()
  //const session = await getServerAuthSession();

  return (
    <div className="page">
      <div className="main">
        {
          !auth.user ?       <div>
          <h1 style={{margin: "10px"}}>Please sign in</h1>
          <GoogleButton onClick={signInWithGoogle}>Sign In with Google</GoogleButton>
        </div> : <>      
        <button className="button" onClick={() => router.push("/dashboard")}>My dashboard</button>
        <button className="removeButton" onClick={signOut}>Sign Out</button></>
        }

      </div>

    </div>
  )

}
