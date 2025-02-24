'use client'

import { useRouter } from "next/navigation";
import GoogleButton from 'react-google-button';
import { Button } from "../components/Button";
import { signInWithGoogle, signOut } from "../lib/firebase/auth";
import { useAuth } from "../providers/auth-provider";

export default function Auth(){
  const auth = useAuth()
  const router = useRouter()
  //const session = await getServerAuthSession();

  return (
    <div className="page">
      <div className="main">
        {
          !auth.user ?       <div>
          <h2 style={{margin: "10px"}}>Please sign in</h2>
          <GoogleButton onClick={signInWithGoogle}>Sign In with Google</GoogleButton>
        </div> : <>      
        <Button variant="primary" onClick={() => router.push("/dashboard")}>My dashboard</Button>
        <Button variant="danger" onClick={signOut}>Sign Out</Button></>
        }

      </div>

    </div>
  )

}
