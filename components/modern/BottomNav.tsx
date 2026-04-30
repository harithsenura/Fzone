import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Floating Bottom Navigation
 * Highly rounded pill-shaped bar that floats above the background.
 */
export const BottomNav = ({ activeTab = 'home' }: { activeTab?: string }) => {
  const tabs = [
    { id: 'home', icon: 'home' },
    { id: 'reels', icon: 'play-circle' },
    { id: 'store', icon: 'cart' },
    { id: 'profile', icon: 'person' },
    { id: 'menu', icon: 'grid' },
  ];

  return (
    <View className="absolute bottom-8 left-6 right-6 h-16 bg-white/95 rounded-full flex-row items-center justify-around px-4 shadow-xl shadow-slate-200/50 border border-slate-50">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <TouchableOpacity 
            key={tab.id} 
            className="w-12 h-12 items-center justify-center rounded-full"
          >
            <Ionicons 
              name={isActive ? (tab.icon as any) : (`${tab.icon}-outline` as any)} 
              size={24} 
              color={isActive ? '#1877F2' : '#65676B'} 
            />
            {isActive && (
              <View className="absolute -bottom-1 w-1 h-1 bg-blue-600 rounded-full" />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};
