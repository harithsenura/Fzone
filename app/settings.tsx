import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  SafeAreaView, 
  ScrollView,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { router, Stack } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useThemeColor } from '../hooks/use-theme-color';

export default function SettingsScreen() {
  const { logout } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/login');
          },
        },
      ]
    );
  };

  const SettingsOption = ({ icon, title, color }: { icon: any, title: string, color?: string }) => {
    const textColor = useThemeColor({}, 'text');
    const iconBackground = useThemeColor({ light: '#f0f4f8', dark: '#2C2C2E' }, 'background');
    const chevronColor = useThemeColor({ light: '#ccc', dark: '#444' }, 'text');
    const finalColor = color || textColor;

    return (
      <TouchableOpacity style={[styles.optionContainer, { backgroundColor: useThemeColor({ light: '#fff', dark: '#1E1E1E' }, 'card') }]}>
        <View style={[styles.optionIconContainer, { backgroundColor: iconBackground }]}>
          <Ionicons name={icon} size={22} color={finalColor} />
        </View>
        <Text style={[styles.optionTitle, { color: finalColor }]}>{title}</Text>
        <Ionicons name="chevron-forward" size={20} color={chevronColor} style={styles.optionChevron} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: useThemeColor({ light: '#f8f9fa', dark: '#121212' }, 'background') }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="auto" />
      
      <View style={[styles.header, { backgroundColor: useThemeColor({ light: '#fff', dark: '#121212' }, 'background'), borderBottomColor: useThemeColor({ light: '#eee', dark: '#2C2C2E' }, 'border') }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={useThemeColor({}, 'text')} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: useThemeColor({}, 'text') }]}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={[styles.sectionCard, { backgroundColor: useThemeColor({ light: '#fff', dark: '#1E1E1E' }, 'card'), borderColor: useThemeColor({ light: '#eee', dark: '#2C2C2E' }, 'border') }]}>
            <SettingsOption icon="person-outline" title="Personal Information" />
            <View style={[styles.divider, { backgroundColor: useThemeColor({ light: '#f0f0f0', dark: '#2C2C2E' }, 'border') }]} />
            <SettingsOption icon="shield-checkmark-outline" title="Password & Security" />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={[styles.sectionCard, { backgroundColor: useThemeColor({ light: '#fff', dark: '#1E1E1E' }, 'card'), borderColor: useThemeColor({ light: '#eee', dark: '#2C2C2E' }, 'border') }]}>
            <SettingsOption icon="notifications-outline" title="Notifications" />
            <View style={[styles.divider, { backgroundColor: useThemeColor({ light: '#f0f0f0', dark: '#2C2C2E' }, 'border') }]} />
            <SettingsOption icon="lock-closed-outline" title="Privacy" />
            <View style={[styles.divider, { backgroundColor: useThemeColor({ light: '#f0f0f0', dark: '#2C2C2E' }, 'border') }]} />
            <SettingsOption icon="color-palette-outline" title="Display & Theme" />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <View style={[styles.sectionCard, { backgroundColor: useThemeColor({ light: '#fff', dark: '#1E1E1E' }, 'card'), borderColor: useThemeColor({ light: '#eee', dark: '#2C2C2E' }, 'border') }]}>
            <SettingsOption icon="help-circle-outline" title="Help Center" />
            <View style={[styles.divider, { backgroundColor: useThemeColor({ light: '#f0f0f0', dark: '#2C2C2E' }, 'border') }]} />
            <SettingsOption icon="information-circle-outline" title="About" />
          </View>
        </View>

        <TouchableOpacity style={[styles.logoutButton, { backgroundColor: useThemeColor({ light: '#fff', dark: '#1E1E1E' }, 'card') }]} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#FF3B30" />
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
        
        <View style={{ height: 40 }} />

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backBtn: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  scrollContent: {
    padding: 20,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 5,
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#eee',
  },
  optionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 15,
    backgroundColor: '#fff',
  },
  optionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f4f8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  optionTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  optionChevron: {
    opacity: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginLeft: 60,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 15,
    borderRadius: 15,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.3)',
  },
  logoutButtonText: {
    color: '#FF3B30',
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 16,
  },
});
