
import { API_BASE_URL } from '@/config/api';
import { useAuth } from '@/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert
} from 'react-native';
import Animated, {
  FadeInDown,
  Layout,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { io, Socket } from 'socket.io-client';
import { useThemeColor } from '@/hooks/use-theme-color';

interface Message {
  _id?: string;
  id?: string;
  chatId: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp?: Date;
  time?: string;
  sender: 'me' | 'them';
  status?: string;
}

export default function ChatRoomScreen() {
  const { name, avatar, id } = useLocalSearchParams();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [skip, setSkip] = useState(0);

  const flatListRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);

  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const secondaryTextColor = useThemeColor({ light: '#8E8E93', dark: '#94A3B8' }, 'text');
  const cardBackground = useThemeColor({ light: '#fff', dark: '#1E1E1E' }, 'card');
  const bubbleMe = useThemeColor({ light: '#333', dark: '#3B82F6' }, 'text');
  const bubbleThem = useThemeColor({ light: '#F0F0F0', dark: '#2C2C2E' }, 'background');
  const inputBackground = useThemeColor({ light: '#F8F9FA', dark: '#1E1E1E' }, 'background');
  const borderBottomColor = useThemeColor({ light: '#F0F0F0', dark: '#2C2C2E' }, 'border');
  const iconBackground = useThemeColor({ light: 'rgba(255,255,255,0.5)', dark: 'rgba(255,255,255,0.1)' }, 'background');

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const headerAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: 0 }],
      opacity: 1,
    };
  });

  const sheetAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: 0 }],
    };
  });

  const { user, setActiveChatId } = useAuth();

  useEffect(() => {
    if (id) {
      setActiveChatId(id as string);
    }
    return () => setActiveChatId(null);
  }, [id]);

  const chatId = user && id ? [user._id, id as string].sort().join('_') : `chat_${Date.now()}`;
  const currentUserId = user?._id || 'user1';
  const currentUserName = user?.name || 'Me';

  useEffect(() => {
    let newSocket: Socket | null = null;

    try {
      const socketUrl = API_BASE_URL;

      newSocket = io(socketUrl, {
        transports: ['websocket'],
        reconnection: true,
        timeout: 5000,
      });

      newSocket.on('connect', () => {
        if (__DEV__) {
          console.log('✅ Connected to chat server');
        }
        setConnected(true);

        newSocket?.emit('joinChat', chatId);
        newSocket?.emit('requestMessages', { chatId, skip: 0, limit: 20 });
        newSocket?.emit('markMessagesRead', { chatId, readerId: currentUserId });
      });

      newSocket.on('disconnect', () => {
        if (__DEV__) {
          console.log('❌ Disconnected from chat server');
        }
        setConnected(false);
      });

      newSocket.on('newMessage', (message: Message) => {
        try {
          const formattedMessage: Message = {
            ...message,
            id: message._id || message.id || Date.now().toString(),
            sender: message.senderId === currentUserId ? 'me' : 'them',
            time: new Date(message.timestamp || new Date()).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            }),
          };

          setMessages((prev) => {
            if (prev.some(msg => msg.id === formattedMessage.id)) {
              return prev;
            }
            return [formattedMessage, ...prev];
          });


          if (formattedMessage.sender === 'them') {
            newSocket?.emit('markMessagesRead', { chatId, readerId: currentUserId });
          }
        } catch (err) {
          if (__DEV__) {
            console.log('Error formatting message:', err);
          }
        }
      });

      newSocket.on('error', (error: any) => {
        if (__DEV__) {
          console.log('Socket error:', error);
        }
        setConnected(false);
      });

      newSocket.on('connect_error', (error: any) => {
        if (__DEV__) {
          console.log('Socket connection error:', error.message);
        }
        setConnected(false);
      });

      newSocket.on('messagesRead', (data) => {
        if (data.chatId === chatId && data.readerId !== currentUserId) {
          setMessages(prev => prev.map(msg =>
            msg.sender === 'me' && msg.status !== 'read' ? { ...msg, status: 'read' } : msg
          ));
        }
      });

      newSocket.on('chatHistory', (data: { chatId: string, messages: Message[], hasMore: boolean, skip: number }) => {
        if (data.chatId === chatId) {
          const formattedMessages: Message[] = data.messages.map((msg) => ({
            ...msg,
            id: msg._id || msg.id || Date.now().toString(),
            sender: msg.senderId === currentUserId ? 'me' : 'them',
            time: new Date(msg.timestamp || new Date()).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            }),
          }));

          setMessages(prev => {
            if (data.skip === 0) return formattedMessages;
            const existingIds = new Set(prev.map(m => m.id));
            const newOnes = formattedMessages.filter(m => !existingIds.has(m.id));
            return [...prev, ...newOnes];
          });

          setHasMore(data.hasMore);
          setSkip(data.skip + data.messages.length);
          setLoadingMore(false);

          if (data.skip === 0) {
            newSocket?.emit('markMessagesRead', { chatId, readerId: currentUserId });
          }
        }
      });

      newSocket.on('chatCleared', (data: { chatId: string }) => {
        if (data.chatId === chatId) {
          setMessages([]);
        }
      });

      setSocket(newSocket);

      if (newSocket.connected) {
        newSocket.emit('requestMessages', { chatId, skip: 0, limit: 20 });
        newSocket.emit('markMessagesRead', { chatId, readerId: currentUserId });
      }
    } catch (error) {
      if (__DEV__) {
        console.log('Error initializing socket:', error);
      }
      setConnected(false);
    }

    return () => {
      if (newSocket) {
        try {
          newSocket.emit('leaveChat', chatId);
          newSocket.disconnect();
        } catch (err) {
        }
      }
    };
  }, [chatId]);

  const loadMessages = async () => {
    if (socket && connected) {
      setLoadingMore(true);
      socket.emit('requestMessages', { chatId, skip: 0, limit: 20 });
      socket.emit('markMessagesRead', { chatId, readerId: currentUserId });
    }
  };

  const loadMore = () => {
    if (!loadingMore && hasMore && socket && connected) {
      setLoadingMore(true);
      socket.emit('requestMessages', { chatId, skip, limit: 20 });
    }
  };

  const sendMessage = () => {
    if (inputText.trim().length === 0 || !socket || !connected) return;

    const messageData = {
      chatId,
      senderId: currentUserId,
      senderName: currentUserName,
      text: inputText.trim(),
      recipientId: id as string, // For backend notifications
    };

    socket.emit('sendMessage', messageData);

    setInputText('');
  };

  const handleClearChat = () => {
    Alert.alert(
      "Clear Chat",
      "Are you sure you want to clear all messages in this chat?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Clear", 
          style: "destructive",
          onPress: async () => {
            try {
              const response = await fetch(`${API_BASE_URL}/api/messages/chat/${chatId}`, {
                method: 'DELETE',
              });
              if (response.ok) {
                setMessages([]);
              }
            } catch (err) {
              console.log('Error clearing chat:', err);
            }
          }
        }
      ]
    );
  };

  const renderMessage = ({ item, index }: { item: any, index: number }) => {
    const isMe = item.sender === 'me';
    return (
      <Animated.View
        entering={FadeInDown.delay(index * 50).springify()}
        layout={Layout.springify()}
        style={[styles.messageWrapper, isMe ? styles.myMessageWrapper : styles.theirMessageWrapper]}
      >
        {!isMe && (
          <Image source={{ uri: avatar as string }} style={styles.smallAvatar} />
        )}
        <View style={[
          styles.messageBubble,
          isMe ? [styles.myBubble, { backgroundColor: bubbleMe }] : [styles.theirBubble, { backgroundColor: bubbleThem }]
        ]}>
          <Text style={[styles.messageText, isMe ? styles.myText : [styles.theirText, { color: textColor }]]}>
            {item.text}
          </Text>
          <View style={styles.timeAndReceiptContainer}>
            <Text style={[styles.timeText, isMe ? styles.myTime : styles.theirTime]}>
              {item.time}
            </Text>
            {isMe && (
              <Ionicons
                name={item.status === 'read' ? "checkmark-done" : "checkmark"}
                size={14}
                color={item.status === 'read' ? "#34C759" : (isMe ? "rgba(255,255,255,0.7)" : secondaryTextColor)}
                style={styles.receiptIcon}
              />
            )}
          </View>
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <StatusBar style="auto" />
      <View style={[StyleSheet.absoluteFill, { backgroundColor }]} />

      {/* Navigation Header Settings */}
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <View style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
          style={{ flex: 1 }}
        >
          {/* Header Part (Parallax) */}
          <Animated.View style={[styles.customHeader, headerAnimatedStyle, { paddingTop: insets.top + 10 }]}>
            <View style={styles.headerLeftContainer}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <Ionicons name="chevron-back" size={28} color={textColor} />
              </TouchableOpacity>
              <Image source={{ uri: avatar as string }} style={styles.headerAvatar} />
              <View>
                <Text style={[styles.headerName, { color: textColor }]}>{name}</Text>
                <View style={styles.statusRow}>
                  <View style={[styles.statusDot, connected ? styles.onlineDot : styles.offlineDot]} />
                  <Text style={[styles.headerStatus, connected ? { color: '#34C759' } : { color: secondaryTextColor }]}>
                    {connected ? 'Active Now' : 'Connecting...'}
                  </Text>
                </View>
              </View>
            </View>
            <TouchableOpacity style={[styles.moreButton, { backgroundColor: iconBackground }]} onPress={handleClearChat}>
              <Ionicons name="ellipsis-vertical" size={20} color={secondaryTextColor} />
            </TouchableOpacity>
          </Animated.View>

          {/* Overlap Sheet */}
          <Animated.View style={[styles.sheetSection, sheetAnimatedStyle, { backgroundColor: cardBackground }]}>
            <Animated.FlatList
              ref={flatListRef as any}
              data={messages}
              inverted={true} // Newest at bottom
              keyExtractor={item => item.id}
              renderItem={renderMessage}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              onScroll={scrollHandler}
              scrollEventThrottle={16}
              onEndReached={loadMore} // Load older when scroll to top
              onEndReachedThreshold={0.5}
            />
          </Animated.View>

          {/* Floating Input Area */}
          <View style={[styles.inputWrapper, { paddingBottom: insets.bottom + 10, backgroundColor: cardBackground }]}>
            <View style={[styles.inputBackground, { backgroundColor: inputBackground, borderColor: borderBottomColor }]}>
              <TouchableOpacity style={styles.attachButton}>
                <Ionicons name="add-circle" size={32} color="#3B82F6" />
              </TouchableOpacity>

              <TextInput
                style={[styles.input, { color: textColor }]}
                placeholder="Message..."
                placeholderTextColor={secondaryTextColor}
                value={inputText}
                onChangeText={setInputText}
                multiline
              />

              <TouchableOpacity
                style={[styles.sendButton, (!connected || inputText.trim().length === 0) && styles.sendButtonDisabled, { backgroundColor: '#3B82F6' }]}
                onPress={sendMessage}
                disabled={!connected || inputText.trim().length === 0}
              >
                <Ionicons name="arrow-up" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

        </KeyboardAvoidingView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingBottom: 20,
    zIndex: 10,
  },
  headerLeftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  onlineDot: {
    backgroundColor: '#34C759',
  },
  offlineDot: {
    backgroundColor: '#8E8E93',
  },
  moreButton: {
    padding: 8,
    borderRadius: 20,
  },
  sheetSection: {
    flex: 1,
    borderTopLeftRadius: 38,
    borderTopRightRadius: 38,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 5,
    overflow: 'hidden',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: -10,
  },
  backButton: {
    padding: 5,
    marginRight: 5,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerStatus: {
    fontSize: 11,
    fontWeight: '600',
  },
  offlineStatus: {
    color: '#8E8E93',
  },
  listContent: {
    paddingTop: 120,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  messageWrapper: {
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  myMessageWrapper: {
    justifyContent: 'flex-end',
  },
  theirMessageWrapper: {
    justifyContent: 'flex-start',
  },
  smallAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
    marginBottom: 2,
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
  },
  myBubble: {
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  myText: {
    color: '#fff',
  },
  theirText: {
  },
  timeText: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  myTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  theirTime: {
    color: 'rgba(0, 0, 0, 0.4)',
  },
  timeAndReceiptContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  receiptIcon: {
    marginLeft: 4,
  },
  inputWrapper: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    paddingHorizontal: 20,
  },
  inputBackground: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 30,
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginBottom: 10,
    borderWidth: 1,
  },
  attachButton: {
    padding: 2,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: 'transparent',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
    fontSize: 16,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});