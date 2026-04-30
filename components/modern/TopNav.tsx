import React from 'react';
import { View, TextInput, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Modern Sticky Top Navigation
 * Replicates the soft, clean aesthetic with pill-shaped search and circular buttons.
 */
export const TopNav = () => {
  return (
    <View className="flex-row items-center justify-between px-4 py-3 bg-white sticky top-0 z-50">
      {/* Profile Avatar */}
      <TouchableOpacity className="w-10 h-10 rounded-full overflow-hidden">
        <Image 
          source={{ uri: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80' }} 
          className="w-full h-full"
        />
      </TouchableOpacity>

      {/* Search Bar - Pill Shaped */}
      <View className="flex-1 mx-3 flex-row items-center bg-slate-100 rounded-full px-4 py-2">
        <Ionicons name="search-outline" size={18} color="#65676B" />
        <TextInput 
          placeholder="Search Fzone" 
          placeholderTextColor="#65676B"
          className="flex-1 ml-2 text-slate-900 text-base py-0"
        />
      </View>

      {/* Action Buttons */}
      <View className="flex-row gap-3">
        <TouchableOpacity className="w-10 h-10 rounded-full bg-slate-100 items-center justify-center">
          <View className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white z-10" />
          <Ionicons name="notifications-outline" size={22} color="#1C1E21" />
        </TouchableOpacity>
        
        <TouchableOpacity className="w-10 h-10 rounded-full bg-slate-100 items-center justify-center">
          <Ionicons name="chatbubble-ellipses-outline" size={22} color="#1C1E21" />
        </TouchableOpacity>
      </View>
    </View>
  );
};
