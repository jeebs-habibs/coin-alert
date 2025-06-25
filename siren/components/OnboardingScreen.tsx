import { getTheme } from '@/constants/theme';
import { useAuthRequest } from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { GoogleAuthProvider, onAuthStateChanged, signInWithCredential } from 'firebase/auth';
import React, { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  StyleSheet,
  TextInput,
  useColorScheme,
  View,
  ViewToken,
} from 'react-native';
import { Button, Icon, Text } from 'react-native-elements';
import { auth } from '../lib/firebase';

WebBrowser.maybeCompleteAuthSession();

const carouselData = [
  {
    key: '1',
    image: require('../assets/images/trader.jpg'),
    title: 'Track Your Tokens',
    description: 'Stay on top of your Solana memecoins with real-time alerts.',
  },
  {
    key: '2',
    image: require('../assets/images/alert.jpg'),
    title: 'Connect Wallets',
    description: 'Add any wallet you want to monitor — just 0.25 SOL/month per wallet.',
  },
  {
    key: '3',
    image: require('../assets/images/walking-dog-2.jpg'),
    title: 'Never Miss a Move',
    description: 'Get notified instantly when your coins pump or dump.',
  },
];

const TIERS = [
  { label: 'Basic', value: 'basic', price: '$9.99/mo' },
  { label: 'Pro', value: 'pro', price: '$49.99/mo' },
];

export default function OnboardingScreen() {
  const scheme = useColorScheme()
  const theme = getTheme(scheme)
  const styles = getStyles(theme)
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedTier, setTier] = useState(0);
  const [referral, setReferral] = useState('');
  const [step, setStep] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList<any>>(null);

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
        setStep(1);
      } else {
        console.log('User logged out');
      }
    });
    return unsubscribe;
  }, []);

  const handleBack = () => setStep((prev) => Math.max(prev - 1, 0));

  const viewabilityConfig = { viewAreaCoveragePercentThreshold: 50 };
  const handleViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<ViewToken> }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setActiveIndex(Number(viewableItems[0].index));
      }
    }
  ).current;
  return (
    <View style={styles.container}>
      {step === 0 && (
        <>
          <Text style={styles.appName}>Siren</Text>

          <View style={{ flex: 1, justifyContent: 'center', marginBottom: 0 }}>
            <FlatList
              ref={flatListRef}
              data={carouselData}
              keyExtractor={(item) => item.key}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onViewableItemsChanged={handleViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              renderItem={({ item }) => (
                <View style={{ width: Dimensions.get('window').width - 32, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }}>
                  <Image source={item.image} style={{ width: 260, height: 260, borderRadius: 16, marginBottom: 24 }} resizeMode="cover" />
                  <Text style={{ fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginBottom: 12, fontFamily: 'LexendMega' , color: theme.colors.text}}>{item.title}</Text>
                  <Text style={{ fontSize: 16, color: theme.colors.text, textAlign: 'center', lineHeight: 24, fontFamily: 'LexendMega' }}>{item.description}</Text>
                </View>
              )}
            />
          </View>

          {/* Dots */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 50 }}>
            {carouselData.map((_, index) => (
              <View
                key={index}
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: activeIndex === index ? theme.colors.primary : theme.colors.text,
                  marginHorizontal: 6,
                }}
              />
            ))}
          </View>

          {/* Buttons below carousel */}
          <View style={{ width: '100%', marginBottom: 80 }}>
            <Button
              title="Sign Up"
              buttonStyle={styles.primaryButton}
              titleStyle={{ fontWeight: 'bold', fontSize: 18 }}
              containerStyle={{ marginBottom: 18, borderRadius: 24 }}
              onPress={() => promptAsync()}
            />
            <Text
              style={{
                textAlign: 'center',
                textDecorationLine: 'underline',
                fontWeight: 'bold',
                fontSize: 16,
                fontFamily: 'LexendMega',
                color: theme.colors.text
              }}
              onPress={() => promptAsync()}
            >
              Log In
            </Text>
          </View>
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
            icon={<Icon name="chevron-right" type="feather" color={theme.colors.text} />}
            title="Continue"
            buttonStyle={styles.primaryButton}
            onPress={() => setStep(2)}
          />
          <Button
            icon={<Icon name="chevron-left" type="feather" color={theme.colors.text} />}
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
          <Button title="Continue" buttonStyle={styles.primaryButton} />
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

function getStyles(theme: ReturnType<typeof getTheme>){
  return StyleSheet.create({
    container: {
      flex: 1,
      width: Dimensions.get('window').width,
      padding: 16,
      justifyContent: 'center',
      alignItems: 'center',
    },
    appName: {
      fontSize: 36,
      fontWeight: 'bold',
      textAlign: 'center',
      letterSpacing: 2,
      marginTop: 70,
      marginBottom: 12,
      fontFamily: 'LexendMega',
      color: theme.colors.primary,
    },
    primaryButton: {
      borderRadius: 24,
      paddingVertical: 12,
      elevation: 2,
      shadowColor: '#007aff',
      shadowOpacity: 0.18,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      backgroundColor: theme.colors.primary,
    },
    tierButton: {
      backgroundColor: '#fff',
      borderRadius: 18,
      paddingVertical: 12,
      marginBottom: 8,
    },
    selectedTierButton: {
      backgroundColor: '#007aff',
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
  
}

