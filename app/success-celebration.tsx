import React, { useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Dimensions } from 'react-native';
import { router, Stack } from 'expo-router';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withSpring,
  withDelay,
  withRepeat,
  withSequence,
  Easing
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColor } from '@/hooks/use-theme-color';

const { width, height } = Dimensions.get('window');

const Particle = ({ delay }: { delay: number }) => {
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  useEffect(() => {
    const angle = Math.random() * Math.PI * 2;
    const distance = 100 + Math.random() * 200;
    
    translateX.value = withDelay(delay, withTiming(Math.cos(angle) * distance, { duration: 1500 }));
    translateY.value = withDelay(delay, withTiming(Math.sin(angle) * distance - 100, { duration: 1500 }));
    opacity.value = withDelay(delay + 1000, withTiming(0, { duration: 500 }));
    scale.value = withDelay(delay, withTiming(0.5, { duration: 1500 }));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value }
    ],
    opacity: opacity.value,
  }));

  const colors = ['#3B82F6', '#60A5FA', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
  const color = colors[Math.floor(Math.random() * colors.length)];

  return (
    <Animated.View 
      style={[
        styles.particle, 
        { backgroundColor: color },
        animatedStyle
      ]} 
    />
  );
};

export default function SuccessCelebrationScreen() {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 12 });
    opacity.value = withTiming(1, { duration: 1000 });
  }, []);

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const secondaryTextColor = useThemeColor({ light: '#64748B', dark: '#94A3B8' }, 'text');
  const cardBackground = useThemeColor({ light: 'rgba(255, 255, 255, 0.95)', dark: 'rgba(30, 30, 30, 0.95)' }, 'card');
  const borderBottomColor = useThemeColor({ light: 'rgba(255, 255, 255, 0.5)', dark: 'rgba(255, 255, 255, 0.1)' }, 'border');

  const handleContinue = () => {
    router.replace('/(tabs)');
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor }]} />
      
      <View style={styles.particlesContainer}>
        {[...Array(30)].map((_, i) => (
          <Particle key={i} delay={i * 20} />
        ))}
      </View>

      <Animated.View style={[styles.content, contentStyle, { backgroundColor: cardBackground, borderColor: borderBottomColor }]}>
        <View style={styles.iconContainer}>
          <LinearGradient
            colors={['#10B981', '#059669']}
            style={styles.checkCircle}
          >
            <Ionicons name="checkmark" size={60} color="#FFF" />
          </LinearGradient>
        </View>

        <Text style={[styles.title, { color: textColor }]}>All Set!</Text>
        <Text style={[styles.subtitle, { color: secondaryTextColor }]}>
          Your profile is ready. Welcome to the Fzone community.
        </Text>

        <TouchableOpacity 
          activeOpacity={0.8}
          onPress={handleContinue}
          style={styles.button}
        >
          <View style={[styles.solidButton, { backgroundColor: '#3B82F6' }]}>
            <Text style={styles.buttonText}>Enter Fzone</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFF" style={{ marginLeft: 8 }} />
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  particlesContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  particle: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  content: {
    width: '85%',
    borderRadius: 35,
    padding: 35,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 8,
  },
  iconContainer: {
    marginBottom: 25,
  },
  checkCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 35,
  },
  button: {
    width: '100%',
    height: 58,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  solidButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
  },
});

