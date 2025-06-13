// app/tabs/notifications.tsx

import { useUser } from '@/context/UserContext';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RecentNotification } from '../../shared/types/user';

export default function NotificationsScreen() {
  const { sirenUser } = useUser();
  const router = useRouter();

  const notifications = sirenUser?.recentNotifications
    ? Object.values(sirenUser.recentNotifications).sort((a, b) => b.timestamp - a.timestamp)
    : [];

  const renderItem = ({ item }: { item: RecentNotification }) => (
    <View style={styles.notificationCard}>
      {item.image && <Image source={{ uri: item.image }} style={styles.image} />}
      <View style={styles.textContainer}>
        <Text style={styles.title}>{item.notificationTitle || 'Price Alert'}</Text>
        <Text style={styles.body}>{item.notificationBody}</Text>
        <Text style={styles.timestamp}>
          {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea]}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color="black" />
        </TouchableOpacity>
        <Text style={styles.header}>Notifications</Text>
      </View>

      {notifications.length === 0 ? (
        <Text style={styles.empty}>No recent notifications.</Text>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(_, index) => index.toString()}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}
      </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1
  },
  container: {
    padding: 16,
    flex: 1,
    backgroundColor: 'white',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  empty: {
    fontSize: 16,
    color: 'gray',
    textAlign: 'center',
    marginTop: 20,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    marginBottom: 12,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  image: {
    width: 40,
    height: 40,
    marginRight: 12,
    borderRadius: 6,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontWeight: '600',
    fontSize: 16,
    marginBottom: 4,
  },
  body: {
    fontSize: 14,
    color: '#333',
  },
  timestamp: {
    marginTop: 4,
    fontSize: 12,
    color: 'gray',
  },
});
