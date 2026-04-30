import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';

interface FriendRequestCardProps {
  name: string;
  avatar: string;
  mutualFriends: number;
}

/**
 * Friend Request Card
 * Soft white card with heavy rounding (24px-32px) and diffused shadows.
 */
export const FriendRequestCard: React.FC<FriendRequestCardProps> = ({ name, avatar, mutualFriends }) => {
  return (
    <View 
      className="bg-white rounded-[32px] p-5 flex-row items-center mb-4"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.04,
        shadowRadius: 30,
        elevation: 2,
      }}
    >
      {/* User Avatar - Pill Shaped */}
      <Image 
        source={{ uri: avatar }} 
        className="w-16 h-16 rounded-full"
      />

      {/* Content Area */}
      <View className="flex-1 ml-4 justify-center">
        <Text className="text-slate-900 text-lg font-bold leading-tight" numberOfLines={1}>
          {name}
        </Text>
        <Text className="text-slate-500 text-sm mt-1">
          {mutualFriends} mutual friends
        </Text>

        {/* Action Buttons - Side by Side Pill Shaped */}
        <View className="flex-row mt-3 gap-2">
          <TouchableOpacity className="bg-blue-600 rounded-full px-5 py-2.5 flex-1 items-center justify-center">
            <Text className="text-white font-bold text-[15px]">Accept</Text>
          </TouchableOpacity>
          
          <TouchableOpacity className="bg-slate-100 rounded-full px-5 py-2.5 flex-1 items-center justify-center">
            <Text className="text-blue-600 font-bold text-[15px]">Reject</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};
