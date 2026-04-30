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
  Alert,
  Modal,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Platform
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import { useAuth } from '@/context/AuthContext';
import { router, useFocusEffect } from 'expo-router';
import { API_BASE_URL } from '@/config/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  interpolate, 
  Extrapolation, 
  useAnimatedScrollHandler,
  FadeIn,
  FadeInDown
} from 'react-native-reanimated';
import { useThemeColor } from '../../hooks/use-theme-color';

const { width, height } = Dimensions.get('window');
const COLUMN_SIZE = width / 3 - 2;

const POSTS = [
  {
    id: 1,
    type: 'image',
    image: 'https://images.unsplash.com/photo-1682687220742-aba13b6e50ba?w=500&q=80',
    text: 'Cruising through the mountains. Life is good! 🏔️✨',
    likes: '1.2k',
    time: '2h ago'
  },
  {
    id: 2,
    type: 'text',
    text: 'The best way to predict the future is to create it. Keep coding and stay inspired! 💻🔥 #codinglife #wisdom',
    likes: '856',
    time: '5h ago'
  },
  {
    id: 3,
    type: 'image',
    image: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=500&q=80',
    text: 'Nothing beats a clean workspace setup. 🖥️🙌',
    likes: '2.4k',
    time: 'Yesterday'
  },
  {
    id: 4,
    type: 'text',
    text: 'Just finished a major project milestone! Feeling super proud of the team. 🚀🎉 #milestone #success',
    likes: '450',
    time: '1d ago'
  },
  {
    id: 5,
    type: 'image',
    image: 'https://images.unsplash.com/photo-1610484732104-d534a7429d2b?w=500&q=80',
    text: 'Golden hour at the beach. 🏖️🌅',
    likes: '3.1k',
    time: '2d ago'
  }
];

const REELS = [
  'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=500&q=80',
  'https://images.unsplash.com/photo-1531297461136-82lw9b44d940?w=500&q=80',
  'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=500&q=80',
];

export default function ProfileScreen() {
  const [activeTab, setActiveTab] = useState<'posts' | 'reels'>('posts');
  const [refreshing, setRefreshing] = useState(false);
  const { user, profileData, refreshProfile, optimisticRemoveFriend } = useAuth();
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);

  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const secondaryTextColor = useThemeColor({ light: '#666', dark: '#94A3B8' }, 'text');
  const cardBackground = useThemeColor({ light: '#fff', dark: '#1E1E1E' }, 'card');
  const glassBackground = useThemeColor({ light: 'rgba(255, 255, 255, 0.8)', dark: 'rgba(30, 30, 30, 0.8)' }, 'card');
  const borderBottomColor = useThemeColor({ light: '#F0F0F0', dark: '#2C2C2E' }, 'border');
  const iconBackground = useThemeColor({ light: 'rgba(255,255,255,0.5)', dark: 'rgba(255,255,255,0.1)' }, 'background');
  const pileMoreBackground = useThemeColor({ light: '#F2F2F7', dark: '#2C2C2E' }, 'background');
  const postCardBackground = useThemeColor({ light: '#fff', dark: '#242424' }, 'card');
  const actionBackground = useThemeColor({ light: '#F2F2F7', dark: '#2C2C2E' }, 'background');
  const friendListItemBackground = useThemeColor({ light: '#f9f9fb', dark: '#242424' }, 'background');

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const headerAnimatedStyle = useAnimatedStyle(() => {
    const scrollOffset = Platform.OS === 'ios' ? insets.top + 10 : 0;
    const scrollPos = Math.max(0, scrollY.value + scrollOffset);
    return {
      transform: [
        { translateY: scrollPos * 0.4 },
        { scale: 1 }
      ],
      opacity: interpolate(scrollPos, [0, 250], [1, 0], Extrapolation.CLAMP),
    };
  });

  const sheetAnimatedStyle = useAnimatedStyle(() => {
    const scrollOffset = Platform.OS === 'ios' ? insets.top + 10 : 0;
    return {
      transform: [
        { 
          translateY: interpolate(
            scrollY.value + scrollOffset,
            [0, 300],
            [0, -40],
            Extrapolation.CLAMP
          ) 
        }
      ],
    };
  });

  const handleDeletePost = async (postId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/posts/${postId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        refreshProfile();
        Alert.alert("Success", "Post deleted successfully.");
      } else {
        Alert.alert("Error", "Failed to delete post.");
      }
    } catch (error) {
      console.error('Error deleting post:', error);
      Alert.alert("Error", "Network error. Please try again.");
    }
  };

  const showPostOptions = (post: any) => {
    Alert.alert(
      "Post Options",
      "What would you like to do?",
      [
        {
          text: "Delete Post",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Delete Post",
              "Are you sure you want to delete this post?",
              [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: () => handleDeletePost(post.id) }
              ]
            );
          }
        },
        { text: "Cancel", style: "cancel" }
      ]
    );
  };

  useFocusEffect(
    useCallback(() => {
      refreshProfile();
    }, [user?._id])
  );

  const userPosts = profileData?.posts || [];
  const friends = profileData?.friends || [];
  const stats = profileData?.stats || { postsCount: 0, friendsCount: 0, likesCount: '0' };
  const isLoadingProfile = !profileData;
  const [isFriendsModalVisible, setIsFriendsModalVisible] = useState(false);
  const [unfollowingId, setUnfollowingId] = useState<string | null>(null);

  const handleUnfollow = async (targetUserId: string) => {
    optimisticRemoveFriend(targetUserId);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/friends/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toUserId: targetUserId, fromUserId: user?._id })
      });
      
      if (!response.ok) {
        await refreshProfile();
        Alert.alert("Error", "Failed to unfollow. Please try again.");
      }
    } catch (error) {
      console.error('Error unfollowing:', error);
      await refreshProfile(); // Rollback
      Alert.alert("Error", "Network error.");
    }
  };

  const onRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    
    const startTime = Date.now();
    
    const fetchPromise = refreshProfile().catch(console.error);
    const timeoutPromise = new Promise(resolve => setTimeout(resolve, 1500));
    
    await Promise.race([fetchPromise, timeoutPromise]);
    
    const elapsed = Date.now() - startTime;
    if (elapsed < 1000) {
      await new Promise(resolve => setTimeout(resolve, 1000 - elapsed));
    }
    
    setRefreshing(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [refreshProfile]);

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <StatusBar style="auto" />
      {/* <AnimatedBackground /> */}

      <View style={{ flex: 1 }}>
        <Animated.ScrollView 
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={[styles.scrollContent, Platform.OS === 'android' ? { paddingTop: insets.top + 10 } : null]}
          contentInset={Platform.OS === 'ios' ? { top: insets.top + 10 } : undefined}
          contentOffset={Platform.OS === 'ios' ? { x: 0, y: -(insets.top + 10) } : undefined}
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
          
          <Animated.View style={headerAnimatedStyle}>
            {/* 1. Header Actions */}
            <View style={styles.headerBar}>
              <View style={styles.headerLeft}>
                <TouchableOpacity style={[styles.iconBtn, { backgroundColor: iconBackground }]} onPress={() => router.push('/onboarding')}>
                  <Ionicons name="pencil-outline" size={20} color={textColor} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.iconBtn, { backgroundColor: iconBackground }]}>
                  <Ionicons name="share-outline" size={20} color={textColor} />
                </TouchableOpacity>
              </View>
              <View style={styles.headerRight}>
                <TouchableOpacity style={[styles.iconBtn, { backgroundColor: iconBackground }]}>
                  <Ionicons name="qr-code-outline" size={24} color={textColor} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.iconBtn, { backgroundColor: iconBackground }]} onPress={() => router.push('/settings')}>
                  <Ionicons name="settings-outline" size={24} color={textColor} />
                </TouchableOpacity>
              </View>
            </View>

            {/* 2. Profile Info Section */}
            <View style={styles.profileHeader}>
              <View style={styles.avatarContainer}>
                <Image 
                  source={{ uri: user?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=500&q=80' }} 
                  style={[styles.avatar, { borderColor: backgroundColor }]} 
                />
                <View style={[styles.verifiedBadge, { borderColor: backgroundColor }]}>
                  <Ionicons name="checkmark" size={12} color="#fff" />
                </View>
              </View>
              
              <Text style={[styles.name, { color: textColor }]}>{user?.name || 'User'}</Text>
              <Text style={[styles.handle, { color: secondaryTextColor }]}>@{user?.email?.split('@')[0] || 'user'}</Text>
              
              <Text style={[styles.bio, { color: textColor }]}>
                {user?.bio ? user.bio : 'No bio provided...'}
              </Text>
            </View>

            {/* 3. Stats Board (Glass Card) */}
            <View style={[styles.statsContainer, { backgroundColor: glassBackground, borderColor: borderBottomColor }]}>
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: textColor }]}>{stats.postsCount}</Text>
                <Text style={[styles.statLabel, { color: secondaryTextColor }]}>Posts</Text>
              </View>
              <View style={[styles.divider, { backgroundColor: borderBottomColor }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: textColor }]}>{stats.friendsCount}</Text>
                <Text style={[styles.statLabel, { color: secondaryTextColor }]}>Friends</Text>
              </View>
              <View style={[styles.divider, { backgroundColor: borderBottomColor }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: textColor }]}>{stats.likesCount}</Text>
                <Text style={[styles.statLabel, { color: secondaryTextColor }]}>Likes</Text>
              </View>
            </View>

            {/* Friends Pile UI */}
            {friends.length > 0 && (
              <Animated.View entering={FadeInDown.delay(200)} style={styles.friendsSection}>
                <TouchableOpacity 
                   style={[styles.friendsWrapper, { backgroundColor: iconBackground, borderColor: borderBottomColor }]} 
                   onPress={() => setIsFriendsModalVisible(true)}
                   activeOpacity={0.7}
                >
                  <View style={styles.avatarPile}>
                    {friends.slice(0, 3).map((f, i) => (
                      <Image key={`friend-${f._id}-${i}`} source={{ uri: f.avatar }} style={[styles.pileImg, { marginLeft: i === 0 ? 0 : -12, zIndex: 10-i, borderColor: backgroundColor }]} />
                    ))}
                    {friends.length > 3 && (
                      <View style={[styles.pileMore, { backgroundColor: pileMoreBackground, borderColor: backgroundColor }]}>
                        <Text style={[styles.pileMoreText, { color: secondaryTextColor }]}>+{friends.length - 3}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.friendsInfoText, { color: secondaryTextColor }]}>
                    Connect with your <Text style={{fontWeight:'700', color: textColor}}>{friends.length}</Text> friends
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color={secondaryTextColor} style={{marginLeft: 5}} />
                </TouchableOpacity>
              </Animated.View>
            )}
          </Animated.View>

          {/* 4. Overlap Sheet (Tabs + Grid) */}
          <Animated.View style={[styles.sheetSection, sheetAnimatedStyle, { backgroundColor: cardBackground }]}>
            <View style={[styles.tabContainer, { borderBottomColor: borderBottomColor }]}>
              <TouchableOpacity 
                style={[styles.tab, activeTab === 'posts' && [styles.activeTab, { borderBottomColor: '#3B82F6' }]]} 
                onPress={() => setActiveTab('posts')}
              >
                <Ionicons name="grid-outline" size={24} color={activeTab === 'posts' ? '#3B82F6' : secondaryTextColor} />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.tab, activeTab === 'reels' && [styles.activeTab, { borderBottomColor: '#3B82F6' }]]} 
                onPress={() => setActiveTab('reels')}
              >
                <Ionicons name="videocam-outline" size={26} color={activeTab === 'reels' ? '#3B82F6' : secondaryTextColor} />
              </TouchableOpacity>
            </View>

            {/* 5. Grid/List Content */}
            <View style={styles.gridContainer}>
              {activeTab === 'posts' ? (
                <View style={styles.postListContainer}>
                  {userPosts.length > 0 ? (
                    userPosts.map((post, index) => (
                      <View key={`${post.id}-${index}`} style={[styles.postCard, isLoadingProfile && { opacity: 0.7 }, { backgroundColor: postCardBackground, borderColor: borderBottomColor }]}>
                        <View style={styles.postCardHeader}>
                          <View style={styles.postCardTitleRow}>
                            <Text style={[styles.postCardUser, { color: textColor }]}>{user?.name || 'User'}</Text>
                            <Text style={[styles.postCardTime, { color: secondaryTextColor }]}>{post.time}</Text>
                          </View>
                          <TouchableOpacity onPress={() => showPostOptions(post)}><Ionicons name="ellipsis-horizontal" size={16} color={secondaryTextColor} /></TouchableOpacity>
                        </View>
                        
                        {post.type === 'image' && (
                          <View style={styles.postImageContainer}>
                            <Image source={{ uri: post.image }} style={styles.postCardImage} />
                          </View>
                        )}
                        
                        {post.text ? <Text style={[styles.postCardText, { color: textColor }]}>{post.text}</Text> : null}
                        
                        <View style={styles.postCardFooter}>
                          <View style={styles.postCardActions}>
                            <TouchableOpacity style={[styles.postCardAction, { backgroundColor: actionBackground }]}>
                              <Ionicons name="heart-outline" size={20} color={secondaryTextColor} />
                              <Text style={[styles.postCardActionText, { color: secondaryTextColor }]}>{post.likes}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.postCardAction, { backgroundColor: actionBackground }]}>
                              <Ionicons name="chatbubble-outline" size={18} color={secondaryTextColor} />
                              <Text style={[styles.postCardActionText, { color: secondaryTextColor }]}>0</Text>
                            </TouchableOpacity>
                          </View>
                          <TouchableOpacity><Ionicons name="bookmark-outline" size={18} color={secondaryTextColor} /></TouchableOpacity>
                        </View>
                      </View>
                    ))
                  ) : !isLoadingProfile ? (
                    <View style={styles.emptyContainer}>
                      <Ionicons name="images-outline" size={50} color="#ccc" />
                      <Text style={styles.emptyText}>No posts yet.</Text>
                    </View>
                  ) : (
                    <View style={styles.emptyContainer}>
                      <Text style={styles.emptyText}>Loading your posts...</Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                  {REELS.map((img, index) => (
                    <TouchableOpacity key={index} style={styles.gridItemReel}>
                      <Image source={{ uri: img }} style={styles.gridImage} />
                      <View style={styles.playIconContainer}>
                        <Ionicons name="play" size={20} color="#fff" />
                      </View>
                      <Text style={styles.viewsText}>12.5k</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </Animated.View>

          {/* Bottom Space for Tab Bar */}
          <View style={{ height: 100 }} />

        </Animated.ScrollView>
      </View>

      {/* Modern Friends Management Modal */}
      <Modal
        visible={isFriendsModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsFriendsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalCloseOverlay} 
            activeOpacity={1} 
            onPress={() => setIsFriendsModalVisible(false)} 
          />
          <View style={[styles.friendsModalContent, { backgroundColor: cardBackground }]}>
            <View style={[styles.modalHeader, { borderBottomColor }]}>
              <View style={[styles.modalHandle, { backgroundColor: borderBottomColor }]} />
              <Text style={[styles.modalTitle, { color: textColor }]}>Friends</Text>
              <TouchableOpacity onPress={() => setIsFriendsModalVisible(false)} style={[styles.modalCloseBtn, { backgroundColor: iconBackground }]}>
                <Ionicons name="close" size={20} color={textColor} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={friends}
              keyExtractor={(item, index) => `${item._id}-${index}`}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.friendsList}
              renderItem={({ item }) => (
                <View style={[styles.friendListItem, { backgroundColor: friendListItemBackground }]}>
                  <View style={styles.friendInfo}>
                    <Image source={{ uri: item.avatar || 'https://ui-avatars.com/api/?name='+item.name }} style={[styles.friendAvatar, { borderColor: backgroundColor }]} />
                    <View>
                      <Text style={[styles.friendName, { color: textColor }]}>{item.name}</Text>
                      <Text style={[styles.friendHandle, { color: secondaryTextColor }]}>@{item.name.toLowerCase().replace(' ', '')}</Text>
                    </View>
                  </View>
                  <TouchableOpacity 
                    style={[styles.unfollowBtn, unfollowingId === item._id && { opacity: 0.5 }, { backgroundColor: cardBackground, borderColor: borderBottomColor }]}
                    onPress={() => handleUnfollow(item._id)}
                    disabled={unfollowingId === item._id}
                  >
                    {unfollowingId === item._id ? (
                      <ActivityIndicator size="small" color={secondaryTextColor} />
                    ) : (
                      <Text style={styles.unfollowBtnText}>Unfollow</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.emptyFriends}>
                  <Text style={[styles.emptyFriendsText, { color: secondaryTextColor }]}>No friends to show yet.</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingTop: 0,
  },
  sheetSection: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 38,
    borderTopRightRadius: 38,
    paddingTop: 10,
    minHeight: height,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 5,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    gap: 15,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 15,
  },
  iconBtn: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 20,
  },
  profileHeader: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 10,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#fff',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#007AFF',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  name: {
    fontSize: 24,
    fontWeight: '800',
  },
  handle: {
    fontSize: 14,
    marginBottom: 6,
  },
  bio: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 15,
    paddingHorizontal: 30,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  editProfileBtn: {
    backgroundColor: '#333',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    width: 140,
    alignItems: 'center',
  },
  editProfileText: {
    color: '#fff',
    fontWeight: '600',
  },
  shareBtn: {
    backgroundColor: '#fff',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginTop: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.3)',
  },
  logoutButtonText: {
    color: '#FF3B30',
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    marginHorizontal: 30,
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  friendsSection: {
    paddingHorizontal: 30,
    marginBottom: 20,
  },
  friendsWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.4)',
    padding: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  avatarPile: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pileImg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#fff',
  },
  pileMore: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  pileMoreText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#666',
  },
  friendsInfoText: {
    fontSize: 12,
    color: '#888',
    marginLeft: 12,
    fontWeight: '500',
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCloseOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  friendsModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    height: height * 0.75,
    paddingBottom: 40,
  },
  modalHeader: {
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalHandle: {
    width: 40,
    height: 5,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111',
  },
  modalCloseBtn: {
    position: 'absolute',
    right: 20,
    top: 25,
    backgroundColor: '#f2f2f7',
    padding: 6,
    borderRadius: 20,
  },
  friendsList: {
    padding: 20,
  },
  friendListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#f9f9fb',
    padding: 12,
    borderRadius: 20,
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  friendAvatar: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    borderWidth: 2,
    borderColor: '#fff',
  },
  friendName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111',
  },
  friendHandle: {
    fontSize: 12,
    color: '#999',
    marginTop: 1,
  },
  unfollowBtn: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#eee',
    minWidth: 90,
    alignItems: 'center',
  },
  unfollowBtnText: {
    fontSize: 13,
    color: '#ff3b30',
    fontWeight: '700',
  },
  emptyFriends: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
  },
  emptyFriendsText: {
    fontSize: 14,
    color: '#999',
    fontWeight: '500',
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  gridContainer: {
    paddingHorizontal: 15,
  },
  postListContainer: {
    width: '100%',
    paddingTop: 10,
  },
  postCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 24,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  postCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  postCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  postCardUser: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  postCardTime: {
    fontSize: 12,
    color: '#999',
  },
  postImageContainer: {
    width: '100%',
    height: 220,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 12,
  },
  postCardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  postCardText: {
    fontSize: 15,
    color: '#444',
    lineHeight: 22,
    marginBottom: 15,
  },
  postCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.04)',
  },
  postCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  postCardAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  postCardActionText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
  },
  gridItem: {
    width: COLUMN_SIZE,
    height: COLUMN_SIZE,
    marginBottom: 1,
  },
  gridItemReel: {
    width: COLUMN_SIZE,
    height: COLUMN_SIZE * 1.5, // Reels උස වැඩියි
    marginBottom: 1,
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  playIconContainer: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 15,
    padding: 4,
  },
  viewsText: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 10,
    fontWeight: '500',
  },
});