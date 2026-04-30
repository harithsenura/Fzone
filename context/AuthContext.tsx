import React, { createContext, useState, useEffect, ReactNode, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '@/config/api';
import { io, Socket } from 'socket.io-client';
import { Alert, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

interface User {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
  bio?: string;
}

interface ProfileData {
  posts: any[];
  friends: any[];
  stats: {
    postsCount: number;
    friendsCount: number;
    likesCount: string;
  };
  friendStatus?: 'none' | 'requested' | 'pending' | 'friends';
}

interface AuthContextType {
  user: User | null;
  profileData: ProfileData | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (name: string, email: string, mobile: string, password: string) => Promise<{ success: boolean; error?: string }>;
  updateProfile: (id: string, avatar?: string, bio?: string) => Promise<{ success: boolean; error?: string }>;
  refreshProfile: () => Promise<void>;
  optimisticRemoveFriend: (userId: string) => void;
  socket: Socket | null;
  globalUsersCache: Record<string, ProfileData>;
  preFetchUserProfile: (userId: string) => Promise<void>;
  logout: () => Promise<void>;
  activeChatId: string | null;
  setActiveChatId: (id: string | null) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const GlobalNotification = ({ notification, onDismiss }: { notification: any, onDismiss: () => void }) => {
  return (
    <Animated.View 
      entering={FadeInUp.springify().damping(14).mass(0.5)} 
      exiting={FadeOutUp.duration(200)}
      style={styles.notificationContainer}
    >
      <TouchableOpacity activeOpacity={0.8} onPress={onDismiss} style={styles.notificationContent}>
        <View style={styles.notificationIcon}>
          <Ionicons name="chatbubble-ellipses" size={20} color="#fff" />
        </View>
        <View style={styles.notificationTextContainer}>
          <Text style={styles.notificationTitle}>{notification.title}</Text>
          <Text style={styles.notificationMessage} numberOfLines={1}>{notification.message}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [globalUsersCache, setGlobalUsersCache] = useState<Record<string, ProfileData>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [notification, setNotification] = useState<{ title: string, message: string } | null>(null);
  const [activeChatId, setActiveChatIdState] = useState<string | null>(null);
  const activeChatIdRef = useRef<string | null>(null);

  const setActiveChatId = (id: string | null) => {
    setActiveChatIdState(id);
    activeChatIdRef.current = id;
  };

  useEffect(() => {
    if (user?._id) {
      const newSocket = io(API_BASE_URL);
      setSocket(newSocket);

      newSocket.emit('joinUser', user._id);

      newSocket.on('newNotification', (notif: any) => {
        if (notif.type === 'FRIEND_REQUEST') {
          Alert.alert(
            "New Friend Request",
            `${notif.fromUser.name} ${notif.message}`,
            [{ text: "OK" }]
          );
        } else if (notif.type === 'NEW_MESSAGE') {
          if (activeChatIdRef.current === notif.fromUser._id) {
            return;
          }
          
          setNotification({
            title: notif.fromUser.name,
            message: notif.message
          });
          
          setTimeout(() => {
            setNotification(null);
          }, 3500);
        }
      });

      newSocket.on('new_post', (post) => {
        if (post.user?._id === user._id) {
          setProfileData(prev => {
            if (!prev) return null;
            const formattedPost = {
              id: post._id,
              type: post.images && post.images.length > 0 ? 'image' : 'text',
              image: post.images && post.images.length > 0 ? post.images[0] : null,
              text: post.text,
              likes: 0,
              time: 'Just now',
            };
            
            if (prev.posts.some(p => p.id === formattedPost.id)) return prev;

            return {
              ...prev,
              posts: [formattedPost, ...prev.posts],
              stats: {
                ...prev.stats,
                postsCount: prev.stats.postsCount + 1
              }
            };
          });
        }

        setGlobalUsersCache(prev => {
          const posterId = post.user?._id;
          if (!posterId || !prev[posterId]) return prev;

          const formattedPost = {
            id: post._id,
            type: post.images && post.images.length > 0 ? 'image' : 'text',
            image: post.images && post.images.length > 0 ? post.images[0] : null,
            text: post.text,
            likes: 0,
            time: 'Just now',
          };

          const userCache = prev[posterId];
          if (userCache.posts.some(p => p.id === formattedPost.id)) return prev;

          return {
            ...prev,
            [posterId]: {
              ...userCache,
              posts: [formattedPost, ...userCache.posts],
              stats: {
                ...userCache.stats,
                postsCount: (userCache.stats?.postsCount || 0) + 1,
                friendsCount: userCache.stats?.friendsCount || 0,
                likesCount: userCache.stats?.likesCount || '0'
              }
            }
          };
        });
      });

      return () => {
        newSocket.close();
      };
    }
  }, [user?._id]);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        fetchProfileSilently(parsedUser._id);
      }
    } catch (error) {
      console.log('Error loading user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProfileSilently = async (userId: string) => {
    try {
      const cacheKey = `@full_profile_cache_${userId}`;
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        setProfileData(JSON.parse(cached));
      }

      const response = await fetch(`${API_BASE_URL}/api/profile/full/${userId}`);
      if (response.ok) {
        const data = await response.json();
        const formatted = {
          posts: data.posts.map((p: any) => ({
            id: p._id,
            type: p.images && p.images.length > 0 ? 'image' : 'text',
            image: p.images && p.images.length > 0 ? p.images[0] : null,
            text: p.text,
            likes: p.likesCount || 0,
            time: new Date(p.createdAt).toLocaleDateString(),
          })),
          friends: data.friends,
          stats: data.stats
        };
        setProfileData(formatted);
        await AsyncStorage.setItem(cacheKey, JSON.stringify(formatted));
      }
    } catch (error) {
      console.log('Pre-fetch failed:', error);
    }
  };

  const refreshProfile = async () => {
    if (user?._id) {
      await fetchProfileSilently(user._id);
    }
  };

  const optimisticRemoveFriend = (userId: string) => {
    if (!profileData) return;
    
    const updatedFriends = profileData.friends.filter(f => f._id !== userId);
    const updatedStats = {
      ...profileData.stats,
      friendsCount: Math.max(0, profileData.stats.friendsCount - 1)
    };
    
    setProfileData({
      ...profileData,
      friends: updatedFriends,
      stats: updatedStats
    });
  };

  const preFetchUserProfile = async (userId: string) => {
    if (globalUsersCache[userId]) return;

    try {
      const cacheKey = `@profile_cache_${userId}`;
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        setGlobalUsersCache(prev => ({ ...prev, [userId]: parsed }));
      }

      await new Promise(resolve => setTimeout(resolve, Math.random() * 500));

      const response = await fetch(`${API_BASE_URL}/api/profile/full/${userId}?currentUserId=${user?._id}`);
      if (response.ok) {
        const data = await response.json();
        const formatted = {
           posts: data.posts.map((p: any) => ({
              id: p._id,
              type: p.images && p.images.length > 0 ? 'image' : 'text',
              image: p.images && p.images.length > 0 ? p.images[0] : null,
              text: p.text,
              likes: p.likesCount || 0,
              time: new Date(p.createdAt).toLocaleDateString(),
           })),
           friends: data.friends,
           stats: data.stats,
           friendStatus: data.friendStatus
        };
        
        setGlobalUsersCache(prev => ({ ...prev, [userId]: formatted }));
        await AsyncStorage.setItem(cacheKey, JSON.stringify(formatted));
      }
    } catch (error) {
      console.log('Global pre-fetch failed:', userId, error);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        return { success: false, error: `Server error: ${response.status}. Please check if backend is running.` };
      }

      if (response.ok) {
        const userData = data.user;
        setUser(userData);
        await AsyncStorage.setItem('user', JSON.stringify(userData));
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Login failed' };
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return { success: false, error: 'Request timeout. Please check your connection.' };
      }
      if (error.message?.includes('Network request failed') || error.message?.includes('fetch')) {
        return { success: false, error: 'Cannot connect to server. Make sure backend is running on port 3001.' };
      }
      return { success: false, error: 'Network error. Please check your connection.' };
    }
  };

  const signup = async (name: string, email: string, mobile: string, password: string) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, mobile, password }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        return { success: false, error: `Server error: ${response.status}. Please check if backend is running.` };
      }

      if (response.ok) {
        const userData = data.user;
        setUser(userData);
        await AsyncStorage.setItem('user', JSON.stringify(userData));
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Signup failed' };
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return { success: false, error: 'Request timeout. Please check your connection.' };
      }
      if (error.message?.includes('Network request failed') || error.message?.includes('fetch')) {
        return { success: false, error: 'Cannot connect to server. Make sure backend is running on port 3001.' };
      }
      return { success: false, error: 'Network error. Please check your connection.' };
    }
  };

  const updateProfile = async (id: string, avatar?: string, bio?: string) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${API_BASE_URL}/api/auth/profile/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ avatar, bio }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type');
      let data;
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        return { success: false, error: `Server error: ${response.status}` };
      }

      if (response.ok) {
        const userData = data.user;
        setUser(userData);
        await AsyncStorage.setItem('user', JSON.stringify(userData));
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Update failed' };
      }
    } catch (error: any) {
      return { success: false, error: 'Network error. Please check your connection.' };
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('user');
      setUser(null);
    } catch (error) {
      console.log('Error logging out:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      profileData, 
      isLoading, 
      login, 
      signup, 
      updateProfile, 
      refreshProfile, 
      optimisticRemoveFriend,
      socket,
      globalUsersCache,
      preFetchUserProfile,
      logout,
      activeChatId,
      setActiveChatId 
    }}>
      {children}
      {notification && <GlobalNotification notification={notification} onDismiss={() => setNotification(null)} />}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const styles = StyleSheet.create({
  notificationContainer: {
    position: 'absolute',
    top: 55, // Account for iOS notch
    left: 20,
    right: 20,
    zIndex: 9999,
    alignItems: 'center',
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 5,
    width: '100%',
  },
  notificationIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationTextContainer: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
    marginBottom: 2,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#666',
  },
});
