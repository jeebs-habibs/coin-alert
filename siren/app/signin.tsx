import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { useEffect } from 'react';
import { Button, Text, View } from 'react-native';
import { auth } from '../lib/firebase';

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const [request, response, promptAsync] = Google.useAuthRequest({
    expoClientId: '<your-expo-client-id>.apps.googleusercontent.com',
    iosClientId: '<your-ios-client-id>.apps.googleusercontent.com',
    androidClientId: '<your-android-client-id>.apps.googleusercontent.com',
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token);
      signInWithCredential(auth, credential);
    }
  }, [response]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ marginBottom: 16 }}>Sign in to continue</Text>
      <Button
        title="Sign In with Google"
        disabled={!request}
        onPress={() => promptAsync()}
      />
    </View>
  );
}
