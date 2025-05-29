import * as Google from 'expo-auth-session/providers/google';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { useEffect } from 'react';
import { Button, Text, View } from 'react-native';
import { auth } from '../lib/firebase';

export default function SignInScreen() {
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: '738018911031-rc2v6jq15enuhmj0ll0f3sv2i4jh2m1g.apps.googleusercontent.com',
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
