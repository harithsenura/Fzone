import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface FeedPostCardProps {
  user: {
    name: string;
    avatar: string;
    meta?: string;
  };
  content: string;
  header?: string;
  subHeader?: string;
  body?: string;
  image: string;
  likes: number;
  comments: number;
}

/**
 * Feed Post Card
 * Replicates the clean social feed look with large rounded images and simple actions.
 */
export const FeedPostCard: React.FC<FeedPostCardProps> = ({ user, content, header, subHeader, body, image, likes, comments }) => {
  return (
    <View 
      className="bg-white rounded-[32px] p-5 mb-5"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.04,
        shadowRadius: 30,
        elevation: 2,
      }}
    >
      {/* Header Row */}
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center">
          <Image source={{ uri: user.avatar }} className="w-12 h-12 rounded-full" />
          <View className="ml-3">
            <Text className="text-slate-900 text-base font-bold">{user.name}</Text>
            <Text className="text-slate-500 text-sm">{user.meta || '2 Hours ago'}</Text>
          </View>
        </View>
        <TouchableOpacity>
          <Ionicons name="ellipsis-horizontal" size={20} color="#65676B" />
        </TouchableOpacity>
      </View>

      {/* Content Section */}
      <View className="mb-4">
        {header ? (
          <Text className="text-slate-900 text-xl font-extrabold mb-1">
            {header}
          </Text>
        ) : null}
        
        {subHeader ? (
          <Text className="text-slate-500 text-sm font-medium mb-3 italic">
            {subHeader}
          </Text>
        ) : null}

        <Text className="text-slate-700 text-base leading-6">
          {body || content}
        </Text>
      </View>

      {/* Post Image - Highly Rounded */}
      <View className="overflow-hidden rounded-2xl mb-5">
        <Image 
          source={{ uri: image }} 
          className="w-full h-64 h-80" 
          resizeMode="cover"
        />
      </View>

      {/* Action Bar */}
      <View className="flex-row items-center justify-between border-t border-slate-50 pt-4">
        <TouchableOpacity className="flex-row items-center gap-2">
          <Ionicons name="heart-outline" size={24} color="#65676B" />
          <Text className="text-slate-500 font-medium">{likes}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity className="flex-row items-center gap-2">
          <Ionicons name="chatbubble-outline" size={22} color="#65676B" />
          <Text className="text-slate-500 font-medium">{comments}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity className="flex-row items-center gap-2">
          <Ionicons name="share-outline" size={24} color="#65676B" />
          <Text className="text-slate-500 font-medium">Share</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
