import { AnimatedBackground } from '@/components/AnimatedBackground';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import {
  Dimensions,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp
} from 'react-native-reanimated';

import { useThemeColor } from '../hooks/use-theme-color';

const { width, height } = Dimensions.get('window');

export default function WelcomeScreen() {
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const secondaryTextColor = useThemeColor({ light: '#64748B', dark: '#94A3B8' }, 'text');
  const titleColor = useThemeColor({ light: '#0F172A', dark: '#FFFFFF' }, 'text');
  const logoTextColor = useThemeColor({ light: '#1E293B', dark: '#FFFFFF' }, 'text');

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <StatusBar style="auto" />
      <Stack.Screen options={{ headerShown: false }} />
      <AnimatedBackground />

      <SafeAreaView style={styles.content}>
        <View style={styles.topSection}>
          <Animated.View
            entering={FadeInUp.delay(300).duration(800).springify()}
            style={styles.logoContainer}
          >
            <View style={styles.logoIcon}>
              <Image 
                source={require('../assets/images/Fzone.png')} 
                style={styles.logoImage} 
                resizeMode="contain" 
              />
            </View>
            <Text style={[styles.logoText, { color: logoTextColor }]}>Fzone</Text>
          </Animated.View>
        </View>

        <View style={styles.bottomSection}>
          <Animated.View
            entering={FadeInDown.delay(500).duration(800).springify()}
            style={styles.textGroup}
          >
            <Text style={[styles.title, { color: titleColor }]}>Connect with the universe</Text>
            <Text style={[styles.subtitle, { color: secondaryTextColor }]}>
              Experience the next generation of social interaction. Fast, secure, and beautiful.
            </Text>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(700).duration(800).springify()}
            style={styles.buttonContainer}
          >
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push('/signup')}
              style={styles.primaryButton}
            >
              <View style={[styles.solidButton, { backgroundColor: '#3B82F6' }]}>
                <Text style={styles.primaryButtonText}>Get Started</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFF" style={{ marginLeft: 8 }} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push('/login')}
              style={styles.secondaryButton}
            >
              <Text style={[styles.secondaryButtonText, { color: secondaryTextColor }]}>Already have an account? <Text style={styles.loginText}>Login</Text></Text>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(900).duration(800)}
            style={styles.footer}
          >
            <Text style={[styles.footerText, { color: useThemeColor({ light: '#94A3B8', dark: '#64748B' }, 'text') }]}>By continuing you agree to our Terms & Conditions</Text>
          </Animated.View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 40, // Balanced professional padding
  },
  topSection: {
    flex: 1.2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoIcon: {
    width: 90,
    height: 90,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    overflow: 'hidden',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  logoText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1E293B',
    marginTop: 15,
    letterSpacing: -0.5,
  },
  bottomSection: {
    paddingBottom: 50,
    alignItems: 'center',
    width: '100%',
  },
  textGroup: {
    alignItems: 'center',
    marginBottom: 35,
    paddingHorizontal: 25, // Narrower text content for professional look
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 38,
    letterSpacing: -1,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 15, // Increased internal padding for text balance
  },
  buttonContainer: {
    gap: 12,
    width: '100%',
    alignItems: 'center',
  },
  primaryButton: {
    height: 54,
    borderRadius: 16,
    overflow: 'hidden',
    width: '75%', // Significantly reduced width
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  solidButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    color: '#64748B',
  },
  loginText: {
    color: '#3B82F6',
    fontWeight: '700',
  },
  footer: {
    marginTop: 25,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 10,
    color: '#94A3B8',
    textAlign: 'center',
  },
});


