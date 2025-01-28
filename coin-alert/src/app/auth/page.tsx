'use client'

import { signIn } from "next-auth/react";

export default async function Auth(){
  console.log("Inside auth page")
  //const session = await getServerAuthSession();

  const handleSignIn = async () => {
    await signIn('google');
  };

  if (true) {
    return (
      <div>
        <h1>Please sign in</h1>
        <button onClick={handleSignIn}>Sign In with Google</button>
      </div>
    );
  }

}
