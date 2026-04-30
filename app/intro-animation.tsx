import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions, Text, Image } from 'react-native';
import { router, Stack } from 'expo-router';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withSequence, 
  withDelay,
  Easing,
  FadeIn,
  SlideInLeft
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function IntroAnimationScreen() {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    scale.value = withSequence(
      withTiming(1.2, { duration: 800, easing: Easing.out(Easing.back(1.5)) }),
      withTiming(1, { duration: 400 })
    );
    
    opacity.value = withTiming(1, { duration: 600 });
    
    textOpacity.value = withDelay(800, withTiming(1, { duration: 800 }));
    translateY.value = withDelay(800, withTiming(0, { duration: 800, easing: Easing.out(Easing.quad) }));

    const timeout = setTimeout(() => {
      router.replace('/welcome');
    }, 3000);

    return () => clearTimeout(timeout);
  }, []);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#FFFFFF' }]} />
      
      <View style={styles.content}>
        <Animated.View style={[styles.logoContainer, iconStyle]}>
          <View style={styles.logoIcon}>
            <Image 
              source={require('../assets/images/Fzone.png')} 
              style={styles.logoImage} 
              resizeMode="contain" 
            />
          </View>
        </Animated.View>
        
        <Animated.View style={[styles.textContainer, textStyle]}>
          <Text style={styles.title}>FZONE</Text>
          <Text style={styles.subtitle}>EXPERIENCE THE FUTURE</Text>
        </Animated.View>
      </View>

      <View style={styles.loaderContainer}>
        <Animated.View entering={FadeIn.delay(1500)} style={styles.loaderTrack}>
            <Animated.View 
                entering={SlideInLeft.delay(1600).duration(1000)}
                style={styles.loaderFill} 
            />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  content: {
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 30,
  },
  logoIcon: {
    width: 120,
    height: 120,
    borderRadius: 28,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  textContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 42,
    fontWeight: '900',
    color: '#0F172A', // Dark color for white background
    letterSpacing: 10,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B', // Muted color for white background
    letterSpacing: 4,
  },
  loaderContainer: {
    position: 'absolute',
    bottom: 80,
    width: width * 0.6,
  },
  loaderTrack: {
    height: 3,
    backgroundColor: '#F1F5F9',
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  loaderFill: {
    height: '100%',
    width: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 1.5,
  },
});

