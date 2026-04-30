import React, { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  Image, 
  TouchableOpacity, 
  TextInput, 
  Dimensions,
  SafeAreaView,
  Modal,
  RefreshControl,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import Animated, { FadeIn, FadeInDown, Layout } from 'react-native-reanimated';
import { AnimatedBackground } from '@/components/AnimatedBackground'; 
import { API_BASE_URL } from '@/config/api';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { io } from 'socket.io-client';
import { useThemeColor } from '@/hooks/use-theme-color';

const { width, height } = Dimensions.get('window');

interface Post {
  id: string;
  user: string;
  userImg: string;
  time: string;
  text?: string;
  image?: string;
  images?: string[];
  likesCount: number;
  comments: any[];
}

export default function ExploreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { preFetchUserProfile } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<Post[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const secondaryTextColor = useThemeColor({ light: '#8E8E93', dark: '#94A3B8' }, 'text');
  const cardBackground = useThemeColor({ light: '#fff', dark: '#1E1E1E' }, 'card');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#1E1E1E' }, 'background');
  const borderBottomColor = useThemeColor({ light: '#F0F0F0', dark: '#2C2C2E' }, 'border');
  const btnBackground = useThemeColor({ light: '#F0F0F0', dark: '#2C2C2E' }, 'background');
  
  const [modalVisible, setModalVisible] = useState(false);
  const [initialIndex, setInitialIndex] = useState(0);

  const allUsersRef = useRef<any[]>([]);

  const CACHE_KEY = '@cached_explore_posts';
  const USERS_CACHE_KEY = '@cached_all_users';

  const loadCachedPosts = async () => {
    try {
      const cachedData = await AsyncStorage.getItem(CACHE_KEY);
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        setPosts(parsed);
        setFilteredPosts(parsed);
      }
    } catch (e) {
      console.error('Error loading explore cache:', e);
    }
  };

  const prefetchAllUsers = async () => {
    try {
      const cached = await AsyncStorage.getItem(USERS_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        allUsersRef.current = parsed;
      }

      const response = await fetch(`${API_BASE_URL}/api/users/all`);
      if (response.ok) {
        const data = await response.json();
        const mapped = data.map((u: any) => ({
          ...u,
          id: u._id,
          avatar: u.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=500&q=80'
        }));
        allUsersRef.current = mapped;
        await AsyncStorage.setItem(USERS_CACHE_KEY, JSON.stringify(mapped));
      }
    } catch (err) {
      console.error('Error prefetching users:', err);
    }
  };

  const fetchPosts = async (force = false) => {
    try {
      const latestPostTimestamp = posts.length > 0 
        ? Math.max(...posts.map(p => new Date(p.createdAt || 0).getTime())) 
        : 0;

      let url = `${API_BASE_URL}/api/posts?`;
      if (force && latestPostTimestamp > 0) {
        url += `since=${latestPostTimestamp}`;
      }

      const response = await fetch(url);
      if (response.ok) {
        const dbPosts = await response.json();
        const formatted = dbPosts
          .filter((p: any) => p.images && p.images.length > 0) // Only photo posts
          .map((p: any) => ({
            ...p,
            id: p._id,
            user: p.user.name,
            userImg: p.user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=500&q=80',
            time: new Date(p.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            text: p.text,
            image: p.images[0],
            images: p.images,
            likesCount: p.likesCount || 0,
            comments: p.comments || []
          }));

        if (force && latestPostTimestamp > 0) {
          if (formatted.length === 0) return;
          
          setPosts(prev => {
            const dbPostIds = new Set(formatted.map((p: any) => p.id));
            const existingPosts = prev.filter(p => !dbPostIds.has(p.id));
            const newPosts = [...formatted, ...existingPosts];
            AsyncStorage.setItem(CACHE_KEY, JSON.stringify(newPosts.slice(0, 50))).catch(() => { });
            return newPosts;
          });
          setFilteredPosts(prev => {
            const dbPostIds = new Set(formatted.map((p: any) => p.id));
            const existingPosts = prev.filter(p => !dbPostIds.has(p.id));
            return [...formatted, ...existingPosts];
          });
        } else {
          const shuffled = [...formatted].sort(() => Math.random() - 0.5);
          setPosts(shuffled);
          setFilteredPosts(shuffled);
          await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(shuffled));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadCachedPosts();
      fetchPosts();
    }, [])
  ),
  
  useEffect(() => {
    prefetchAllUsers();
    fetchPosts();

    const socket = io(API_BASE_URL);

    socket.on('new_post', (post) => {
      if (!post.images || post.images.length === 0) return;

      const formatted = {
        ...post,
        id: post._id,
        user: post.user.name,
        userImg: post.user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=500&q=80',
        time: new Date(post.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: post.text,
        image: post.images[0],
        images: post.images,
        likesCount: post.likesCount || 0,
        comments: post.comments || []
      };

      setPosts(prev => {
        if (prev.some(p => p.id === formatted.id)) return prev;
        const newPosts = [formatted, ...prev];
        AsyncStorage.setItem(CACHE_KEY, JSON.stringify(newPosts.slice(0, 50))).catch(() => { });
        return newPosts;
      });
      setFilteredPosts(prev => {
        if (prev.some(p => p.id === formatted.id)) return prev;
        return [formatted, ...prev];
      });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const onRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    
    const startTime = Date.now();
    
    const fetchPromise = Promise.all([fetchPosts(true), prefetchAllUsers()]).catch(console.error);
    const timeoutPromise = new Promise(resolve => setTimeout(resolve, 1500));
    
    await Promise.race([fetchPromise, timeoutPromise]);
    
    const elapsed = Date.now() - startTime;
    if (elapsed < 1000) {
      await new Promise(resolve => setTimeout(resolve, 1000 - elapsed));
    }
    
    setRefreshing(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const [userSearchResults, setUserSearchResults] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'posts' | 'users'>('posts');

  const handleSearch = (text: string) => {
    setSearch(text);
    if (!text.trim()) {
      setFilteredPosts(posts);
      setUserSearchResults([]);
      return;
    }
    
    const query = text.toLowerCase();
    
    const filtered = posts.filter(p => 
      p.user.toLowerCase().includes(query) || 
      (p.text && p.text.toLowerCase().includes(query))
    );
    setFilteredPosts(filtered);

    const matchedUsers = allUsersRef.current.filter(u => 
      u.name && u.name.toLowerCase().includes(query)
    );
    setUserSearchResults(matchedUsers);

    matchedUsers.slice(0, 5).forEach(u => {
      if (u.id) preFetchUserProfile(u.id);
    });
  };

  const openPostFeed = (index: number) => {
    setInitialIndex(index);
    setModalVisible(true);
  };

  const renderUserItem = ({ item, index }: { item: any, index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 50).springify()} style={[styles.userCard, { backgroundColor: cardBackground }]}>
      <Image source={{ uri: item.avatar }} style={styles.userAvatar} />
      <View style={styles.userInfo}>
        <Text style={[styles.userName, { color: textColor }]}>{item.name}</Text>
        <Text style={[styles.userHandle, { color: secondaryTextColor }]}>@{item.name.toLowerCase().replace(' ', '_')}</Text>
      </View>
      <TouchableOpacity 
        style={[styles.viewProfileBtn, { backgroundColor: cardBackground, borderColor: borderBottomColor }]}
        onPress={() => router.push({
          pathname: "/user/[id]",
          params: { id: item.id, name: item.name, avatar: item.avatar }
        })}
      >
        <Text style={styles.viewProfileText}>View</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderGridItem = ({ item, index }: { item: Post, index: number }) => (
    <Animated.View 
      entering={FadeInDown.delay(index * 50).springify().damping(12)}
      style={styles.gridItem}
    >
      <TouchableOpacity 
        style={styles.gridImageBtn}
        onPress={() => openPostFeed(index)}
        activeOpacity={0.9}
      >
        <Image source={{ uri: item.image }} style={styles.gridImage} />
        <View style={styles.gridOverlay}>
          <View style={styles.overlayBottom}>
            <View style={styles.miniLikes}>
               <Ionicons name="heart" size={12} color="#fff" />
               <Text style={styles.miniLikesText}>{item.likesCount}</Text>
            </View>
          </View>
        </View>
        {item.images && item.images.length > 1 && (
          <View style={styles.multiIcon}>
            <Ionicons name="copy" size={14} color="#fff" />
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );

  const renderFeedItem = ({ item, index }: { item: Post, index: number }) => (
    <Animated.View 
      entering={FadeIn.delay(100)} 
      style={[styles.fullPostCard, { backgroundColor: cardBackground, borderColor: borderBottomColor }]}
    >
      {/* Header */}
      <View style={styles.postUserRow}>
        <Image source={{ uri: item.userImg }} style={styles.postUserAvatar} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.postUserName, { color: textColor }]}>{item.user}</Text>
          <Text style={[styles.postTime, { color: secondaryTextColor }]}>{item.time}</Text>
        </View>
        <TouchableOpacity style={[styles.moreIconBtn, { backgroundColor: btnBackground }]}>
          <Ionicons name="ellipsis-horizontal" size={20} color={secondaryTextColor} />
        </TouchableOpacity>
      </View>

      {/* Content Image with Margin and Radius */}
      <View style={styles.imageContainer}>
        {item.images && item.images.length > 1 ? (
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
            {item.images.map((img, idx) => (
              <Image key={idx} source={{ uri: img }} style={styles.fullPostImage} />
            ))}
          </ScrollView>
        ) : (
          <Image source={{ uri: item.image }} style={styles.fullPostImage} />
        )}
      </View>

      {/* Footer */}
      <View style={styles.postDetails}>
        <View style={styles.interactionRow}>
          <TouchableOpacity style={[styles.interactionIcon, { backgroundColor: cardBackground, borderColor: borderBottomColor }]}>
            <Ionicons name="heart-outline" size={26} color={secondaryTextColor} />
            <Text style={[styles.interactionText, { color: textColor }]}>{item.likesCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.interactionIcon, { backgroundColor: cardBackground, borderColor: borderBottomColor }]}>
            <Ionicons name="chatbubble-outline" size={24} color={secondaryTextColor} />
            <Text style={[styles.interactionText, { color: textColor }]}>{item.comments.length}</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={[styles.bookmarkBtn, { backgroundColor: cardBackground, borderColor: borderBottomColor }]}>
            <Ionicons name="bookmark-outline" size={24} color={secondaryTextColor} />
          </TouchableOpacity>
        </View>
        {item.text && (
          <Text style={[styles.postText, { color: textColor }]} numberOfLines={3}>
            {item.text}
          </Text>
        )}
      </View>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <StatusBar style="auto" />
      {/* <AnimatedBackground /> */}

      <View style={{ flex: 1, paddingTop: insets.top }}>
        <View style={styles.contentContainer}>
          
          <View style={styles.header}>
            <View>
              <Text style={[styles.greetingText, { color: secondaryTextColor }]}>Discover,</Text>
              <Text style={[styles.headerTitle, { color: textColor }]}>Explore Content</Text>
            </View>
            <View style={[styles.searchContainer, { backgroundColor: cardBackground }]}>
              <Ionicons name="search" size={18} color={secondaryTextColor} style={styles.searchIcon} />
              <TextInput 
                placeholder="Search users or interesting posts..." 
                style={[styles.searchInput, { color: textColor }]} 
                placeholderTextColor={secondaryTextColor}
                value={search}
                onChangeText={handleSearch}
              />
            </View>
          </View>

          {/* Search Content */}
          <View style={styles.tabHeader}>
            <TouchableOpacity 
              style={[styles.miniTab, { backgroundColor: btnBackground }, activeTab === 'posts' && [styles.activeMiniTab, { backgroundColor: textColor }]]}
              onPress={() => setActiveTab('posts')}
            >
              <Text style={[styles.miniTabText, { color: secondaryTextColor }, activeTab === 'posts' && [styles.activeMiniTabText, { color: backgroundColor }]]}>Posts</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.miniTab, { backgroundColor: btnBackground }, activeTab === 'users' && [styles.activeMiniTab, { backgroundColor: textColor }]]}
              onPress={() => setActiveTab('users')}
            >
              <Text style={[styles.miniTabText, { color: secondaryTextColor }, activeTab === 'users' && [styles.activeMiniTabText, { color: backgroundColor }]]}>People</Text>
            </TouchableOpacity>
          </View>

          {loading && posts.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
            </View>
          ) : (
            activeTab === 'posts' ? (
              <FlatList
                key="posts-grid"
                data={filteredPosts}
                keyExtractor={item => item.id}
                renderItem={renderGridItem}
                numColumns={2}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.gridContent}
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
              />
            ) : (
              search.trim().length > 0 && userSearchResults.length === 0 ? (
                <View style={{ flex: 1, alignItems: 'center', paddingTop: 60 }}>
                  <Text style={{ fontSize: 40, marginBottom: 12 }}>🔍</Text>
                  <Text style={{ color: '#999', fontSize: 15, fontWeight: '600' }}>No users found</Text>
                  <Text style={{ color: '#C7C7CC', fontSize: 13, marginTop: 4 }}>Try a different name</Text>
                </View>
              ) : (
                <FlatList
                  key="users-list"
                  data={userSearchResults}
                  keyExtractor={item => item.id}
                  renderItem={renderUserItem}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.userListContent}
                />
              )
            )
          )}

        </View>
      </View>

      {/* Feed Detail Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={false}
        presentationStyle="fullScreen"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor }}>
          <StatusBar style="auto" translucent backgroundColor="transparent" />
          <AnimatedBackground />
          
          <FlatList
            data={filteredPosts}
            renderItem={({ item, index }) => renderFeedItem({ item, index })}
            keyExtractor={item => 'feed-' + item.id}
            initialScrollIndex={initialIndex}
            getItemLayout={(data, index) => ({
              length: 580, 
              offset: 580 * index,
              index,
            })}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ 
              paddingTop: 60 + insets.top, // Space for absolute header + notch
              paddingBottom: 50 
            }}
          />

          {/* Absolute Glass Header */}
          <BlurView intensity={80} tint={useThemeColor({ light: 'light', dark: 'dark' } as any, 'background')} style={[styles.modalHeader, { paddingTop: insets.top, height: 60 + insets.top, backgroundColor: 'transparent', borderBottomColor }]}>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
              <Ionicons name="chevron-back" size={28} color="#3B82F6" />
              <Text style={[styles.backLabel, { color: '#3B82F6' }]}>Back</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: textColor }]}>Discovery</Text>
            <View style={{ width: 80 }} /> 
          </BlurView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  contentContainer: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  greetingText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    marginBottom: 2
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#000',
    marginBottom: 20,
    letterSpacing: -0.5,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 22,
    paddingHorizontal: 15,
    height: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 16, color: '#333' },
  gridContent: { paddingHorizontal: 10, paddingBottom: 100 },
  gridItem: {
    width: (width - 20) / 2,
    height: (width - 20) / 1.5, // Taller aspect ratio for modern look
    padding: 6,
  },
  gridImageBtn: { 
    flex: 1, 
    borderRadius: 24, 
    overflow: 'hidden',
    backgroundColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  gridImage: { width: '100%', height: '100%' },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.15)',
    justifyContent: 'flex-end',
    padding: 12,
  },
  overlayBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  miniLikes: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  miniLikesText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 4,
  },
  multiIcon: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 8,
    padding: 4,
  },
  tabHeader: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 15 },
  miniTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F0F0F0' },
  activeMiniTab: { backgroundColor: '#333' },
  miniTabText: { fontSize: 13, fontWeight: '600', color: '#666' },
  activeMiniTabText: { color: '#fff' },
  userListContent: { paddingHorizontal: 20, paddingBottom: 100 },
  userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FA', padding: 12, borderRadius: 20, marginBottom: 10 },
  userAvatar: { width: 50, height: 50, borderRadius: 25, marginRight: 15 },
  userInfo: { flex: 1 },
  userName: { fontSize: 16, fontWeight: '700' },
  userHandle: { fontSize: 13, marginTop: 2 },
  viewProfileBtn: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 15, borderWidth: 1 },
  viewProfileText: { fontSize: 14, fontWeight: '700', color: '#3B82F6' },
  modalHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000',
  },
  closeBtn: { flexDirection: 'row', alignItems: 'center', width: 80 },
  backLabel: { fontSize: 17, color: '#007AFF', marginLeft: -2 },
  fullPostCard: {
    borderRadius: 30,
    marginHorizontal: 15,
    marginBottom: 20,
    padding: 10,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 3,
  },
  postUserRow: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  postUserAvatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12, borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' },
  postUserName: { fontSize: 16, fontWeight: '700' },
  postTime: { fontSize: 12, marginTop: 2 },
  moreIconBtn: { padding: 8, borderRadius: 15 },
  imageContainer: { borderRadius: 22, overflow: 'hidden' },
  fullPostImage: { width: width - 50, height: 420, borderRadius: 22 },
  postDetails: { padding: 12 },
  interactionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  interactionIcon: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginRight: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  interactionText: { marginLeft: 8, fontSize: 14, fontWeight: '700' },
  bookmarkBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  postText: { fontSize: 15, lineHeight: 22, paddingHorizontal: 4 },
});