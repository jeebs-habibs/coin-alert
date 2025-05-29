// import * as Google from 'expo-auth-session/providers/google';
// import { getAuth, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
// import { useEffect } from 'react';
// import { auth } from './firebase'; // matches your firebase.ts config

// export function useGoogleSignIn() {
//   const [request, response, promptAsync] = Google.useAuthRequest({
//     iosClientId: 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com',
//     androidClientId: 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com',
//     webClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
//   });

//   useEffect(() => {
//     if (response?.type === 'success') {
//       const { id_token } = response.authentication!;
//       const credential = GoogleAuthProvider.credential(id_token);
//       signInWithCredential(auth, credential)
//         .then(userCred => {
//           console.log('Firebase signed in!', userCred.user);
//         })
//         .catch(err => {
//           console.error('Firebase sign-in error:', err);
//         });
//     }
//   }, [response]);

//   return { request, response, promptAsync };
// }
