import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  Image, 
  TouchableOpacity, 
  SafeAreaView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Dimensions
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '@/config/api';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import Animated, { FadeInDown, FadeIn, SlideInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { io } from 'socket.io-client';
import { useThemeColor } from '../hooks/use-theme-color';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');
const REQUESTS_CACHE_KEY = '@cached_friend_requests';
const NOTIFS_CACHE_KEY = '@cached_notifications';

export default function NotificationsPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user: currentUser, refreshProfile } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const secondaryTextColor = useThemeColor({ light: '#8E8E93', dark: '#94A3B8' }, 'text');
  const cardBackground = useThemeColor({ light: '#fff', dark: '#1E1E1E' }, 'card');
  const borderBottomColor = useThemeColor({ light: '#F0F0F0', dark: '#2C2C2E' }, 'border');
  const btnBackground = useThemeColor({ light: '#F2F2F7', dark: '#2C2C2E' }, 'background');
  const unreadBackgroundColor = useThemeColor({ light: '#F0F7FF', dark: '#1A212E' }, 'background');
  const unreadBorderColor = useThemeColor({ light: '#D0E6FF', dark: '#2A3B4D' }, 'border');

  const loadCachedData = async () => {
    try {
      const [cachedReqs, cachedNotifs] = await Promise.all([
        AsyncStorage.getItem(REQUESTS_CACHE_KEY),
        AsyncStorage.getItem(NOTIFS_CACHE_KEY)
      ]);
      
      if (cachedReqs) setRequests(JSON.parse(cachedReqs));
      if (cachedNotifs) setNotifications(JSON.parse(cachedNotifs));
      
      if (cachedReqs || cachedNotifs) setLoading(false);
    } catch (e) {
      console.error('Cache load error:', e);
    }
  };

  const fetchData = async () => {
    if (!currentUser) return;
    try {
      const [reqsRes, notifsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/friends/requests?userId=${currentUser._id}`),
        fetch(`${API_BASE_URL}/api/notifications?userId=${currentUser._id}`)
      ]);

      if (reqsRes.ok) {
        const reqsData = await reqsRes.json();
        setRequests(reqsData);
        await AsyncStorage.setItem(REQUESTS_CACHE_KEY, JSON.stringify(reqsData));
      }

      if (notifsRes.ok) {
        const notifsData = await notifsRes.json();
        setNotifications(notifsData);
        await AsyncStorage.setItem(NOTIFS_CACHE_KEY, JSON.stringify(notifsData));
        
        setTimeout(async () => {
          try {
            await fetch(`${API_BASE_URL}/api/notifications/read`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: currentUser._id })
            });
          } catch (e) {}
        }, 2000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCachedData();
    fetchData();
    
    const socket = io(API_BASE_URL.replace('https://', 'wss://').replace('http://', 'ws://'));
    
    if (currentUser?._id) {
      socket.on('connect', () => {
        socket.emit('joinUser', currentUser._id);
      });
    }
    
    socket.on('newNotification', (notif) => {
      fetchData();
    });

    return () => {
      socket.disconnect();
    };
  }, [currentUser]);

  const onRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    
    const startTime = Date.now();
    
    const fetchPromise = fetchData().catch(console.error);
    const timeoutPromise = new Promise(resolve => setTimeout(resolve, 1500));
    
    await Promise.race([fetchPromise, timeoutPromise]);
    
    const elapsed = Date.now() - startTime;
    if (elapsed < 1000) {
      await new Promise(resolve => setTimeout(resolve, 1000 - elapsed));
    }
    
    setRefreshing(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [currentUser]);

  const handleAccept = async (requestId: string) => {
    const originalRequests = [...requests];
    const updated = requests.filter(r => r._id !== requestId);
    setRequests(updated);
    AsyncStorage.setItem(REQUESTS_CACHE_KEY, JSON.stringify(updated)).catch(() => {});
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/friends/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId })
      });
      if (!response.ok) {
        setRequests(originalRequests);
      } else {
        refreshProfile(); // Instantly update profile friend count
      }
    } catch (err) {
      console.error(err);
      setRequests(originalRequests);
    }
  };

  const handleDecline = async (requestId: string, fromUserId: string) => {
    const originalRequests = [...requests];
    const updated = requests.filter(r => r._id !== requestId);
    setRequests(updated);
    AsyncStorage.setItem(REQUESTS_CACHE_KEY, JSON.stringify(updated)).catch(() => {});
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/friends/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toUserId: currentUser?._id, fromUserId: fromUserId })
      });
      if (!response.ok) {
        setRequests(originalRequests);
      }
    } catch (err) {
      console.error(err);
      setRequests(originalRequests);
    }
  };

  const renderRequestCard = ({ item, index }: { item: any; index: number }) => {
    const isProcessing = processingIds.has(item._id);
    const senderName = item.fromUser?.name || 'Unknown User';
    const senderAvatar = item.fromUser?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(senderName)}&background=667eea&color=fff&size=200`;
    const timeAgo = item.createdAt ? getTimeAgo(item.createdAt) : '';

    return (
      <Animated.View 
        entering={FadeInDown.delay(index * 80).springify().damping(14)}
        style={[styles.requestCard, { backgroundColor: cardBackground, borderColor: borderBottomColor }]}
      >
        <TouchableOpacity 
          onPress={() => router.push({
            pathname: "/user/[id]",
            params: { id: item.fromUser?._id, name: senderName, avatar: senderAvatar }
          })}
          activeOpacity={0.8}
        >
          <View style={styles.avatarContainer}>
            <Image source={{ uri: senderAvatar }} style={styles.avatar} />
            <View style={[styles.onlineDot, { borderColor: cardBackground }]} />
          </View>
        </TouchableOpacity>

        <View style={styles.infoSection}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: textColor }]} numberOfLines={1}>{senderName}</Text>
            {timeAgo ? <Text style={[styles.timeText, { color: secondaryTextColor }]}>{timeAgo}</Text> : null}
          </View>
          <Text style={[styles.subtitle, { color: secondaryTextColor }]}>wants to be your friend</Text>

          <View style={styles.actionRow}>
            <TouchableOpacity 
              style={styles.acceptBtn} 
              onPress={() => handleAccept(item._id)}
              disabled={isProcessing}
              activeOpacity={0.7}
            >
              <Ionicons name="checkmark-circle" size={16} color="#fff" />
              <Text style={styles.acceptText}>Accept</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.declineBtn, { backgroundColor: btnBackground }]}
              onPress={() => handleDecline(item._id, item.fromUser?._id)}
              disabled={isProcessing}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={16} color={secondaryTextColor} />
              <Text style={[styles.declineText, { color: secondaryTextColor }]}>Decline</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    );
  };

  const renderNotificationCard = ({ item, index }: { item: any; index: number }) => {
    const senderName = item.sender?.name || 'User';
    const senderAvatar = item.sender?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(senderName)}`;
    const timeAgo = getTimeAgo(item.createdAt);

    let icon = "notifications";
    let iconColor = "#007AFF";
    let text = item.message;

    switch(item.type) {
      case 'LIKE': icon = "heart"; iconColor = "#FF2D55"; break;
      case 'COMMENT': icon = "chatbubble"; iconColor = "#5856D6"; break;
      case 'FRIEND_ACCEPT': icon = "people"; iconColor = "#34C759"; break;
      case 'MESSAGE': icon = "mail"; iconColor = "#007AFF"; break;
    }

    return (
      <Animated.View 
        entering={FadeInDown.delay(index * 50)}
        style={[
          styles.notifCard, 
          { backgroundColor: cardBackground, borderColor: borderBottomColor },
          !item.read && { backgroundColor: unreadBackgroundColor, borderColor: unreadBorderColor }
        ]}
      >
        <Image source={{ uri: senderAvatar }} style={styles.notifAvatar} />
        <View style={styles.notifContent}>
          <Text style={[styles.notifText, { color: textColor }]}>
            <Text style={[styles.notifName, { color: textColor }]}>{senderName} </Text>
            {text}
          </Text>
          <View style={styles.notifFooter}>
            <Ionicons name={icon as any} size={12} color={iconColor} />
            <Text style={[styles.notifTime, { color: secondaryTextColor }]}>{timeAgo}</Text>
          </View>
        </View>
        {!item.read && <View style={styles.unreadDot} />}
      </Animated.View>
    );
  };

  const combinedData = [
    ...requests.map(r => ({ ...r, viewType: 'request' })),
    ...notifications.map(n => ({ ...n, viewType: 'notification' }))
  ];

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <AnimatedBackground />
      <Stack.Screen options={{ 
        headerShown: false,
      }} />

      <SafeAreaView style={{ flex: 1 }}>
        {/* Custom Header */}
        <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: btnBackground }]}>
            <Ionicons name="chevron-back" size={24} color={textColor} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: textColor }]}>Notifications</Text>
            {(requests.length + notifications.filter(n => !n.read).length) > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{requests.length + notifications.filter(n => !n.read).length}</Text>
              </View>
            )}
          </View>
          <View style={{ width: 40 }} />
        </Animated.View>

        {loading && requests.length === 0 && notifications.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={[styles.loadingText, { color: secondaryTextColor }]}>Loading notifications...</Text>
          </View>
        ) : (
          <FlatList
            data={combinedData}
            keyExtractor={item => item._id}
            contentContainerStyle={styles.listContainer}
            renderItem={({ item, index }) => 
              item.viewType === 'request' ? renderRequestCard({ item, index }) : renderNotificationCard({ item, index })
            }
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={onRefresh} 
                tintColor="#3B82F6" 
                colors={['#3B82F6', '#5856D6']} 
                title="Updating..."
                titleColor="#3B82F6"
                progressViewOffset={insets.top + 20}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={[styles.emptyIconWrapper, { backgroundColor: btnBackground }]}><Ionicons name="notifications-outline" size={48} color={secondaryTextColor} /></View>
                <Text style={[styles.emptyTitle, { color: textColor }]}>All Caught Up!</Text>
                <Text style={[styles.emptyText, { color: secondaryTextColor }]}>No notifications right now.</Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
}

function getTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return `${Math.floor(seconds / 604800)}w ago`;
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#fff' 
  },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111',
    letterSpacing: -0.3,
  },
  countBadge: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    minWidth: 24,
    alignItems: 'center',
  },
  countText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },

  center: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    gap: 15,
  },
  loadingText: {
    fontSize: 14,
    color: '#999',
    fontWeight: '500',
  },

  listContainer: { 
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111',
  },
  sectionCount: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500',
  },

  requestCard: { 
    flexDirection: 'row', 
    alignItems: 'flex-start', 
    backgroundColor: '#fff', 
    padding: 16, 
    borderRadius: 24, 
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 3,
  },
  
  avatarContainer: {
    position: 'relative',
    marginRight: 14,
  },
  avatar: { 
    width: 56, 
    height: 56, 
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#F0F0F5',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#34C759',
    borderWidth: 2.5,
    borderColor: '#fff',
  },

  infoSection: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  name: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: '#111',
    flex: 1,
  },
  timeText: {
    fontSize: 12,
    color: '#C7C7CC',
    fontWeight: '500',
    marginLeft: 8,
  },
  subtitle: { 
    fontSize: 13, 
    color: '#8E8E93', 
    marginBottom: 12,
    fontWeight: '400',
  },

  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  acceptBtn: { 
    flex: 1,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    justifyContent: 'center', 
    alignItems: 'center',
    gap: 6,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  acceptText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  declineBtn: { 
    flex: 1,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    flexDirection: 'row',
    justifyContent: 'center', 
    alignItems: 'center',
    gap: 5,
  },
  declineText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },

  emptyContainer: { 
    alignItems: 'center', 
    marginTop: 120,
    paddingHorizontal: 40,
  },
  emptyIconWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111',
    marginBottom: 8,
  },
  emptyText: { 
    fontSize: 15, 
    color: '#8E8E93', 
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyHint: {
    fontSize: 13,
    color: '#C7C7CC',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },

  notifCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 20,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  unreadCard: {
    backgroundColor: '#F0F7FF',
    borderColor: '#D0E6FF',
  },
  notifAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  notifContent: {
    flex: 1,
  },
  notifText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  notifName: {
    fontWeight: '700',
    color: '#000',
  },
  notifFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  notifTime: {
    fontSize: 12,
    color: '#999',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#007AFF',
    marginLeft: 8,
  }
});
