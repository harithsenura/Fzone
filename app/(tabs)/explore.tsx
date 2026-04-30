import React, { useState } from 'react';
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
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { AnimatedBackground } from '@/components/AnimatedBackground'; 
import { useAuth } from '@/context/AuthContext';
import { API_BASE_URL } from '@/config/api';
import { io } from 'socket.io-client';
import { useThemeColor } from '@/hooks/use-theme-color';

const { width } = Dimensions.get('window');

export default function MessagesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const { user, profileData } = useAuth();
  const [chats, setChats] = useState<any[]>([]);

  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const secondaryTextColor = useThemeColor({ light: '#8E8E93', dark: '#94A3B8' }, 'text');
  const cardBackground = useThemeColor({ light: 'rgba(255, 255, 255, 0.75)', dark: 'rgba(30, 30, 30, 0.75)' }, 'card');
  const inputBackground = useThemeColor({ light: 'rgba(255, 255, 255, 0.6)', dark: 'rgba(40, 40, 40, 0.6)' }, 'background');
  const borderBottomColor = useThemeColor({ light: 'rgba(255, 255, 255, 0.5)', dark: 'rgba(255, 255, 255, 0.1)' }, 'border');

  React.useEffect(() => {
    if (profileData?.friends) {
      setChats(prevChats => {
        const existingMap = new Map(prevChats.map(c => [c.id, c]));
        
        profileData.friends.forEach((friend: any) => {
          if (!existingMap.has(friend._id)) {
            existingMap.set(friend._id, {
              id: friend._id,
              name: friend.name,
              avatar: friend.avatar || 'https://via.placeholder.com/150',
              message: 'Tap to start chatting',
              time: '',
              unread: 0,
              online: true,
              timestamp: 0 // to ensure it sorts correctly if needed
            });
          }
        });
        
        return Array.from(existingMap.values());
      });
    }
    
    if (user?._id && user._id !== 'undefined') {
      fetchHistory();
    }

    if (user?._id) {
      const socket = io(API_BASE_URL, {
        transports: ['websocket'],
      });

      socket.on('chatListUpdate', (updatedChats: any[]) => {
        setChats(prevChats => {
          const mergedMap = new Map();
          
          prevChats.forEach(c => mergedMap.set(c.id, c));
          
          updatedChats.forEach(c => mergedMap.set(c.id, c));
          
          const result = Array.from(mergedMap.values());
          result.sort((a, b) => {
            const timeA = new Date(a.timestamp || 0).getTime();
            const timeB = new Date(b.timestamp || 0).getTime();
            return timeB - timeA;
          });
          return result;
        });
      });

      socket.on('connect', () => {
        socket.emit('joinUser', user._id);
        socket.emit('requestChatList', user._id); // Initial fetch via socket
      });

      socket.on('newNotification', (data: any) => {
        if (data.type === 'NEW_MESSAGE') {
          socket.emit('requestChatList', user._id);
        }
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [user?._id, profileData?.friends]);

  const fetchHistory = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/chats/${user?._id}`);
      if (response.ok) {
        const historyChats = await response.json();
        
        setChats(prevChats => {
          const mergedMap = new Map();
          
          historyChats.forEach((c: any) => {
            mergedMap.set(c.id, c);
          });
          
          prevChats.forEach((c: any) => {
            if (!mergedMap.has(c.id)) {
              mergedMap.set(c.id, c);
            }
          });
          
          const result = Array.from(mergedMap.values());
          result.sort((a, b) => {
            const timeA = new Date(a.timestamp || 0).getTime();
            const timeB = new Date(b.timestamp || 0).getTime();
            return timeB - timeA;
          });
          
          return result;
        });
      }
    } catch (err) {
      console.log('Error fetching history:', err);
    }
  };

  const handleDeleteChat = (friendId: string, friendName: string) => {
    const chatId = [user?._id, friendId].sort().join('_');
    
    Alert.alert(
      "Delete Chat",
      `Are you sure you want to delete all messages with ${friendName}?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            try {
              const response = await fetch(`${API_BASE_URL}/api/messages/chat/${chatId}`, {
                method: 'DELETE',
              });
              if (response.ok) {
                fetchHistory();
              }
            } catch (err) {
              console.log('Error deleting chat:', err);
            }
          }
        }
      ]
    );
  };

  const filteredChats = chats.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  const renderItem = ({ item, index }: { item: any, index: number }) => (
    <Animated.View 
      entering={FadeInDown.delay(index * 100).springify()} // Smooth Entry Animation
      layout={Layout.springify()}
    >
      <TouchableOpacity 
        style={[styles.chatCard, { backgroundColor: cardBackground }]}
        activeOpacity={0.7}
        onPress={() => {
          router.push({
            pathname: "/chat/[id]",
            params: { 
              id: item.id, 
              name: item.name, 
              avatar: item.avatar 
            }
          });
        }}
        onLongPress={() => handleDeleteChat(item.id, item.name)}
      >
        {/* User Avatar with Online Status */}
        <View style={styles.avatarContainer}>
          <Image source={{ uri: item.avatar }} style={styles.avatar} />
          {item.online && <View style={[styles.onlineDot, { borderColor: backgroundColor }]} />}
        </View>

        {/* Message Content */}
        <View style={styles.messageContent}>
          <View style={styles.topRow}>
            <Text style={[styles.userName, { color: textColor }]}>{item.name}</Text>
            <Text style={[styles.timeText, { color: secondaryTextColor }]}>{item.time}</Text>
          </View>
          <Text numberOfLines={1} style={[styles.lastMessage, { color: secondaryTextColor }, item.unread > 0 && [styles.unreadMessage, { color: textColor }]]}>
            {item.message}
          </Text>
        </View>

        {/* Unread Badge (if any) */}
        {item.unread > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{item.unread}</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <StatusBar style="auto" />
      {/* <AnimatedBackground /> */}

      <View style={{ flex: 1, paddingTop: insets.top }}>
        <View style={styles.contentContainer}>
          
          {/* 1. Header Section */}
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: textColor }]}>Messages</Text>
            <TouchableOpacity style={[styles.newChatBtn, { backgroundColor: cardBackground }]}>
              <Ionicons name="create-outline" size={24} color="#3B82F6" />
            </TouchableOpacity>
          </View>

          {/* 2. Glass Search Bar */}
          <View style={[styles.searchContainer, { backgroundColor: inputBackground, borderColor: borderBottomColor }]}>
            <Ionicons name="search" size={20} color={secondaryTextColor} style={styles.searchIcon} />
            <TextInput 
              placeholder="Search chats..." 
              style={[styles.searchInput, { color: textColor }]} 
              placeholderTextColor={secondaryTextColor}
              value={search}
              onChangeText={setSearch}
            />
          </View>

          {/* 3. Chat List with Animations */}
          <FlatList
            data={filteredChats}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />

        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  contentContainer: {
    flex: 1,
    paddingTop: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: '#000',
    letterSpacing: -0.5,
  },
  newChatBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.6)', 
    marginHorizontal: 20,
    paddingHorizontal: 15,
    height: 50,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 17,
    color: '#000',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100, 
  },
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.75)', 
    marginBottom: 12,
    padding: 15,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 15,
  },
  avatar: {
    width: 55,
    height: 55,
    borderRadius: 27.5,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#34C759', 
    borderWidth: 2,
    borderColor: '#fff',
  },
  messageContent: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  userName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000',
  },
  timeText: {
    fontSize: 13,
    color: '#8E8E93',
  },
  lastMessage: {
    fontSize: 15,
    color: '#8E8E93',
    lineHeight: 20,
  },
  unreadMessage: {
    color: '#000',
    fontWeight: '600',
  },
  unreadBadge: {
    marginLeft: 10,
    backgroundColor: '#007AFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  unreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});