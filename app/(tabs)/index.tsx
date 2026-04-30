import { AnimatedBackground } from '@/components/AnimatedBackground';
import { useThemeColor } from '@/hooks/use-theme-color';
import { API_BASE_URL } from '@/config/api';
import { useAuth } from '@/context/AuthContext';
import { uploadToCloudinary } from '@/utils/cloudinary';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Video } from 'expo-av';
import { BlurView } from 'expo-blur';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  Dimensions,
  FlatList,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  FadeIn,
  FadeInDown,
  FadeOut,
  interpolate,
  Layout,
  runOnJS,
  SlideInDown,
  SlideOutDown,
  useAnimatedProps,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { io } from 'socket.io-client';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');
const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

interface Comment {
  id: string;
  user: string;
  avatar: string | null;
  text: string;
  time: string;
  replies: Comment[];
}


const CACHE_KEY = '@cached_posts';

const FILTERS = [
  { id: 'none', name: 'Normal', color: 'transparent' },
  { id: 'sepia', name: 'Sepia', color: 'rgba(112, 66, 20, 0.2)' },
  { id: 'cool', name: 'Cool', color: 'rgba(0, 100, 255, 0.15)' },
  { id: 'warm', name: 'Warm', color: 'rgba(255, 100, 0, 0.15)' },
  { id: 'vintage', name: 'Vintage', color: 'rgba(0, 0, 0, 0.2)' },
  { id: 'bw', name: 'B&W', color: 'rgba(255, 255, 255, 0.2)' },
];

export default function HomeScreen() {
  const router = useRouter(); // Router Hook
  const { user: currentUser, preFetchUserProfile, refreshProfile } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [userStories, setUserStories] = useState<any[]>([]);
  const [isViewersSheetVisible, setIsViewersSheetVisible] = useState(false);
  const [storyViewers, setStoryViewers] = useState<{ viewCount: number, viewers: any[], likers: any[] }>({ viewCount: 0, viewers: [], likers: [] });
  const [activeViewerTab, setActiveViewerTab] = useState<'views' | 'likes'>('views');
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);

  const [isCreateStoryOpen, setIsCreateStoryOpen] = useState(false);
  const [cameraType, setCameraType] = useState<'back' | 'front'>('back');
  const [flashMode, setFlashMode] = useState<'on' | 'off'>('off');
  const [capturedMedia, setCapturedMedia] = useState<{ uri: string, type: 'image' | 'video' } | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('none');
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);
  const lastFetchTime = useRef(0);
  const uploadProgress = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const insets = useSafeAreaInsets();
  
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const secondaryTextColor = useThemeColor({ light: '#666', dark: '#9BA1A6' }, 'text');
  const cardBackground = useThemeColor({ light: '#fff', dark: '#1E1E1E' }, 'card');
  const borderBottomColor = useThemeColor({ light: 'rgba(0,0,0,0.05)', dark: 'rgba(255,255,255,0.1)' }, 'border');
  const inputBackground = useThemeColor({ light: '#F2F2F7', dark: '#2C2C2E' }, 'background');
  const placeholderColor = useThemeColor({ light: '#999', dark: '#666' }, 'text');

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const headerStoriesAnimatedStyle = useAnimatedStyle(() => {
    const scrollPos = Math.max(0, scrollY.value);
    return {
      transform: [
        { translateY: scrollPos * 0.55 },
        { scale: 1 }
      ],
      opacity: interpolate(scrollPos, [0, 300], [1, 0], Extrapolation.CLAMP),
    };
  });

  const headerBlurProps = useAnimatedProps(() => {
    return {
      intensity: interpolate(scrollY.value, [0, 300], [0, 20], Extrapolation.CLAMP),
    };
  });

  const feedAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: interpolate(
            scrollY.value,
            [0, 300],
            [0, -80],
            Extrapolation.CLAMP
          )
        }
      ],
    };
  }, []);

  const loadCachedPosts = async () => {
    try {
      const cachedData = await AsyncStorage.getItem(CACHE_KEY);
      if (cachedData) {
        setPosts(prevPosts => {
          const parsed = JSON.parse(cachedData);
          const dbPostIds = new Set(parsed.map((p: any) => p.id));
          const optimisticPosts = prevPosts.filter(p => !dbPostIds.has(p.id) && p.time === 'Just now');
          return [...optimisticPosts, ...parsed];
        });
      }
    } catch (e) {
      console.error('Error loading cache:', e);
    }
  };

  const fetchPosts = async (force = false) => {
    const now = Date.now();
    if (!force && now - lastFetchTime.current < 10000) {
      return;
    }
    lastFetchTime.current = now;

    try {
      const latestPostTimestamp = posts.length > 0 ? new Date(posts[0].createdAt).getTime() : 0;

      let url = `${API_BASE_URL}/api/posts?`;
      if (currentUser?._id) url += `userId=${currentUser._id}&`;

      if (force && latestPostTimestamp > 0) {
        url += `since=${latestPostTimestamp}`;
      }

      const response = await fetch(url, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (response.ok) {
        const dbPosts = await response.json();

        if (force && latestPostTimestamp > 0 && dbPosts.length === 0) {
          return;
        }

        const optimizeImageUrl = (url: string) => {
          if (!url || typeof url !== 'string') return url;
          if (url.includes('cloudinary.com') && !url.includes('f_auto')) {
            const parts = url.split('/upload/');
            if (parts.length === 2) {
              return `${parts[0]}/upload/f_auto,q_auto,w_800/${parts[1]}`;
            }
          }
          return url;
        };

        const formattedDbPosts = dbPosts.map((p: any) => ({
          ...p,
          id: p._id,
          userId: p.user._id,
          user: p.user.name,
          userImg: optimizeImageUrl(p.user.avatar) || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=500&q=80',
          time: new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          header: p.header,
          subHeader: p.subHeader,
          body: p.body || p.text,
          title: p.text,
          image: p.images && p.images.length === 1 ? optimizeImageUrl(p.images[0]) : undefined,
          images: p.images && p.images.length > 1 ? p.images.map(optimizeImageUrl) : undefined,
          likesCount: p.likesCount || 0,
          isLiked: p.isLiked || false,
          isSaved: false,
          comments: p.comments || []
        }));

        setPosts(prevPosts => {
          if (force && latestPostTimestamp > 0 && formattedDbPosts.length > 0) {
            const dbPostIds = new Set(formattedDbPosts.map((p: any) => p.id));
            const existingPosts = prevPosts.filter(p => !dbPostIds.has(p.id));
            const newPosts = [...formattedDbPosts, ...existingPosts];
            AsyncStorage.setItem(CACHE_KEY, JSON.stringify(newPosts.slice(0, 50))).catch(() => { });
            return newPosts;
          } else {
            const newPosts = [...formattedDbPosts];
            AsyncStorage.setItem(CACHE_KEY, JSON.stringify(newPosts.slice(0, 50))).catch(() => { });
            return newPosts;
          }
        });

        const uniqueUserIds = [...new Set(dbPosts.map((p: any) => p.user?._id))].filter(id => id);
        uniqueUserIds.forEach(id => {
          if (id !== currentUser?._id) {
            preFetchUserProfile(id as string);
          }
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchStories = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/stories`);
      if (response.ok) {
        const data = await response.json();
        setUserStories(data);
      }
    } catch (error) {
      console.error('Error fetching stories:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadCachedPosts(); // Load from cache first
      fetchPosts(); // Then update from DB
      fetchStories(); // Fetch stories
    }, [currentUser?._id])
  );

  useEffect(() => {
    const uploadSub = DeviceEventEmitter.addListener('UPLOAD_POST', async (postData) => {
      setUploading(true);
      uploadProgress.value = 0;
      uploadProgress.value = withTiming(0.9, { duration: 1500 }); // Faster visual progress

      try {
        let cloudinaryUrls = [];
        if (postData.images && postData.images.length > 0) {
          cloudinaryUrls = await Promise.all(
            postData.images.map((img: string) => uploadToCloudinary(img))
          );
        }

        const finalPostData = {
          ...postData,
          images: cloudinaryUrls
        };

        const response = await fetch(`${API_BASE_URL}/api/posts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(finalPostData)
        });

        if (response.ok) {
          const post = await response.json();
          const formattedPost = {
            ...post,
            id: post._id,
            userId: post.user._id || currentUser?._id,
            user: post.user.name,
            userImg: post.user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=500&q=80',
            time: 'Just now',
            header: post.header,
            subHeader: post.subHeader,
            body: post.body || post.text,
            title: post.text,
            image: post.images && post.images.length === 1 ? post.images[0] : undefined,
            images: post.images && post.images.length > 1 ? post.images : undefined,
            likesCount: 0,
            isLiked: false,
            isSaved: false,
            comments: []
          };

          setPosts(prev => {
            const exists = prev.find(p => p.id === formattedPost.id);
            if (exists) return prev;
            return [formattedPost, ...prev];
          });

          uploadProgress.value = withTiming(1, { duration: 200 });
        } else {
          const errData = await response.json().catch(() => ({}));
          Alert.alert("Error", errData.error || "Failed to upload post to server.");
        }
      } catch (error) {
        console.error('Post Upload Failed:', error);
        Alert.alert("Error", "Failed to upload post. Please try again.");
      } finally {
        setTimeout(() => {
          setUploading(false);
          setTimeout(() => { uploadProgress.value = 0; }, 400); // Reset after height animation finishes
        }, 300);
      }
    });

    const handleNewStory = (story: any) => {
      setUserStories(prev => {
        const userId = story.user._id;
        const existingUserIndex = prev.findIndex(u => u.user._id === userId);

        if (existingUserIndex !== -1) {
          const updated = [...prev];
          const userObj = { ...updated[existingUserIndex] };
          if (!userObj.stories.find((s: any) => s._id === story._id)) {
            userObj.stories = [story, ...userObj.stories];
            updated.splice(existingUserIndex, 1);
            updated.unshift(userObj); // Move user to front
          }
          return updated;
        } else {
          return [{ user: story.user, stories: [story] }, ...prev];
        }
      });
    };

    fetchFriendRequests();

    const socket = io(API_BASE_URL.replace('https://', 'wss://').replace('http://', 'ws://'));

    if (currentUser?._id) {
      socket.emit('joinUser', currentUser._id);
    }

    socket.on('new_friend_request', (data) => {
      if (data.toUserId === currentUser?._id) {
        fetchFriendRequests(); // Refresh count/list
      }
    });

    socket.on('new_story', (story) => {
      handleNewStory(story);
    });

    socket.on('new_post', (post) => {
      if (post.user?._id === currentUser?._id) return;

      const optimizeImageUrl = (url: string) => {
        if (!url || typeof url !== 'string') return url;
        if (url.includes('cloudinary.com') && !url.includes('f_auto')) {
          const parts = url.split('/upload/');
          if (parts.length === 2) {
            return `${parts[0]}/upload/f_auto,q_auto,w_800/${parts[1]}`;
          }
        }
        return url;
      };

      const formattedPost = {
        ...post,
        id: post._id,
        userId: post.user._id,
        user: post.user.name,
        userImg: optimizeImageUrl(post.user.avatar) || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=500&q=80',
        time: new Date(post.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        header: post.header,
        subHeader: post.subHeader,
        body: post.body || post.text,
        title: post.text,
        image: post.images && post.images.length === 1 ? optimizeImageUrl(post.images[0]) : undefined,
        images: post.images && post.images.length > 1 ? post.images.map(optimizeImageUrl) : undefined,
        likesCount: post.likesCount || 0,
        isLiked: false, // For other users, it's initially unliked
        isSaved: false,
        comments: post.comments || []
      };

      setPosts(prev => {
        const exists = prev.find(p => p.id === formattedPost.id);
        if (exists) return prev;
        const newPosts = [formattedPost, ...prev];
        AsyncStorage.setItem(CACHE_KEY, JSON.stringify(newPosts.slice(0, 50))).catch(() => { });
        return newPosts;
      });
    });

    socket.on('postLikeUpdate', (data: { postId: string, likesCount: number, userId: string, isLiked: boolean }) => {
      setPosts(prev => {
        const newPosts = prev.map(p => {
          if (p.id === data.postId) {
            if (data.userId === currentUser?._id) {
              return { ...p, likesCount: data.likesCount, isLiked: data.isLiked };
            } else {
              return { ...p, likesCount: data.likesCount };
            }
          }
          return p;
        });
        AsyncStorage.setItem(CACHE_KEY, JSON.stringify(newPosts)).catch(() => { });
        return newPosts;
      });
    });

    socket.on('postCommentUpdate', (data: { postId: string, comment: any }) => {
      setPosts(prev => {
        const newPosts = prev.map(p => {
          if (p.id === data.postId) {
            const commentExists = p.comments?.some(c => (c.id || c._id) === data.comment._id);
            if (commentExists) return p;

            const displayComment = {
              ...data.comment,
              id: data.comment._id,
              time: 'Just now',
              replies: []
            };

            return {
              ...p,
              comments: [...(p.comments || []), displayComment]
            };
          }
          return p;
        });
        AsyncStorage.setItem(CACHE_KEY, JSON.stringify(newPosts)).catch(() => { });
        return newPosts;
      });
    });

    socket.on('newNotification', (notif: any) => {
      if (notif.type === 'LIKE') {
      }
    });

    prefetchExploreData();

    return () => {
      uploadSub.remove();
      socket.disconnect();
    };
  }, [currentUser]);

  const prefetchExploreData = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/posts`);
      if (response.ok) {
        const dbPosts = await response.json();
        const formatted = dbPosts
          .filter((p: any) => p.images && p.images.length > 0)
          .map((p: any) => ({
            id: p._id,
            user: p.user.name,
            userImg: p.user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=500&q=80',
            time: new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            text: p.text,
            image: p.images[0],
            images: p.images,
            likesCount: p.likesCount || 0,
            comments: p.comments || []
          }));
        await AsyncStorage.setItem('@cached_explore_posts', JSON.stringify(formatted));
      }
    } catch (e) {
      console.warn('Explore prefetch failed', e);
    }
  };

  const [friendRequests, setFriendRequests] = useState<any[]>([]);
  const [isRequestsModalVisible, setIsRequestsModalVisible] = useState(false);

  const fetchFriendRequests = async () => {
    if (!currentUser?._id) return;

    try {
      const cached = await AsyncStorage.getItem('@cached_friend_requests');
      if (cached) {
        const parsed = JSON.parse(cached);
        setFriendRequests(parsed);
      }
    } catch (e) { }

    try {
      const response = await fetch(`${API_BASE_URL}/api/friends/requests?userId=${currentUser._id}`);
      if (response.ok) {
        const data = await response.json();
        setFriendRequests(data);
        await AsyncStorage.setItem('@cached_friend_requests', JSON.stringify(data));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    const originalRequests = [...friendRequests];
    setFriendRequests(prev => prev.filter(r => r._id !== requestId));

    try {
      const response = await fetch(`${API_BASE_URL}/api/friends/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId })
      });
      if (!response.ok) {
        setFriendRequests(originalRequests); // Rollback
      } else {
        refreshProfile(); // Instantly update profile friend count
      }
    } catch (err) {
      console.error(err);
      setFriendRequests(originalRequests); // Rollback
    }
  };
  const handleDeletePost = async (postId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/posts/${postId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        const updatedPosts = posts.filter(p => p.id !== postId);
        setPosts(updatedPosts);

        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(updatedPosts));

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
    const isOwner = currentUser && (post.user?._id === currentUser._id || post.userId === currentUser._id);

    if (isOwner) {
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
    } else {
      Alert.alert("Options", "Post reporting feature coming soon!", [{ text: "OK" }]);
    }
  };


  const onRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);

    try {
      await fetchPosts(true);
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setRefreshing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [currentUser?._id]);

  const uploadProgressStyle = useAnimatedStyle(() => {
    return {
      width: `${uploadProgress.value * 100}%`
    };
  });

  const uploadContainerStyle = useAnimatedStyle(() => {
    return {
      height: withTiming(uploading ? 60 : 0, { duration: 400 }),
      opacity: withTiming(uploading ? 1 : 0, { duration: 300 }),
      marginTop: withTiming(uploading ? 10 : 0, { duration: 400 }),
      marginBottom: withTiming(uploading ? 5 : 0, { duration: 400 }),
    };
  });

  const [isSheetVisible, setIsSheetVisible] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ commentId: string, username: string } | null>(null);
  const inputRef = useRef<TextInput>(null);

  const [isStoryOpen, setIsStoryOpen] = useState(false);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [storyReplyText, setStoryReplyText] = useState('');
  const [storyLiked, setStoryLiked] = useState(false);
  const progress = useSharedValue(0);
  const likeScale = useSharedValue(1);

  const navigateToProfile = async (name: string, avatar: string, id?: string) => {
    if (id) {
      router.push({
        pathname: "/user/[id]",
        params: { id, name, avatar }
      });
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/users/all`);
      if (response.ok) {
        const users = await response.json();
        const matchedUser = users.find((u: any) => u.name === name);
        if (matchedUser && matchedUser._id) {
          router.push({
            pathname: "/user/[id]",
            params: { id: matchedUser._id, name, avatar }
          });
          return;
        }
      }
      console.warn("User not found in DB");
    } catch (e) {
      console.error("Error finding user:", e);
    }
  };

  const handleStoryPick = async () => {
    if (!permission) {
      return;
    }
    if (!permission.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert("Permission Required", "Please allow camera access to create stories.");
        return;
      }
    }
    setIsCreateStoryOpen(true);
    setCapturedMedia(null);
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: false,
        });
        setCapturedMedia({ uri: photo.uri, type: 'image' });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const pickStoryFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      setCapturedMedia({
        uri: result.assets[0].uri,
        type: result.assets[0].type === 'video' ? 'video' : 'image'
      });
    }
  };

  const uploadCreatedStory = async () => {
    if (!capturedMedia || !currentUser) return;

    setUploading(true);
    setIsCreateStoryOpen(false);
    uploadProgress.value = withTiming(0.9, { duration: 2000 });

    try {
      let finalUri = capturedMedia.uri;

      if (capturedMedia.type === 'image') {
        const actions: any[] = [{ resize: { width: 1080 } }];

        if (activeFilter === 'bw') {
        }

        const manipulated = await ImageManipulator.manipulateAsync(
          capturedMedia.uri,
          actions,
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
        );
        finalUri = manipulated.uri;
      }

      const cloudinaryUrl = await uploadToCloudinary(finalUri);

      const response = await fetch(`${API_BASE_URL}/api/stories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser._id,
          content: cloudinaryUrl,
          type: capturedMedia.type
        })
      });

      if (response.ok) {
        const newStory = await response.json();
        handleNewStory(newStory);
        uploadProgress.value = withTiming(1, { duration: 200 });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        const err = await response.json();
        Alert.alert("Limit Reached", err.error || "Failed to post story");
      }
    } catch (error) {
      console.error('Upload failed:', error);
      Alert.alert("Error", "Failed to upload story");
    } finally {
      setUploading(false);
      uploadProgress.value = 0;
      setCapturedMedia(null);
    }
  };

  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [currentStoryInGroupIndex, setCurrentStoryInGroupIndex] = useState(0);

  const openStory = (groupIndex: number) => {
    setCurrentGroupIndex(groupIndex);
    setCurrentStoryInGroupIndex(0);
    setIsStoryOpen(true);
    setStoryLiked(false);

    const story = userStories[groupIndex].stories[0];
    markStoryAsViewed(story._id);

    startStoryTimer();
  };

  const markStoryAsViewed = async (storyId: string) => {
    if (!currentUser?._id) return;

    setUserStories(prev => prev.map(group => ({
      ...group,
      stories: group.stories.map((s: any) => {
        if (s._id === storyId) {
          const views = s.views || [];
          const alreadySeen = views.some((v: any) => (v.user?._id || v.user) === currentUser._id);
          if (!alreadySeen) {
            return { ...s, views: [...views, { user: currentUser._id, seenAt: new Date() }] };
          }
        }
        return s;
      })
    })));

    try {
      await fetch(`${API_BASE_URL}/api/stories/${storyId}/view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser._id })
      });
    } catch (e) { }
  };

  const timerRef = useRef<any>(null);

  const startStoryTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    progress.value = 0;
    progress.value = withTiming(1, { duration: 5000, easing: Easing.linear }, (finished) => {
      if (finished) runOnJS(nextStory)();
    });
  };

  const closeStory = () => {
    setIsStoryOpen(false);
    progress.value = 0;
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const nextStory = () => {
    const currentGroup = userStories[currentGroupIndex];
    if (currentStoryInGroupIndex < currentGroup.stories.length - 1) {
      const nextIdx = currentStoryInGroupIndex + 1;
      setCurrentStoryInGroupIndex(nextIdx);
      markStoryAsViewed(currentGroup.stories[nextIdx]._id);
      startStoryTimer();
    } else if (currentGroupIndex < userStories.length - 1) {
      const nextGrpIdx = currentGroupIndex + 1;
      setCurrentGroupIndex(nextGrpIdx);
      setCurrentStoryInGroupIndex(0);
      markStoryAsViewed(userStories[nextGrpIdx].stories[0]._id);
      startStoryTimer();
    } else {
      closeStory();
    }
  };

  const prevStory = () => {
    if (currentStoryInGroupIndex > 0) {
      setCurrentStoryInGroupIndex(prev => prev - 1);
      startStoryTimer();
    } else if (currentGroupIndex > 0) {
      const prevGrpIdx = currentGroupIndex - 1;
      setCurrentGroupIndex(prevGrpIdx);
      setCurrentStoryInGroupIndex(userStories[prevGrpIdx].stories.length - 1);
      startStoryTimer();
    } else {
      startStoryTimer();
    }
  };

  const toggleStoryLike = async (storyId: string) => {
    if (!currentUser?._id) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/stories/${storyId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser._id })
      });
      if (response.ok) {
        const data = await response.json();
        setStoryLiked(data.isLiked);
        likeScale.value = withSequence(withSpring(1.5), withSpring(1));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        setUserStories(prev => prev.map(group => ({
          ...group,
          stories: group.stories.map((s: any) => s._id === storyId ? { ...s, likes: data.likes } : s)
        })));
      }
    } catch (e) { }
  };

  const fetchViewers = async (storyId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/stories/${storyId}/viewers`);
      if (response.ok) {
        const data = await response.json();
        setStoryViewers(data);
        setActiveViewerTab('views');
        setIsViewersSheetVisible(true);
      }
    } catch (e) { }
  };

  const handleDeleteStory = async (storyId: string) => {
    Alert.alert("Delete Story", "Are you sure you want to delete this story?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          try {
            const response = await fetch(`${API_BASE_URL}/api/stories/${storyId}`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: currentUser?._id })
            });
            if (response.ok) {
              setUserStories(prev => prev.map(group => ({
                ...group,
                stories: group.stories.filter((s: any) => s._id !== storyId)
              })).filter(group => group.stories.length > 0));
              closeStory();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          } catch (e) { }
        }
      }
    ]);
  };

  const handleStoryLike = () => {
    setStoryLiked(!storyLiked);
    likeScale.value = withSequence(withSpring(1.5), withSpring(1));
  };

  const likeAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: likeScale.value }] }));
  const progressStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  const openComments = async (postId: string) => {
    setSelectedPostId(postId);
    setIsSheetVisible(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/posts/${postId}`);
      if (response.ok) {
        const freshPost = await response.json();
        setPosts(prev => {
          const newPosts = prev.map(p => p.id === postId ? {
            ...p,
            comments: freshPost.comments.map((c: any) => ({ ...c, id: c._id }))
          } : p);
          AsyncStorage.setItem(CACHE_KEY, JSON.stringify(newPosts)).catch(() => { });
          return newPosts;
        });
      }
    } catch (e) {
      console.warn('Sync comments failed', e);
    }
  };
  const closeComments = () => { setIsSheetVisible(false); setReplyingTo(null); setTimeout(() => setSelectedPostId(null), 300); };

  const groupComments = (flatComments: any[]) => {
    if (!flatComments) return [];
    const commentMap: Record<string, any> = {};
    const roots: any[] = [];

    flatComments.forEach(c => {
      const id = c._id || c.id;
      commentMap[id] = { ...c, id, replies: [] };
    });

    flatComments.forEach(c => {
      const id = c._id || c.id;
      if (c.parentId && commentMap[c.parentId]) {
        commentMap[c.parentId].replies.push(commentMap[id]);
      } else {
        roots.push(commentMap[id]);
      }
    });

    return roots;
  };

  const handleSendComment = async () => {
    if (commentText.trim() === '' || selectedPostId === null || !currentUser) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/posts/${selectedPostId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: currentUser.name,
          avatar: currentUser.avatar,
          text: commentText,
          parentId: replyingTo?.commentId || null
        })
      });

      if (response.ok) {
        const savedComment = await response.json();

        const displayComment = {
          ...savedComment,
          id: savedComment._id,
          time: '1s',
          replies: []
        };

        setPosts(prev => {
          const newPosts = prev.map(post => {
            if (post.id === selectedPostId) {
              const exists = post.comments?.some(c => c.id === displayComment.id);
              if (exists) return post;
              const updatedComments = [...(post.comments || []), displayComment];
              return { ...post, comments: updatedComments };
            }
            return post;
          });
          AsyncStorage.setItem(CACHE_KEY, JSON.stringify(newPosts)).catch(() => { });
          return newPosts;
        });
        setCommentText('');
        setReplyingTo(null);
      }
    } catch (e) {
      console.error('Error sending comment:', e);
    }
  };

  const activePost = posts.find(p => p.id === selectedPostId);
  const activeStoryGroup = userStories[currentGroupIndex];
  const activeStory = activeStoryGroup?.stories[currentStoryInGroupIndex];

  const renderCommentItem = ({ item }: { item: Comment }) => (
    <Animated.View entering={FadeInDown.delay(100)} layout={Layout.springify()} style={styles.commentRow}>
      <View style={styles.commentMain}>
        <TouchableOpacity onPress={() => navigateToProfile(item.user, item.avatar || '', '')}>
          <Image
            source={item.avatar ? { uri: item.avatar } : { uri: 'https://ui-avatars.com/api/?name=' + item.user }}
            style={styles.commentAvatar}
          />
        </TouchableOpacity>
        <View style={styles.commentContent}>
          <View style={styles.commentBubbleContainer}>
            <View style={styles.commentInfoRow}>
              <Text style={[styles.commentUser, { color: textColor }]}>{item.user}</Text>
              <Text style={styles.commentTime}>{item.time}</Text>
            </View>
            <Text style={[styles.commentText, { color: textColor }]}>{item.text}</Text>
          </View>
          <View style={styles.commentActions}>
            <TouchableOpacity onPress={() => { setReplyingTo({ commentId: item.id, username: item.user }); inputRef.current?.focus(); }}>
              <Text style={styles.commentActionText}>Reply</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ marginLeft: 20 }}>
              <Ionicons name="heart-outline" size={14} color="#999" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {item.replies && item.replies.length > 0 && (
        <View style={styles.repliesWrapper}>
          <View style={styles.replyThreadLine} />
          <View style={styles.repliesList}>
            {item.replies.map((reply, ridx) => (
              <View key={reply.id || ridx} style={styles.replyItem}>
                <Image
                  source={reply.avatar ? { uri: reply.avatar } : { uri: 'https://ui-avatars.com/api/?name=' + reply.user }}
                  style={styles.replyAvatar}
                />
                <View style={styles.replyContent}>
                  <View style={styles.replyBubble}>
                    <Text style={[styles.replyUser, { color: textColor }]}>{reply.user}</Text>
                    <Text style={[styles.replyText, { color: textColor }]}>{reply.text}</Text>
                  </View>
                  <TouchableOpacity style={styles.replyAction}>
                    <Text style={styles.commentActionText}>Reply</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}
    </Animated.View>
  );

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <StatusBar style="auto" />
      {/* <AnimatedBackground /> */}

      <View style={{ flex: 1 }}>
        <Animated.ScrollView
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 10 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={textColor}
              colors={['#3B82F6']}
              titleColor={textColor}
              progressViewOffset={insets.top + 20}
            />
          }
        >
          <Animated.View style={headerStoriesAnimatedStyle}>
            <AnimatedBlurView animatedProps={headerBlurProps} style={{ flex: 1 }}>
              {/* Header */}
              <View style={styles.header}>
                <View>
                  <Text style={[styles.greetingText, { color: secondaryTextColor }]}>Good Morning,</Text>
                  <Text style={[styles.userNameText, { color: textColor }]}>{currentUser?.name || 'Explorer'}</Text>
                </View>
                <View style={styles.headerRightActions}>
                  <TouchableOpacity style={[styles.headerIconBtn, { backgroundColor: cardBackground }]} onPress={() => router.push('/create_post')}>
                    <Ionicons name="add-outline" size={26} color={textColor} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.headerIconBtn, { backgroundColor: cardBackground }]}
                    onPress={() => router.push('/notifications_page')}
                  >
                    <Ionicons name="notifications-outline" size={24} color={textColor} />
                    {friendRequests.length > 0 && (
                      <View style={styles.notificationBadge}>
                        <Text style={styles.badgeText}>{friendRequests.length}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Uploading Status Card */}
              <Animated.View style={[styles.modernUploadContainer, uploadContainerStyle]}>
                <BlurView intensity={80} tint="light" style={styles.modernUploadBlur}>
                  <View style={styles.modernUploadContent}>
                    <ActivityIndicator size="small" color="#007AFF" style={{ marginRight: 10 }} />
                    <Text style={styles.modernUploadText}>Uploading Post...</Text>
                  </View>
                  <View style={styles.modernUploadTrack}>
                    <Animated.View style={[styles.modernUploadFill, uploadProgressStyle]} />
                  </View>
                </BlurView>
              </Animated.View>

              {/* Stories Horizontal List */}
              <View style={styles.storiesSection}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20, paddingRight: 10 }}>
                  {/* Add/View Story Button for "You" */}
                  {(() => {
                    const myStoryGroupIndex = userStories.findIndex(group => group.user?._id === currentUser?._id);
                    const hasStories = myStoryGroupIndex !== -1;

                    return (
                      <TouchableOpacity
                        style={styles.storyItem}
                        onPress={() => hasStories ? openStory(myStoryGroupIndex) : handleStoryPick()}
                      >
                        <View style={[styles.storyRing, !hasStories && styles.noRing]}>
                          <Image source={{ uri: currentUser?.avatar || 'https://ui-avatars.com/api/?name=' + currentUser?.name }} style={styles.storyImage} />
                          {!hasStories && (
                            <View style={styles.addStoryBtn}>
                              <Ionicons name="add" size={14} color="#fff" />
                            </View>
                          )}
                        </View>
                        <Text style={styles.storyName}>You</Text>
                      </TouchableOpacity>
                    );
                  })()}

                  {/* Dynamic User Stories */}
                  {userStories.map((group, index) => {
                    if (group.user._id === currentUser?._id) return null;
                    
                    const allSeen = group.stories.every((story: any) => 
                      story.views?.some((v: any) => (v.user?._id || v.user) === currentUser?._id)
                    );

                    return (
                      <TouchableOpacity key={group.user._id} style={styles.storyItem} onPress={() => openStory(index)}>
                        <View style={[styles.storyRing, allSeen && { borderColor: 'transparent' }]}>
                          <Image source={{ uri: group.user.avatar || 'https://ui-avatars.com/api/?name=' + group.user.name }} style={styles.storyImage} />
                        </View>
                        <Text style={styles.storyName}>{group.user.name.split(' ')[0]}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </AnimatedBlurView>
          </Animated.View>

          {/* Feed */}
          <Animated.View style={[styles.feedSection, feedAnimatedStyle, { backgroundColor: cardBackground }]}>
            {posts.map((post, index) => (
              <Animated.View entering={FadeIn.delay(index * 100)} key={post.id} style={styles.postCard}>

                {/* --- UPDATED POST HEADER (Clickable) --- */}
                <View style={styles.postHeader}>
                  <TouchableOpacity onPress={() => navigateToProfile(post.user, post.userImg, post.userId)}>
                    <Image source={{ uri: post.userImg }} style={styles.postUserImg} />
                  </TouchableOpacity>

                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <TouchableOpacity onPress={() => navigateToProfile(post.user, post.userImg, post.userId)}>
                      <Text style={[styles.postUserName, { color: textColor }]}>{post.user}</Text>
                    </TouchableOpacity>
                    <Text style={[styles.postTime, { color: secondaryTextColor }]}>{post.time}</Text>
                  </View>

                  <TouchableOpacity onPress={() => showPostOptions(post)}>
                    <Ionicons name="ellipsis-horizontal" size={20} color={secondaryTextColor} />
                  </TouchableOpacity>
                </View>
                {/* ------------------------------------- */}

                {/* Advanced Post Content */}
                <View style={{ paddingHorizontal: 5, marginBottom: post.image || post.images ? 12 : 5 }}>
                  {post.header ? (
                    <Text style={[styles.postHeaderTitle, { color: textColor }]}>
                      {post.header}
                    </Text>
                  ) : null}
                  
                  {post.subHeader ? (
                    <Text style={[styles.postSubHeader, { color: secondaryTextColor }]}>
                      {post.subHeader}
                    </Text>
                  ) : null}

                  {post.body ? (
                    <Text style={[styles.postBody, { color: textColor }]}>
                      {post.body}
                    </Text>
                  ) : post.title ? (
                    <Text style={[styles.postTitle, { color: textColor, paddingHorizontal: 0, marginTop: 0, marginBottom: 0 }]}>
                      {post.title}
                    </Text>
                  ) : null}
                </View>

                {post.images && post.images.length > 1 ? (
                  <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                    {post.images.map((img: string, idx: number) => (
                      <View key={idx} style={{ width: width - 30 }}>
                        <Image source={{ uri: img }} style={styles.postImage} />
                      </View>
                    ))}
                  </ScrollView>
                ) : post.image || (post.images && post.images[0]) ? (
                  <Image source={{ uri: post.image || post.images[0] }} style={styles.postImage} />
                ) : null}

                <View style={styles.postFooter}>
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.actionItem}
                      onPress={async () => {
                        if (!currentUser) return;

                        const originalIsLiked = post.isLiked;
                        const originalLikesCount = post.likesCount;

                        setPosts(prev => {
                          const newPosts = prev.map(p => p.id === post.id ? {
                            ...p,
                            isLiked: !p.isLiked,
                            likesCount: p.isLiked ? p.likesCount - 1 : p.likesCount + 1
                          } : p);
                          AsyncStorage.setItem(CACHE_KEY, JSON.stringify(newPosts)).catch(() => { });
                          return newPosts;
                        });

                        const attemptLike = async (retryCount = 0): Promise<void> => {
                          try {
                            const controller = new AbortController();
                            const timeoutId = setTimeout(() => controller.abort(), 8000);

                            const response = await fetch(`${API_BASE_URL}/api/posts/${post.id}/like`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ userId: currentUser._id }),
                              signal: controller.signal
                            });

                            clearTimeout(timeoutId);

                            if (!response.ok) {
                              const errBody = await response.text().catch(() => 'No body');
                              console.warn(`Like failed: HTTP ${response.status} - ${errBody}`);
                              
                              if (response.status === 404) {
                                setPosts(prev => {
                                  const newPosts = prev.filter(p => p.id !== post.id);
                                  AsyncStorage.setItem(CACHE_KEY, JSON.stringify(newPosts)).catch(() => { });
                                  return newPosts;
                                });
                                return; // Don't retry — post is gone
                              }
                              
                              throw new Error(`HTTP ${response.status}`);
                            }

                            const serverData = await response.json();
                            setPosts(prev => {
                              const newPosts = prev.map(p => p.id === post.id ? {
                                ...p,
                                isLiked: serverData.isLiked,
                                likesCount: serverData.likesCount
                              } : p);
                              AsyncStorage.setItem(CACHE_KEY, JSON.stringify(newPosts)).catch(() => { });
                              return newPosts;
                            });
                          } catch (e: any) {
                            if (retryCount < 1) {
                              console.log('Retrying like toggle...');
                              await new Promise(r => setTimeout(r, 1000));
                              return attemptLike(retryCount + 1);
                            }
                            setPosts(prev => {
                              const newPosts = prev.map(p => p.id === post.id ? {
                                ...p,
                                isLiked: originalIsLiked,
                                likesCount: originalLikesCount
                              } : p);
                              AsyncStorage.setItem(CACHE_KEY, JSON.stringify(newPosts)).catch(() => { });
                              return newPosts;
                            });
                            console.warn('Like toggle failed after retry:', e?.message);
                          }
                        };
                        await attemptLike();
                      }}
                    >
                      <Ionicons name={post.isLiked ? "heart" : "heart-outline"} size={26} color={post.isLiked ? "#ff4757" : secondaryTextColor} />
                      <Text style={[styles.actionText, { color: secondaryTextColor }]}>{post.likesCount}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionItem} onPress={() => openComments(post.id)}>
                      <Ionicons name="chatbubble-outline" size={24} color={secondaryTextColor} />
                      <Text style={[styles.actionText, { color: secondaryTextColor }]}>{post.comments?.length || 0}</Text>
                    </TouchableOpacity>
                    <View style={{ flex: 1 }} />
                    <TouchableOpacity><Ionicons name={post.isSaved ? "bookmark" : "bookmark-outline"} size={24} color={post.isSaved ? "#3B82F6" : secondaryTextColor} /></TouchableOpacity>
                  </View>
                </View>
              </Animated.View>
            ))}
          </Animated.View>


          <View style={{ height: insets.bottom + 20 }} />
        </Animated.ScrollView>
      </View>

      {/* --- Create Story Modal --- */}
      <Modal visible={isCreateStoryOpen} transparent={false} animationType="slide" onRequestClose={() => setIsCreateStoryOpen(false)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <StatusBar style="light" />

          {!capturedMedia ? (
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing={cameraType}
              enableTorch={flashMode === 'on'}
            >
              <View style={{ flex: 1, justifyContent: 'space-between', paddingTop: insets.top, paddingBottom: insets.bottom }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 20 }}>
                  <TouchableOpacity onPress={() => setIsCreateStoryOpen(false)}>
                    <Ionicons name="close" size={30} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setFlashMode(flashMode === 'on' ? 'off' : 'on')}>
                    <Ionicons name={flashMode === 'on' ? "flash" : "flash-off"} size={26} color="#fff" />
                  </TouchableOpacity>
                </View>

                <View style={{ paddingBottom: 40, alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'space-around' }}>
                    <TouchableOpacity onPress={pickStoryFromGallery} style={styles.headerIconBtn}>
                      <Ionicons name="images-outline" size={24} color="#000" />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={takePicture} style={{ width: 80, height: 80, borderRadius: 40, borderWidth: 5, borderColor: '#fff', justifyContent: 'center', alignItems: 'center' }}>
                      <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' }} />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => setCameraType(cameraType === 'back' ? 'front' : 'back')} style={styles.headerIconBtn}>
                      <Ionicons name="camera-reverse-outline" size={26} color="#000" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </CameraView>
          ) : (
            <View style={{ flex: 1 }}>
              {capturedMedia.type === 'video' ? (
                <Video
                  source={{ uri: capturedMedia.uri }}
                  style={StyleSheet.absoluteFill}
                  resizeMode={Video.RESIZE_MODE_COVER}
                  shouldPlay
                  isLooping
                />
              ) : (
                <ImageBackground source={{ uri: capturedMedia.uri }} style={StyleSheet.absoluteFill} resizeMode="cover">
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: FILTERS.find(f => f.id === activeFilter)?.color }]} />
                </ImageBackground>
              )}

              <View style={{ flex: 1, justifyContent: 'space-between', paddingTop: insets.top, paddingBottom: insets.bottom }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 20 }}>
                  <TouchableOpacity onPress={() => setCapturedMedia(null)}>
                    <Ionicons name="chevron-back" size={30} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={uploadCreatedStory} style={{ backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 }}>
                    <Text style={{ color: '#000', fontWeight: 'bold' }}>Post Story</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ paddingBottom: 20 }}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
                    {FILTERS.map((filter) => (
                      <TouchableOpacity
                        key={filter.id}
                        onPress={() => setActiveFilter(filter.id)}
                        style={{ alignItems: 'center', marginRight: 15 }}
                      >
                        <View style={{ width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: activeFilter === filter.id ? '#fff' : 'transparent', overflow: 'hidden' }}>
                          <ImageBackground source={{ uri: capturedMedia.uri }} style={{ flex: 1 }}>
                            <View style={[StyleSheet.absoluteFill, { backgroundColor: filter.color }]} />
                          </ImageBackground>
                        </View>
                        <Text style={{ color: '#fff', fontSize: 10, marginTop: 5 }}>{filter.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
            </View>
          )}
        </View>
      </Modal>
      <Modal visible={isStoryOpen} transparent animationType="fade" onRequestClose={closeStory}>
        <View style={styles.storyContainer}>
          <StatusBar style="light" />

          {activeStory && (
            <View style={styles.storyBackground}>
              {activeStory.type === 'video' ? (
                <Video
                  source={{ uri: activeStory.content }}
                  rate={1.0}
                  volume={1.0}
                  isMuted={false}
                  resizeMode={Video.RESIZE_MODE_COVER}
                  shouldPlay={isStoryOpen}
                  isLooping={false}
                  style={StyleSheet.absoluteFill}
                />
              ) : (
                <Image source={{ uri: activeStory.content }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              )}

              <LinearGradient
                colors={['rgba(0,0,0,0.85)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0)']}
                style={[styles.topStoryBlur, { height: insets.top + 120 }]}
              />
              <LinearGradient
                colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.85)']}
                style={[styles.bottomStoryBlur, { height: insets.bottom + 100 }]}
              />

              {/* Progress Bars */}
              <View style={[styles.progressBarContainer, { paddingTop: insets.top + 10 }]}>
                {activeStoryGroup?.stories.map((_, i) => (
                  <View key={i} style={styles.progressBarBackground}>
                    <Animated.View
                      style={[
                        styles.progressBarFill,
                        i === currentStoryInGroupIndex ? progressStyle : (i < currentStoryInGroupIndex ? { width: '100%' } : { width: 0 })
                      ]}
                    />
                  </View>
                ))}
              </View>

              {/* Story Header */}
              <View style={styles.storyHeader}>
                <Image source={{ uri: activeStoryGroup.user.avatar || 'https://ui-avatars.com/api/?name=' + activeStoryGroup.user.name }} style={styles.storyHeaderAvatar} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.storyHeaderName}>{activeStoryGroup.user.name}</Text>
                  <Text style={styles.storyHeaderTime}>{new Date(activeStory.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                </View>

                {/* Delete button for owner */}
                {activeStoryGroup.user._id === currentUser?._id && (
                  <TouchableOpacity onPress={() => handleDeleteStory(activeStory._id)} style={{ marginRight: 15 }}>
                    <Ionicons name="trash-outline" size={24} color="#fff" />
                  </TouchableOpacity>
                )}

                <TouchableOpacity onPress={closeStory}>
                  <Ionicons name="close" size={30} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* Touch areas for navigation */}
              <View style={styles.storyTouchArea}>
                <TouchableOpacity style={styles.touchLeft} onPress={prevStory} />
                <TouchableOpacity style={styles.touchRight} onPress={nextStory} />
              </View>

              {/* Footer */}
              <View style={styles.storyFooter}>
                <View style={styles.storyInputContainer}>
                  <TextInput
                    placeholder="Send message..."
                    placeholderTextColor="rgba(255,255,255,0.8)"
                    style={styles.storyInput}
                    value={storyReplyText}
                    onChangeText={setStoryReplyText}
                  />
                </View>

                {/* View count for owner */}
                {activeStoryGroup.user._id === currentUser?._id ? (
                  <TouchableOpacity style={styles.actionItem} onPress={() => fetchViewers(activeStory._id)}>
                    <Ionicons name="eye-outline" size={28} color="#fff" />
                    <Text style={{ color: '#fff', marginLeft: 5, fontWeight: 'bold' }}>{activeStory.views?.length || 0}</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={() => toggleStoryLike(activeStory._id)}>
                    <Animated.View style={likeAnimatedStyle}>
                      <Ionicons
                        name={activeStory.likes?.includes(currentUser?._id) ? "heart" : "heart-outline"}
                        size={32}
                        color={activeStory.likes?.includes(currentUser?._id) ? "#FF3B30" : "#fff"}
                      />
                    </Animated.View>
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={{ marginLeft: 15 }}>
                  <Ionicons name="paper-plane-outline" size={28} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>

      {/* --- Viewers Bottom Sheet --- */}
      <Modal visible={isViewersSheetVisible} transparent animationType="slide" onRequestClose={() => setIsViewersSheetVisible(false)}>
        <View style={styles.modalContainer}>
          <TouchableWithoutFeedback onPress={() => setIsViewersSheetVisible(false)}>
            <View style={styles.backdrop} />
          </TouchableWithoutFeedback>
          <View style={[styles.sheet, { height: '60%' }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View style={styles.sheetTitleContainer}>
                <TouchableOpacity
                  onPress={() => setActiveViewerTab('views')}
                  style={{ borderBottomWidth: activeViewerTab === 'views' ? 2 : 0, borderBottomColor: '#007AFF', paddingBottom: 5 }}
                >
                  <Text style={[styles.sheetTitle, { color: activeViewerTab === 'views' ? '#007AFF' : '#999' }]}>Views ({storyViewers.viewCount})</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setActiveViewerTab('likes')}
                  style={{ borderBottomWidth: activeViewerTab === 'likes' ? 2 : 0, borderBottomColor: '#007AFF', paddingBottom: 5, marginLeft: 20 }}
                >
                  <Text style={[styles.sheetTitle, { color: activeViewerTab === 'likes' ? '#007AFF' : '#999' }]}>Likes ({storyViewers.likers.length})</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => setIsViewersSheetVisible(false)} style={styles.closeButton}>
                <Ionicons name="close-circle" size={24} color="#CCC" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={activeViewerTab === 'views' ? storyViewers.viewers : storyViewers.likers.map(u => ({ user: u, seenAt: null }))}
              keyExtractor={(item, index) => index.toString()}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <View style={[styles.commentRow, { marginBottom: 15 }]}>
                  <View style={styles.commentMain}>
                    <Image source={{ uri: item.user.avatar || 'https://ui-avatars.com/api/?name=' + item.user.name }} style={styles.commentAvatar} />
                    <View style={styles.commentContent}>
                      <Text style={styles.commentUser}>{item.user.name}</Text>
                      {item.seenAt && <Text style={styles.commentTime}>{new Date(item.seenAt).toLocaleTimeString()}</Text>}
                    </View>
                  </View>
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.emptyComments}>
                  <Ionicons name={activeViewerTab === 'views' ? "eye-off-outline" : "heart-dislike-outline"} size={50} color="#DDD" />
                  <Text style={styles.emptyCommentsText}>{activeViewerTab === 'views' ? "No views yet" : "No likes yet"}</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      {/* Comment Sheet */}
      <Modal visible={isSheetVisible} transparent animationType="none" onRequestClose={closeComments}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContainer}>
          <TouchableWithoutFeedback onPress={closeComments}><Animated.View entering={FadeIn} exiting={FadeOut} style={styles.backdrop} /></TouchableWithoutFeedback>
          <Animated.View entering={SlideInDown.springify().damping(40).stiffness(300).mass(0.8)} exiting={SlideOutDown} style={[styles.sheet, { paddingBottom: insets.bottom, backgroundColor: cardBackground }]}>
            <BlurView intensity={40} tint={useThemeColor({ light: 'light', dark: 'dark' } as any, 'background')} style={StyleSheet.absoluteFill} />
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetTitleContainer}>
                <Text style={[styles.sheetTitle, { color: textColor }]}>Comments</Text>
                <Text style={[styles.commentCount, { color: secondaryTextColor, backgroundColor: inputBackground }]}>{activePost?.comments?.length || 0}</Text>
              </View>
              <TouchableOpacity onPress={closeComments} style={styles.closeButton}><Ionicons name="close" size={24} color={textColor} /></TouchableOpacity>
            </View>

            <FlatList
              data={groupComments(activePost?.comments || [])}
              keyExtractor={(item, index) => (item.id || item._id || index).toString()}
              renderItem={renderCommentItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyComments}>
                  <Ionicons name="chatbubbles-outline" size={50} color="#DDD" />
                  <Text style={styles.emptyCommentsText}>Start the conversation...</Text>
                </View>
              }
            />

            <View style={[styles.inputSection, { backgroundColor: cardBackground, borderTopColor: borderBottomColor, paddingBottom: Platform.OS === 'ios' ? insets.bottom + 10 : 20 }]}>
              {replyingTo && (
                <View style={[styles.replyBar, { backgroundColor: inputBackground }]}>
                  <Text style={[styles.replyingToText, { color: secondaryTextColor }]}>Replying to <Text style={{ fontWeight: 'bold' }}>{replyingTo.username}</Text></Text>
                  <TouchableOpacity onPress={() => setReplyingTo(null)}>
                    <Ionicons name="close-circle" size={18} color={secondaryTextColor} />
                  </TouchableOpacity>
                </View>
              )}
              <View style={styles.floatingInputRow}>
                <Image source={{ uri: currentUser?.avatar || 'https://ui-avatars.com/api/?name=' + currentUser?.name }} style={styles.inputAvatar} />
                <View style={[styles.inputFieldContainer, { backgroundColor: inputBackground }]}>
                  <TextInput
                    ref={inputRef}
                    style={[styles.inputField, { color: textColor }]}
                    placeholder={replyingTo ? "Write a reply..." : "Add a comment..."}
                    placeholderTextColor={placeholderColor}
                    value={commentText}
                    onChangeText={setCommentText}
                    multiline
                    maxLength={500}
                  />
                  <View style={styles.inputControls}>
                    <TouchableOpacity><Ionicons name="happy-outline" size={22} color={secondaryTextColor} /></TouchableOpacity>
                    <TouchableOpacity style={{ marginLeft: 12 }}><Ionicons name="camera-outline" size={22} color={secondaryTextColor} /></TouchableOpacity>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.sendBtn, { backgroundColor: commentText.trim() ? '#3B82F6' : inputBackground }]}
                  onPress={handleSendComment}
                  disabled={!commentText.trim()}
                >
                  <Ionicons name="arrow-up" size={20} color={commentText.trim() ? "#fff" : secondaryTextColor} />
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  scrollContent: { paddingTop: 0 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, marginBottom: 13.5, marginTop: 1 },
  greetingText: { fontSize: 14, fontWeight: '500' },
  userNameText: { fontSize: 22, fontWeight: '800' },
  headerRightActions: { flexDirection: 'row', gap: 15 },
  headerIconBtn: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#fff'
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  storiesSection: { marginBottom: -15, marginTop: 7 },
  storyItem: { alignItems: 'center', marginRight: 20 },
  storyRing: { width: 70, height: 70, borderRadius: 35, borderWidth: 2, borderColor: '#3B82F6', padding: 3, justifyContent: 'center', alignItems: 'center', marginBottom: 5 },
  noRing: { borderWidth: 0, padding: 0 },
  storyImage: { width: '100%', height: '100%', borderRadius: 40 },
  addStoryBtn: { position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, borderRadius: 10, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  storyName: { fontSize: 12, color: '#444', fontWeight: '500' },
  feedSection: {
    borderTopLeftRadius: 38,
    borderTopRightRadius: 38,
    paddingHorizontal: 15,
    paddingTop: 25,
    marginTop: 35,
    minHeight: height,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 5
  },
  sectionTitle: { fontSize: 20, fontWeight: '800', marginBottom: 15 },
  postCard: { backgroundColor: 'transparent', marginBottom: 35 },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingHorizontal: 5 },
  postUserImg: { width: 40, height: 40, borderRadius: 20 },
  postUserName: { fontSize: 15, fontWeight: '700' },
  postTime: { fontSize: 11 },
  postImage: { width: '100%', height: 400, borderRadius: 25, marginBottom: 12 },
  postFooter: { paddingHorizontal: 5 },
  postHeaderTitle: { fontSize: 20, fontWeight: '800', lineHeight: 28, marginBottom: 4 },
  postSubHeader: { fontSize: 14, fontWeight: '600', lineHeight: 20, marginBottom: 10, fontStyle: 'italic' },
  postBody: { fontSize: 15, fontWeight: '400', lineHeight: 22, marginBottom: 5 },
  postTitle: { fontSize: 15, fontWeight: '400', lineHeight: 22, marginTop: 4, paddingHorizontal: 5, marginBottom: 15 },
  actionRow: { flexDirection: 'row', alignItems: 'center' },
  actionItem: { flexDirection: 'row', alignItems: 'center', marginRight: 20 },
  actionText: { marginLeft: 6, fontSize: 14, color: '#555', fontWeight: '600' },
  modernUploadContainer: { marginHorizontal: 15, marginTop: 10, marginBottom: 5, borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5, backgroundColor: 'rgba(255,255,255,0.8)' },
  modernUploadBlur: { width: '100%' },
  modernUploadContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  modernUploadText: { fontSize: 14, fontWeight: '600', color: '#333' },
  modernUploadTrack: { height: 3, backgroundColor: 'transparent', width: '100%' },
  modernUploadFill: { height: '100%', backgroundColor: '#007AFF' },
  storyContainer: { flex: 1, backgroundColor: '#000' },
  storyBackground: { flex: 1, width: '100%', height: '100%' },
  progressBarContainer: { paddingHorizontal: 10, paddingTop: 10, flexDirection: 'row', gap: 5 },
  progressBarBackground: { flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#fff' },
  storyHeader: { flexDirection: 'row', alignItems: 'center', padding: 15, marginTop: 10 },
  storyHeaderAvatar: { width: 32, height: 32, borderRadius: 16, marginRight: 10 },
  storyHeaderName: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  storyHeaderTime: { color: 'rgba(255,255,255,0.6)', marginLeft: 10, fontSize: 14 },
  storyTouchArea: { flexDirection: 'row', flex: 1 },
  touchLeft: { flex: 1 },
  touchRight: { flex: 1 },
  storyFooter: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingBottom: Platform.OS === 'ios' ? 10 : 20, marginBottom: 10 },
  storyInputContainer: { flex: 1, height: 46, borderRadius: 23, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', justifyContent: 'center', paddingHorizontal: 20, marginRight: 15 },
  storyInput: { fontSize: 16, color: '#fff', height: '100%' },
  topStoryBlur: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  bottomStoryBlur: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  modalContainer: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    height: '75%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 25,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)'
  },
  sheetHandle: { width: 40, height: 5, backgroundColor: '#E5E5EA', borderRadius: 3, position: 'absolute', top: 10, left: (width - 40) / 2 },
  sheetTitleContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sheetTitle: { fontSize: 18, fontWeight: '800' },
  commentCount: { fontSize: 14, fontWeight: '600', paddingHorizontal: 10, paddingVertical: 2, borderRadius: 10 },
  closeButton: { padding: 4 },
  listContent: { padding: 25, paddingBottom: 120 },

  commentRow: { marginBottom: 25 },
  commentMain: { flexDirection: 'row', alignItems: 'flex-start' },
  commentAvatar: { width: 42, height: 42, borderRadius: 21, marginRight: 12, borderWidth: 1, borderColor: '#F0F0F0' },
  commentContent: { flex: 1 },
  commentBubbleContainer: { backgroundColor: '#fff', borderRadius: 0, paddingBottom: 2 },
  commentInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  commentUser: { fontWeight: '700', fontSize: 14, color: '#111' },
  commentTime: { fontWeight: '400', fontSize: 12, color: '#BBB' },
  commentText: { fontSize: 15, color: '#333', lineHeight: 22 },
  commentActions: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  commentActionText: { fontSize: 13, fontWeight: '700', color: '#888' },

  repliesWrapper: { flexDirection: 'row', marginLeft: 20, marginTop: 15 },
  replyThreadLine: { width: 2, backgroundColor: '#F2F2F7', borderRadius: 1, marginLeft: 21, marginRight: 15 },
  repliesList: { flex: 1 },
  replyItem: { flexDirection: 'row', marginBottom: 18, alignItems: 'flex-start' },
  replyAvatar: { width: 30, height: 30, borderRadius: 15, marginRight: 10 },
  replyContent: { flex: 1 },
  replyBubble: { marginBottom: 4 },
  replyUser: { fontWeight: '700', fontSize: 13, color: '#111', marginBottom: 2 },
  replyText: { fontSize: 14, color: '#444', lineHeight: 20 },
  replyAction: { marginTop: 4 },

  inputSection: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 20,
    paddingTop: 15,
    backgroundColor: '#fff'
  },
  replyBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 12,
    backgroundColor: '#F8F9FA',
    paddingVertical: 8,
    borderRadius: 12
  },
  replyingToText: { color: '#666', fontSize: 12.5 },
  floatingInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  inputAvatar: { width: 38, height: 38, borderRadius: 19, marginBottom: 2 },
  inputFieldContainer: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderRadius: 24,
    paddingHorizontal: 15,
    paddingVertical: 10,
    minHeight: 46,
    maxHeight: 120,
    flexDirection: 'row',
    alignItems: 'flex-end'
  },
  inputField: {
    flex: 1,
    fontSize: 15,
    color: '#000',
    paddingTop: Platform.OS === 'ios' ? 0 : 0,
    textAlignVertical: 'center'
  },
  inputControls: { flexDirection: 'row', marginLeft: 10, marginBottom: 2 },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2
  },

  emptyComments: { alignItems: 'center', marginTop: 60 },
  emptyCommentsText: { fontSize: 15, color: '#BBB', marginTop: 15, fontWeight: '500' }
});