import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColor } from '../../hooks/use-theme-color';

export default function TabLayout() {
  const activeTintColor = useThemeColor({ light: '#007AFF', dark: '#FFFFFF' }, 'tint');
  const inactiveTintColor = useThemeColor({ light: '#8E8E93', dark: '#8E8E93' }, 'tabIconDefault');
  const backgroundColor = useThemeColor({ light: '#fff', dark: '#121212' }, 'background');
  const borderTopColor = useThemeColor({ light: '#F2F2F7', dark: '#2C2C2E' }, 'border');

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: activeTintColor,
        tabBarInactiveTintColor: inactiveTintColor,
        
        tabBarStyle: {
          backgroundColor: backgroundColor,
          borderTopColor: borderTopColor,
        },
        tabBarHideOnKeyboard: true,
        tabBarTranslucent: true,
      }}>

      {/* 1. Home Tab */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={28} color={color} />
          ),
        }}
      />

      {/* 2. Explore Tab (Chat) */}
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "chatbubbles" : "chatbubbles-outline"} size={28} color={color} />
          ),
        }}
      />

      {/* 3. Notifications Tab (Explore) */}
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "compass" : "compass-outline"} size={28} color={color} />
          ),
        }}
      />

      {/* 4. Profile Tab */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "person-circle" : "person-circle-outline"} size={28} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}