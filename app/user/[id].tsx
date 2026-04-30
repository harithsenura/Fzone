import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  TouchableOpacity, 
  ScrollView, 
  Dimensions, 
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import { API_BASE_URL } from '@/config/api';
import { useAuth } from '@/context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { FadeIn, FadeInDown, Layout } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColor } from '@/hooks/use-theme-color';

const { width } = Dimensions.get('window');

export default function UserProfileScreen() {
  const router = useRouter();
  const { id, name, avatar } = useLocalSearchParams();
  const { user: currentUser, globalUsersCache } = useAuth();
  
  const [friendStatus, setFriendStatus] = useState<'none' | 'requested' | 'pending' | 'friends'>('none');
  const [isProcessing, setIsProcessing] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const [userPosts, setUserPosts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const insets = useSafeAreaInsets();

  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const secondaryTextColor = useThemeColor({ light: '#999', dark: '#94A3B8' }, 'text');
  const cardBackground = useThemeColor({ light: '#fff', dark: '#1E1E1E' }, 'card');
  const btnBackground = useThemeColor({ light: '#F2F2F7', dark: '#2C2C2E' }, 'background');
  const borderBottomColor = useThemeColor({ light: '#F0F0F0', dark: '#2C2C2E' }, 'border');

  const fetchData = async () => {
    if (!id) return;
    
    const cacheKey = `@profile_cache_${id}`;
    let cacheHit = false;

    if (globalUsersCache[id as string]) {
      const data = globalUsersCache[id as string];
      setFriends(data.friends);
      setUserPosts(data.posts);
      setFriendStatus(data.friendStatus as any);
      setIsLoading(false);
      cacheHit = true;
    } else {
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          const data = JSON.parse(cached);
          setFriends(data.friends);
          setUserPosts(data.posts);
          setFriendStatus(data.friendStatus);
          setIsLoading(false);
          cacheHit = true;
        }
      } catch (e) {}
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/profile/full/${id}?currentUserId=${currentUser?._id}`);
      
      if (response.ok) {
        const data = await response.json();
        
        setFriendStatus(data.friendStatus);
        setFriends(data.friends);
        
        const formattedPosts = data.posts.map((p: any) => ({
          id: p._id,
          type: p.images && p.images.length > 0 ? 'image' : 'text',
          image: p.images && p.images.length > 0 ? p.images[0] : null,
          text: p.text,
          likes: p.likesCount || 0,
          time: new Date(p.createdAt).toLocaleDateString(),
        }));
        
        setUserPosts(formattedPosts);
        
        await AsyncStorage.setItem(cacheKey, JSON.stringify({
          friends: data.friends,
          posts: formattedPosts,
          friendStatus: data.friendStatus
        }));
      }
    } catch (err) {
      console.error('Error fetching profile data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  useEffect(() => {
    if (id && globalUsersCache[id as string]) {
      const data = globalUsersCache[id as string];
      setFriends(data.friends);
      setUserPosts(data.posts);
      setFriendStatus(data.friendStatus as any);
    }
  }, [globalUsersCache, id]);

  const onRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    
    try {
      await fetchData();
    } catch (error) {
      console.error('Profile refresh failed:', error);
    } finally {
      setRefreshing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [id]);

  const handleFriendAction = async () => {
    if (isProcessing) return;

    if (friendStatus === 'friends') {
      Alert.alert(
        "Manage Friendship",
        `What would you like to do with ${name}?`,
        [
          {
            text: "Unfollow User",
            style: "destructive",
            onPress: async () => {
              const prevFriends = [...friends];
              setFriendStatus('none');
              setFriends(prev => prev.filter(f => f._id !== currentUser?._id));
              
              try {
                const response = await fetch(`${API_BASE_URL}/api/friends/cancel`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ toUserId: id, fromUserId: currentUser?._id })
                });
                if (!response.ok) {
                  setFriendStatus('friends');
                  setFriends(prevFriends);
                }
              } catch (err) {
                console.error(err);
                setFriendStatus('friends');
                setFriends(prevFriends);
              }
            }
          },
          { text: "Cancel", style: "cancel" }
        ]
      );
      return;
    }

    const previousStatus = friendStatus;
    setFriendStatus(friendStatus === 'none' ? 'requested' : 'none');

    try {
      const endpoint = previousStatus === 'none' ? '/api/friends/request' : '/api/friends/cancel';
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toUserId: id, fromUserId: currentUser?._id })
      });

      if (!response.ok) {
        setFriendStatus(previousStatus);
      }
    } catch (err) {
      console.error(err);
      setFriendStatus(previousStatus);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <StatusBar style="auto" />
      <View style={[StyleSheet.absoluteFill, { backgroundColor }]} />
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={{ flex: 1 }}>
        {/* Navigation Bar */}
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => router.back()} style={[styles.headerBtn, { backgroundColor: btnBackground }]}>
            <Ionicons name="chevron-back" size={24} color={textColor} />
          </TouchableOpacity>
          <Text style={[styles.navTitle, { color: textColor }]}>Profile</Text>
          <TouchableOpacity style={[styles.headerBtn, { backgroundColor: btnBackground }]}>
             <Ionicons name="ellipsis-horizontal" size={22} color={textColor} />
          </TouchableOpacity>
        </View>

        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={styles.scrollContent}
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
        >
          
          {/* Profile Card */}
          <Animated.View entering={FadeInDown.duration(600)} style={[styles.profileCard, { backgroundColor: cardBackground, borderColor: borderBottomColor }]}>
            <View style={styles.mainInfo}>
              <View style={styles.avatarWrapper}>
                <Image source={{ uri: avatar as string }} style={[styles.avatar, { borderColor: btnBackground }]} />
                <View style={[styles.activeDot, { borderColor: cardBackground }]} />
              </View>
              <View style={styles.titleArea}>
                <Text style={[styles.nameText, { color: textColor }]}>{name}</Text>
                <Text style={[styles.handleText, { color: secondaryTextColor }]}>@fzone_member</Text>
              </View>
            </View>

            <Text style={[styles.bioText, { color: textColor }]}>
              Digital Creator & Storyteller 🎨 Exploring the intersection of design and technology.
            </Text>

            {/* Stats - Redesigned */}
            <View style={[styles.modernStatsRow, { backgroundColor: btnBackground }]}>
              <View style={styles.modernStatItem}>
                <Text style={[styles.modernStatVal, { color: textColor }]}>{userPosts.length}</Text>
                <Text style={[styles.modernStatLab, { color: secondaryTextColor }]}>Posts</Text>
              </View>
              <View style={[styles.statLine, { backgroundColor: borderBottomColor }]} />
              <View style={styles.modernStatItem}>
                <Text style={[styles.modernStatVal, { color: textColor }]}>{friends.length > 5 ? (friends.length * 1.5).toFixed(0) : friends.length}</Text>
                <Text style={[styles.modernStatLab, { color: secondaryTextColor }]}>Followers</Text>
              </View>
              <View style={[styles.statLine, { backgroundColor: borderBottomColor }]} />
              <View style={styles.modernStatItem}>
                <Text style={[styles.modernStatVal, { color: textColor }]}>{friends.length}</Text>
                <Text style={[styles.modernStatLab, { color: secondaryTextColor }]}>Friends</Text>
              </View>
            </View>

            {/* Friends Pile UI */}
            {friends.length > 0 && (
              <View style={styles.friendsPileSection}>
                <View style={styles.avatarPile}>
                  {friends.slice(0, 3).map((friend, idx) => (
                    <Image 
                      key={`friend-${friend._id}-${idx}`} 
                      source={{ uri: friend.avatar || 'https://ui-avatars.com/api/?name='+friend.name }} 
                      style={[styles.pileAvatar, { marginLeft: idx === 0 ? 0 : -15, zIndex: 10 - idx, borderColor: cardBackground }]} 
                    />
                  ))}
                  {friends.length > 3 && (
                    <View style={[styles.pilePlus, { marginLeft: -15, zIndex: 0, backgroundColor: btnBackground, borderColor: cardBackground }]}>
                      <Text style={[styles.pilePlusText, { color: secondaryTextColor }]}>+{friends.length - 3}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.friendsNote, { color: secondaryTextColor }]}>
                  Followed by <Text style={{fontWeight:'700', color: textColor}}>{friends[0]?.name}</Text> {friends.length > 1 ? `and ${friends.length - 1} others` : ''}
                </Text>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionGrid}>
              <TouchableOpacity 
                activeOpacity={0.8}
                style={[
                  styles.primaryBtn, 
                  friendStatus === 'friends' && styles.friendsOkBtn,
                  friendStatus === 'requested' && styles.waitBtn
                ]} 
                onPress={handleFriendAction}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons 
                      name={friendStatus === 'none' ? "person-add" : friendStatus === 'requested' ? "time" : "people"} 
                      size={18} 
                      color="#fff" 
                    />
                    <Text style={styles.primaryBtnText}>
                        {friendStatus === 'none' ? 'Add Friend' : friendStatus === 'requested' ? 'Requested' : 'Friends'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity style={[styles.secondaryBtn, { backgroundColor: btnBackground }]} onPress={() => router.push({
                  pathname: "/chat/[id]",
                  params: { id: id, name: name, avatar: avatar }
              })}>
                <Ionicons name="chatbubble-ellipses" size={18} color={textColor} />
                <Text style={[styles.secondaryBtnText, { color: textColor }]}>Message</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Posts Feed Header */}
          <View style={styles.feedHeader}>
            <Text style={[styles.feedTitle, { color: textColor }]}>Gallery</Text>
            <View style={[styles.viewToggle, { backgroundColor: btnBackground }]}>
              <TouchableOpacity 
                style={viewMode === 'grid' ? [styles.toggleActive, { backgroundColor: textColor }] : styles.toggleInactive}
                onPress={() => setViewMode('grid')}
              >
                <Ionicons name="grid" size={18} color={viewMode === 'grid' ? backgroundColor : secondaryTextColor} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={viewMode === 'list' ? [styles.toggleActive, { backgroundColor: textColor }] : styles.toggleInactive}
                onPress={() => setViewMode('list')}
              >
                <Ionicons name="reorder-four" size={20} color={viewMode === 'list' ? backgroundColor : secondaryTextColor} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Posts Grid - Redesigned */}
          <View style={styles.gridContainer}>
            {isLoading ? (
              <ActivityIndicator style={{ marginTop: 40 }} color="#3B82F6" />
            ) : userPosts.length > 0 ? (
              viewMode === 'grid' ? (
                <View style={styles.postGrid}>
                  {userPosts.map((post, idx) => (
                    <Animated.View 
                      entering={FadeIn.delay(idx * 80)} 
                      key={post.id} 
                      style={styles.gridItem}
                    >
                      {post.type === 'image' ? (
                         <Image source={{ uri: post.image }} style={styles.gridImage} />
                      ) : (
                        <View style={[styles.gridTextCard, { backgroundColor: btnBackground }]}>
                          <Text numberOfLines={3} style={[styles.gridText, { color: textColor }]}>{post.text}</Text>
                        </View>
                      )}
                    </Animated.View>
                  ))}
                </View>
              ) : (
                <View style={styles.postListContainer}>
                  {userPosts.map((post, idx) => (
                    <Animated.View 
                      entering={FadeInDown.delay(idx * 80)} 
                      key={post.id} 
                      style={[styles.postCardList, { backgroundColor: cardBackground, borderColor: borderBottomColor }]}
                    >
                      <View style={styles.postCardHeader}>
                        <View style={styles.postCardTitleRow}>
                          <Text style={[styles.postCardUser, { color: textColor }]}>{name}</Text>
                          <Text style={[styles.postCardTime, { color: secondaryTextColor }]}>{post.time}</Text>
                        </View>
                        <TouchableOpacity><Ionicons name="ellipsis-horizontal" size={16} color={secondaryTextColor} /></TouchableOpacity>
                      </View>
                      
                      {post.type === 'image' && (
                        <View style={styles.postImageContainer}>
                          <Image source={{ uri: post.image }} style={styles.postCardImage} />
                        </View>
                      )}
                      
                      {post.text ? <Text style={[styles.postCardText, { color: textColor }]}>{post.text}</Text> : null}
                      
                      <View style={styles.postCardFooter}>
                        <View style={styles.postCardActions}>
                          <TouchableOpacity style={[styles.postCardAction, { backgroundColor: btnBackground }]}>
                            <Ionicons name="heart-outline" size={20} color={secondaryTextColor} />
                            <Text style={[styles.postCardActionText, { color: secondaryTextColor }]}>{post.likes}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.postCardAction, { backgroundColor: btnBackground }]}>
                            <Ionicons name="chatbubble-outline" size={18} color={secondaryTextColor} />
                            <Text style={[styles.postCardActionText, { color: secondaryTextColor }]}>0</Text>
                          </TouchableOpacity>
                        </View>
                        <TouchableOpacity><Ionicons name="bookmark-outline" size={18} color={secondaryTextColor} /></TouchableOpacity>
                      </View>
                    </Animated.View>
                  ))}
                </View>
              )
            ) : (
              <View style={styles.emptyFeed}>
                <Ionicons name="images-outline" size={40} color="#DDD" />
                <Text style={styles.emptyFeedText}>No posts to show</Text>
              </View>
            )}
          </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, height: 50 },
  headerBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F8F9FA', justifyContent: 'center', alignItems: 'center' },
  navTitle: { fontSize: 17, fontWeight: '700', color: '#111' },
  scrollContent: { paddingBottom: 100 },

  profileCard: { 
    margin: 20, 
    padding: 24, 
    backgroundColor: '#fff', 
    borderRadius: 32, 
    borderWidth: 1, 
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 5
  },
  mainInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  avatarWrapper: { position: 'relative' },
  avatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: '#F8F9FA' },
  activeDot: { position: 'absolute', bottom: 5, right: 5, width: 14, height: 14, borderRadius: 7, backgroundColor: '#34C759', borderWidth: 2, borderColor: '#fff' },
  titleArea: { marginLeft: 15 },
  nameText: { fontSize: 22, fontWeight: '800', color: '#111' },
  handleText: { fontSize: 13, color: '#999', fontWeight: '500', marginTop: 2 },
  bioText: { fontSize: 14, color: '#666', lineHeight: 22, marginBottom: 25 },
  
  modernStatsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8F9FA', borderRadius: 20, paddingVertical: 15, paddingHorizontal: 20, marginBottom: 20 },
  modernStatItem: { alignItems: 'center', flex: 1 },
  modernStatVal: { fontSize: 18, fontWeight: '800', color: '#111' },
  modernStatLab: { fontSize: 11, color: '#999', fontWeight: '600', marginTop: 2 },
  statLine: { width: 1, height: 30, backgroundColor: '#DDD' },

  friendsPileSection: { flexDirection: 'row', alignItems: 'center', marginBottom: 25, paddingHorizontal: 5 },
  avatarPile: { flexDirection: 'row', alignItems: 'center' },
  pileAvatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: '#fff' },
  pilePlus: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F2F2F7', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  pilePlusText: { fontSize: 10, fontWeight: '800', color: '#666' },
  friendsNote: { fontSize: 12, color: '#888', marginLeft: 12, flex: 1 },

  actionGrid: { flexDirection: 'row', gap: 12 },
  primaryBtn: { flex: 1.2, height: 50, backgroundColor: '#007AFF', borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  friendsOkBtn: { backgroundColor: '#34C759' },
  waitBtn: { backgroundColor: '#FF9500' },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  secondaryBtn: { flex: 1, height: 50, backgroundColor: '#F2F2F7', borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondaryBtnText: { color: '#333', fontWeight: '700', fontSize: 14 },

  feedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 25, marginBottom: 15 },
  feedTitle: { fontSize: 18, fontWeight: '800', color: '#111' },
  viewToggle: { flexDirection: 'row', backgroundColor: '#F2F2F7', borderRadius: 12, padding: 4 },
  toggleActive: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  toggleInactive: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },

  gridContainer: { paddingHorizontal: 10 },
  postGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  gridItem: { width: (width - 30) / 3, height: (width - 30) / 3, margin: 2, borderRadius: 12, overflow: 'hidden' },
  gridImage: { width: '100%', height: '100%' },
  gridTextCard: { width: '100%', height: '100%', backgroundColor: '#F8F9FA', padding: 10, justifyContent: 'center', alignItems: 'center' },
  gridText: { fontSize: 10, color: '#666', textAlign: 'center' },
  
  postListContainer: { paddingHorizontal: 15 },
  postCardList: { 
    backgroundColor: '#fff', 
    borderRadius: 24, 
    padding: 15, 
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2
  },
  postCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  postCardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  postCardUser: { fontSize: 15, fontWeight: '700', color: '#111' },
  postCardTime: { fontSize: 12, color: '#999' },
  postImageContainer: { borderRadius: 16, overflow: 'hidden', marginBottom: 12 },
  postCardImage: { width: '100%', height: 200 },
  postCardText: { fontSize: 14, color: '#444', lineHeight: 20, marginBottom: 12 },
  postCardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  postCardActions: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  postCardAction: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  postCardActionText: { fontSize: 13, color: '#666', fontWeight: '600' },

  emptyFeed: { alignItems: 'center', marginTop: 40, width: '100%' },
  emptyFeedText: { fontSize: 14, color: '#BBB', marginTop: 10 }
});