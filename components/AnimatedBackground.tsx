import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { useThemeColor } from '@/hooks/use-theme-color';

export const AnimatedBackground = () => {
  const backgroundColor = useThemeColor({}, 'background');
  const blurTint = useThemeColor({ light: 'light', dark: 'dark' } as any, 'background');

  return (
    <View 
      style={StyleSheet.absoluteFill} 
      pointerEvents="none"
    >
      <View 
        style={[StyleSheet.absoluteFill, { backgroundColor }]} 
        pointerEvents="none" 
      />
      <BlurView 
        intensity={20} 
        tint={blurTint} 
        style={StyleSheet.absoluteFill} 
        pointerEvents="none" 
      />
    </View>
  );
};

const styles = StyleSheet.create({
});