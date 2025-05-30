import { useAuthRequest } from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { GoogleAuthProvider, onAuthStateChanged, signInWithCredential } from 'firebase/auth';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Image, StyleSheet, TextInput, View } from 'react-native';
import { Button, Icon, Text } from 'react-native-elements';
import { auth } from '../lib/firebase';



WebBrowser.maybeCompleteAuthSession();

// Replace this with your real Firebase Web Client ID from Google Sign-In provider
const CLIENT_ID = '738018911031-vp60on8brljuoubnfe6dhti3jerghu7e.apps.googleusercontent.com';

const TIERS = [
  { label: 'Basic', value: 'basic', price: '$9.99/mo' },
  { label: 'Pro', value: 'pro', price: '$49.99/mo' }
];

export default function OnboardingScreen({ onComplete }: { onComplete?: () => void }) {
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
    // Tier selection state
  const [selectedTier, setTier] = useState(0);
  // Referral state
  const [referral, setReferral] = useState('');

  const [step, setStep] = useState(0); // 0 = auth, 1 = tier, 2 = referral

  
  const [request, response, promptAsync] = useAuthRequest({
    clientId: '738018911031-vp60on8brljuoubnfe6dhti3jerghu7e.apps.googleusercontent.com',
    iosClientId: '738018911031-vp60on8brljuoubnfe6dhti3jerghu7e.apps.googleusercontent.com',
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token);
      signInWithCredential(auth, credential)
        .then(() => console.log('User signed in'))
        .catch((err) => console.error('Firebase sign-in error:', err));
    }
  }, [response]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log(`Logged in as ${user.email}`);
      } else {
        console.log('User logged out');
      }
    });
    return unsubscribe;
  }, []);



  React.useEffect(() => {
    if (onComplete && step > 2) onComplete();
  }, [step, onComplete]);
  const handleReferralSubmit = () => {
    // TODO: Call backend to validate referral, then proceed to checkout if Pro
    if (onComplete) onComplete();
  };

  const handleNext = () => setStep((prev) => Math.min(prev + 1, 2));
  const handleBack = () => setStep((prev) => Math.max(prev - 1, 0));

  // Animation refs
  const logoAnim = useRef(new Animated.Value(0)).current;
  const introAnim = useRef(new Animated.Value(0)).current;
  const formAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Staggered fade/slide in for logo, intro, then form
    Animated.sequence([
      Animated.timing(logoAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(introAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(formAnim, { toValue: 1, duration: 500, useNativeDriver: true })
    ]).start();
  }, [logoAnim, introAnim, formAnim]);

  return (
    <View style={styles.container}>
      {step === 0 && (
        <>
          {/* Siren Title at Top - absolutely at the top */}
          <Animated.View style={{
            opacity: logoAnim,
            position: 'absolute',
            top: 44,
            left: 0,
            right: 0,
            alignItems: 'center',
            zIndex: 10,
          }}>
            <Text style={[styles.appName, { fontSize: 40 }]}>Siren</Text>
          </Animated.View>
          {/* Trader Image */}
          <Animated.View style={{ opacity: introAnim, alignItems: 'center', marginBottom: 28, marginTop: 60 }}>
            <Image source={require('../assets/images/trader.jpg')} style={{ width: 180, height: 180, borderRadius: 18, marginBottom: 8 }} resizeMode="cover" />
          </Animated.View>
          {/* Welcome Title & Description */}
          <Animated.View style={{ opacity: introAnim, marginBottom: 24, alignItems: 'center' }}>
            <Text style={{ fontSize: 28, fontWeight: 'bold', marginBottom: 10, fontFamily: 'LexendMega' }}>Welcome to Siren</Text>
            <Text style={{ fontSize: 16, color: '#333', textAlign: 'center', opacity: 0.85, marginBottom: 6, fontFamily: 'LexendMega', lineHeight: 26 }}>
              The first Solana memecoin notification platform. Add your trading wallets and get realtime alerts when your coins move in price.
            </Text>
          </Animated.View>
          {/* Sign Up Button */}
          <Animated.View style={{ opacity: formAnim, width: '100%' }}>
            <Button
              title="Sign Up"
              buttonStyle={styles.primaryButton}
              titleStyle={{ fontWeight: 'bold', fontSize: 18 }}
              containerStyle={{ marginBottom: 18, borderRadius: 24 }}
              onPress={() => promptAsync()}
            />
            {/* Log In Text */}
            <Text
              style={{
                textAlign: 'center',
                textDecorationLine: 'underline',
                fontWeight: 'bold',
                fontSize: 16,
                marginBottom: 12,
                fontFamily: 'LexendMega',
              }}
              onPress={() => {/* TODO: handle login nav */}}
            >
              Log In
            </Text>
          </Animated.View>
        </>
      )}
      {step === 1 && (
        <>
          <Text h4 style={{ textAlign: 'center', marginBottom: 18 }}>Select Your Plan</Text>
          <View style={{ width: '100%', marginBottom: 18 }}>
            {TIERS.map((tier, idx) => (
              <Button
                key={tier.value}
                title={`${tier.label} (${tier.price})`}
                onPress={() => setTier(idx)}
                buttonStyle={selectedTier === idx ? styles.selectedTierButton : styles.tierButton}
                titleStyle={{ color: selectedTier === idx ? '#fff' : '#007aff', fontWeight: 'bold' }}
                containerStyle={{ marginBottom: 10 }}
              />
            ))}
          </View>
          <Button
            icon={<Icon name="chevron-right" type="feather" color="#fff" />}
            title="Continue"
            buttonStyle={styles.primaryButton}
          />
          <Button
            icon={<Icon name="chevron-left" type="feather" color="#007aff" />}
            title="Back"
            type="clear"
            onPress={handleBack}
            buttonStyle={{ marginTop: 12 }}
          />
        </>
      )}
      {step === 2 && (
        <>
          <Text h4 style={{ textAlign: 'center', marginBottom: 18 }}>Referral Code</Text>
          <View style={{ width: '100%', marginBottom: 18 }}>
            <TextInput
              placeholder="Enter referral code (optional)"
              value={referral}
              onChangeText={setReferral}
              style={styles.textInput}
              placeholderTextColor="#aaa"
            />
          </View>
          <Button title="Continue" onPress={handleReferralSubmit} buttonStyle={styles.primaryButton} />
          <Button
            icon={<Icon name="chevron-left" type="feather" color="#007aff" />}
            title="Back"
            type="clear"
            onPress={handleBack}
            buttonStyle={{ marginTop: 12 }}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: Dimensions.get('window').width,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    // Optional: background gradient or pattern can go here
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 28,
  },
  logoCircle: {
    backgroundColor: '#f2f6ff',
    borderRadius: 60,
    padding: 16,
    elevation: 4,
    shadowColor: '#007aff',
    shadowOpacity: 0.13,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    marginBottom: 8,
  },
  logo: {
    width: 90,
    height: 90,
  },
  appName: {
    fontSize: 36,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 2,
    marginBottom: 6,
    fontFamily: 'LexendMega',
  },
  subtitle: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 2,
    opacity: 0.85,
    fontWeight: '500',
    fontFamily: 'LexendMega',
  },
  formCard: {
    width: '100%',
    borderRadius: 18,
    padding: 22,
    elevation: 5,
    shadowColor: '#007aff',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    marginBottom: 12,
  },
  errorText: {
    color: '#ff3b30',
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '600',
    fontFamily: 'LexendMega',
  },
  primaryButton: {
    borderRadius: 24,
    paddingVertical: 12,
    elevation: 2,
    shadowColor: '#007aff',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  arrowButton: {
    borderRadius: 50,
    paddingVertical: 10,
    paddingHorizontal: 22,
    elevation: 2,
    shadowColor: '#007aff',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  tierButton: {
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingVertical: 12,
    marginBottom: 8,
  },
  selectedTierButton: {
    borderRadius: 18,
    paddingVertical: 12,
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: '#222',
    backgroundColor: '#fafcff',
    marginBottom: 8,
    width: '100%',
  },
});
