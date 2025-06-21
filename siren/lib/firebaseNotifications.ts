import messaging from '@react-native-firebase/messaging';

export async function requestAndStoreFcmToken(jwt: string, userId: string) {
  try {
    console.log("Registering device for remote messages...");
    await messaging().registerDeviceForRemoteMessages();

    console.log("Requesting permissions for notifications...");
    const authStatus = await messaging().requestPermission();
    console.log("Auth status: " + authStatus);

    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    console.log("Does user have permissions: " + enabled);

    if (!enabled) {
      console.warn('Notification permission not granted');
      return;
    }

    const fcmToken = await messaging().getToken();

    if (fcmToken) {
      console.log('FCM Token:', fcmToken);
      await fetch('https://www.sirennotify.com/api/storeFcmToken', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          fcmToken,
        }),
      });
    }
  } catch (err) {
    console.error("Error while requesting or storing FCM token:", err);
  }
}
