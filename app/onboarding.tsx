import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  SafeAreaView, 
  Image,
  TextInput,
  Animated,
  Dimensions,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/context/AuthContext';
import { uploadToCloudinary } from '@/utils/cloudinary';
import { useThemeColor } from '../hooks/use-theme-color';

const { width } = Dimensions.get('window');

export default function OnboardingScreen() {
  const [step, setStep] = useState(1);
  const [image, setImage] = useState<string | null>(null);
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { user, updateProfile } = useAuth();
  
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const secondaryTextColor = useThemeColor({ light: '#707070', dark: '#94A3B8' }, 'text');
  const cardBackground = useThemeColor({ light: '#fff', dark: '#1E1E1E' }, 'card');
  const inputBackground = useThemeColor({ light: '#fff', dark: '#242424' }, 'background');
  const borderBottomColor = useThemeColor({ light: '#E8E8E8', dark: '#2C2C2E' }, 'border');
  const progressBarBackground = useThemeColor({ light: '#E8E8E8', dark: '#2C2C2E' }, 'background');
  
  const slideAnim = useRef(new Animated.Value(0)).current;

  const pickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permissionResult.granted === false) {
        alert("You've refused to allow this app to access your photos!");
        return;
      }

      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImage(result.assets[0].uri);
      }
    } catch (error: any) {
      console.error("Error picking image:", error);
      alert(`Something went wrong: ${error.message || error}`);
    }
  };

  const nextStep = () => {
    setStep(2);
    Animated.timing(slideAnim, {
      toValue: -width,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const handleFinish = async () => {
    if (!user?._id) {
      router.replace('/(tabs)');
      return;
    }

    setLoading(true);
    
    try {
      let avatarUrl = image;
      
      if (image && image.startsWith('file://')) {
        avatarUrl = await uploadToCloudinary(image);
      }

      const result = await updateProfile(user._id, avatarUrl || undefined, bio || undefined);
      setLoading(false);
      
      if (result.success) {
        router.replace('/success-celebration');
      } else {
        alert(`Failed to save profile: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Profile Upload Failed:', error);
      setLoading(false);
      alert("Failed to upload profile picture. Please try again.");
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <StatusBar style="auto" />
      
      <View style={styles.header}>
        <Text style={[styles.stepText, { color: secondaryTextColor }]}>Step {step} of 2</Text>
        <View style={[styles.progressContainer, { backgroundColor: progressBarBackground }]}>
          <View style={[styles.progressBar, { width: step === 1 ? '50%' : '100%', backgroundColor: '#3b82f6' }]} />
        </View>
      </View>

      <Animated.View 
        style={[
          styles.sliderContainer, 
          { transform: [{ translateX: slideAnim }] }
        ]}
      >
        {/* Step 1: Profile Picture */}
        <View style={styles.stepContainer}>
          <View style={styles.contentContainer}>
            <Text style={[styles.title, { color: textColor }]}>Add a Profile Picture</Text>
            <Text style={[styles.subtitle, { color: secondaryTextColor }]}>Put a face to your name so people can recognize you</Text>

            <TouchableOpacity style={[styles.imagePickerBtn, { backgroundColor: useThemeColor({ light: '#F2F2F2', dark: '#242424' }, 'background'), borderColor: borderBottomColor }]} onPress={pickImage}>
              {image ? (
                <Image source={{ uri: image }} style={styles.profileImage} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Ionicons name="camera-outline" size={40} color={secondaryTextColor} />
                  <Text style={[styles.uploadText, { color: secondaryTextColor }]}>Upload Photo</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.skipButton} onPress={nextStep}>
              <Text style={[styles.skipButtonText, { color: secondaryTextColor }]}>Skip for now</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryButton} onPress={nextStep}>
              <Text style={styles.primaryButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Step 2: Bio */}
        <View style={styles.stepContainer}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
            style={{ flex: 1 }}
          >
            <View style={styles.contentContainer}>
              <Text style={[styles.title, { color: textColor }]}>Write your bio</Text>
              <Text style={[styles.subtitle, { color: secondaryTextColor }]}>Tell us a bit about yourself and what you do</Text>

              <View style={[styles.inputWrapper, { backgroundColor: inputBackground, borderColor: borderBottomColor }]}>
                <TextInput
                  style={[styles.bioInput, { color: textColor }]}
                  placeholder="e.g. 🎨 UI/UX Designer & Developer\n📍 Sri Lanka"
                  placeholderTextColor={secondaryTextColor}
                  multiline
                  numberOfLines={4}
                  value={bio}
                  onChangeText={setBio}
                  textAlignVertical="top"
                />
              </View>
            </View>

            <View style={styles.footer}>
              {loading ? (
                <ActivityIndicator color="#3b82f6" size="large" />
              ) : (
                <TouchableOpacity style={styles.primaryButtonFull} onPress={handleFinish}>
                  <Text style={styles.primaryButtonText}>Finish Setup</Text>
                </TouchableOpacity>
              )}
            </View>
          </KeyboardAvoidingView>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  stepText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  progressContainer: {
    height: 4,
    borderRadius: 2,
    width: '100%',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  sliderContainer: {
    flex: 1,
    flexDirection: 'row',
    width: width * 2,
  },
  stepContainer: {
    width: width,
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
  },
  contentContainer: {
    flex: 1,
    paddingTop: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 40,
    paddingHorizontal: 10,
  },
  imagePickerBtn: {
    width: 150,
    height: 150,
    borderRadius: 75,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    alignItems: 'center',
  },
  uploadText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  inputWrapper: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 15,
    padding: 15,
  },
  bioInput: {
    fontSize: 16,
    minHeight: 120,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: Platform.OS === 'ios' ? 20 : 30,
    width: '100%',
  },
  skipButton: {
    flex: 1,
    height: 55,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButton: {
    flex: 1,
    height: 55,
    backgroundColor: '#3b82f6',
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  primaryButtonFull: {
    width: '100%',
    height: 55,
    backgroundColor: '#3b82f6',
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
