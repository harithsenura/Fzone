import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, Image, ScrollView, 
  KeyboardAvoidingView, Platform, Dimensions, ActivityIndicator, Alert, DeviceEventEmitter
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/context/AuthContext';
import { API_BASE_URL } from '@/config/api';
import Animated, { FadeIn, FadeOut, SlideInUp } from 'react-native-reanimated';
import { useThemeColor } from '@/hooks/use-theme-color';

const { width } = Dimensions.get('window');

export default function CreatePostScreen() {
  const { user } = useAuth();
  const [header, setHeader] = useState('');
  const [subHeader, setSubHeader] = useState('');
  const [body, setBody] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const secondaryTextColor = useThemeColor({ light: '#999', dark: '#94A3B8' }, 'text');
  const cardBackground = useThemeColor({ light: '#fff', dark: '#1E1E1E' }, 'card');
  const borderBottomColor = useThemeColor({ light: '#F0F0F0', dark: '#2C2C2E' }, 'border');
  const btnBackground = useThemeColor({ light: '#007AFF', dark: '#3B82F6' }, 'background');

  const pickImages = async () => {
    try {
      if (images.length >= 5) {
        Alert.alert("Limit Reached", "You can only select up to 5 images.");
        return;
      }
      
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionResult.granted === false) {
        Alert.alert("Permission to access camera roll is required!");
        return;
      }

      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: 5 - images.length,
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets) {
        const newImages = result.assets.map(asset => asset.uri);
        setImages(prev => [...prev, ...newImages].slice(0, 5));
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Could not pick images.");
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handlePost = () => {
    if (loading) return; // Prevent multiple clicks
    
    if (!header.trim() && !body.trim() && images.length === 0) {
      Alert.alert("Wait!", "Please add some content or photos first.");
      return;
    }

    setLoading(true);

    DeviceEventEmitter.emit('UPLOAD_POST', {
      userId: user?._id || 'temp',
      userName: user?.name || 'Kavindu Nimesh',
      userAvatar: user?.avatar,
      header: header.trim(),
      subHeader: subHeader.trim(),
      body: body.trim(),
      text: header.trim() || body.trim(),
      images
    });

    router.back();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: backgroundColor }}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <StatusBar style="auto" />
      
      {/* Header */}
      <View style={[styles.header, { borderBottomColor }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <Ionicons name="close-outline" size={28} color={textColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textColor }]}>New Post</Text>
        <TouchableOpacity 
          style={[styles.postBtn, { backgroundColor: btnBackground }, (!header.trim() && !body.trim() && images.length===0) && [styles.postBtnDisabled, { opacity: 0.5 }]]} 
          onPress={handlePost} 
          disabled={loading || (!header.trim() && !body.trim() && images.length===0)}
        >
          {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.postBtnText}>Post</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} style={{ flex: 1 }}>
        
        <View style={styles.authorRow}>
          <Image 
            source={{ uri: user?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=500&q=80' }} 
            style={styles.avatar} 
          />
          <Text style={[styles.authorName, { color: textColor }]}>{user?.name || "Kavindu Nimesh"}</Text>
        </View>

        <TextInput
          style={[styles.headerInput, { color: textColor }]}
          placeholder="Add a catchy title..."
          placeholderTextColor={secondaryTextColor}
          value={header}
          onChangeText={setHeader}
        />

        <TextInput
          style={[styles.subHeaderInput, { color: secondaryTextColor }]}
          placeholder="Add a sub-heading (optional)"
          placeholderTextColor={secondaryTextColor}
          value={subHeader}
          onChangeText={setSubHeader}
        />

        <TextInput
          style={[styles.bodyInput, { color: textColor }]}
          placeholder="Write your story here..."
          placeholderTextColor={secondaryTextColor}
          multiline
          autoFocus={false}
          value={body}
          onChangeText={setBody}
        />

        {images.length > 0 && (
          <Animated.View entering={FadeIn} exiting={FadeOut}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
              {images.map((img, idx) => (
                <View key={idx} style={styles.imageWrapper}>
                  <Image source={{ uri: img }} style={styles.selectedImage} />
                  <TouchableOpacity style={styles.removeBtn} onPress={() => removeImage(idx)}>
                    <Ionicons name="close" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </Animated.View>
        )}

      </ScrollView>

      {/* Footer Toolbar */}
      <View style={[styles.toolbar, { borderTopColor: borderBottomColor, backgroundColor: cardBackground }]}>
        <TouchableOpacity style={styles.toolbarItem} onPress={pickImages}>
          <Ionicons name="image-outline" size={26} color={(images.length >= 5) ? secondaryTextColor : '#3B82F6'} />
          <Text style={[styles.toolbarText, { color: textColor }]}>Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolbarItem}>
          <Ionicons name="camera-outline" size={26} color="#3B82F6" />
        </TouchableOpacity>
      </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 15, paddingBottom: 15, borderBottomWidth: 1
  },
  iconBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  postBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  postBtnDisabled: { },
  postBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  content: { padding: 20 },
  authorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
  authorName: { fontSize: 16, fontWeight: '600' },
  headerInput: {
    fontSize: 24, fontWeight: '800', marginBottom: 8,
  },
  subHeaderInput: {
    fontSize: 18, fontWeight: '600', marginBottom: 15,
  },
  bodyInput: {
    fontSize: 16, minHeight: 120,
    textAlignVertical: 'top', lineHeight: 24, marginBottom: 20
  },
  imageScroll: { marginBottom: 20, paddingTop: 10 },
  imageWrapper: { position: 'relative', marginRight: 15 },
  selectedImage: { width: 140, height: 200, borderRadius: 15 },
  removeBtn: {
    position: 'absolute', top: 10, right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)', width: 24, height: 24,
    borderRadius: 12, justifyContent: 'center', alignItems: 'center'
  },
  toolbar: {
    flexDirection: 'row', padding: 15, borderTopWidth: 1, 
    paddingBottom: 15
  },
  toolbarItem: { flexDirection: 'row', alignItems: 'center', marginRight: 25 },
  toolbarText: { marginLeft: 8, fontSize: 16, fontWeight: '500' }
});
