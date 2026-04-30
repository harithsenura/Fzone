import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    SafeAreaView,
    KeyboardAvoidingView,
    Platform,
    Dimensions,
    Alert,
    ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import Animated, { 
    FadeInDown, 
    FadeInUp, 
    useSharedValue, 
    useAnimatedStyle, 
    withTiming,
    interpolateColor
} from 'react-native-reanimated';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/context/AuthContext';

const { width } = Dimensions.get('window');

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();

    const backgroundColor = useThemeColor({}, 'background');
    const textColor = useThemeColor({}, 'text');
    const secondaryTextColor = useThemeColor({ light: '#64748B', dark: '#94A3B8' }, 'text');
    const titleColor = useThemeColor({ light: '#0F172A', dark: '#FFFFFF' }, 'text');
    const inputBackground = useThemeColor({ light: 'rgba(255, 255, 255, 0.7)', dark: 'rgba(30, 30, 30, 0.7)' }, 'background');
    const inputActiveBackground = useThemeColor({ light: 'rgba(255, 255, 255, 1)', dark: 'rgba(40, 40, 40, 1)' }, 'background');
    const inputBorder = useThemeColor({ light: 'rgba(255, 255, 255, 0.5)', dark: 'rgba(255, 255, 255, 0.1)' }, 'border');
    const buttonBackground = '#3B82F6';
    
    const emailFocus = useSharedValue(0);
    const passwordFocus = useSharedValue(0);

    const emailAnimatedStyle = useAnimatedStyle(() => ({
        borderColor: interpolateColor(emailFocus.value, [0, 1], [inputBorder, '#3B82F6']),
        backgroundColor: withTiming(emailFocus.value ? inputActiveBackground : inputBackground),
        transform: [{ scale: withTiming(emailFocus.value ? 1.02 : 1) }],
        shadowOpacity: withTiming(emailFocus.value ? 0.1 : 0),
    }));

    const passwordAnimatedStyle = useAnimatedStyle(() => ({
        borderColor: interpolateColor(passwordFocus.value, [0, 1], [inputBorder, '#3B82F6']),
        backgroundColor: withTiming(passwordFocus.value ? inputActiveBackground : inputBackground),
        transform: [{ scale: withTiming(passwordFocus.value ? 1.02 : 1) }],
        shadowOpacity: withTiming(passwordFocus.value ? 0.1 : 0),
    }));

    const handleLogin = async () => {
        if (!email.trim() || !password.trim()) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        setLoading(true);
        const result = await login(email.trim(), password);
        setLoading(false);

        if (result.success) {
            router.replace('/(tabs)');
        } else {
            Alert.alert('Login Failed', result.error || 'Please try again');
        }
    };

    return (
        <View style={[styles.container, { backgroundColor }]}>
            <StatusBar style="auto" />
            <Stack.Screen options={{ headerShown: false }} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor }]} />

            <SafeAreaView style={{ flex: 1 }}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardView}
                >
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={[styles.backButton, { backgroundColor: inputBackground, borderColor: inputBorder }]}
                    >
                        <Ionicons name="chevron-back" size={24} color={textColor} />
                    </TouchableOpacity>

                    <View style={styles.content}>
                        <Animated.View 
                            entering={FadeInUp.delay(200).duration(800).springify()}
                            style={styles.header}
                        >
                            <Text style={[styles.title, { color: titleColor }]}>Welcome back</Text>
                            <Text style={[styles.subtitle, { color: secondaryTextColor }]}>Enter your details to access your account</Text>
                        </Animated.View>

                        <Animated.View 
                            entering={FadeInDown.delay(400).duration(800).springify()}
                            style={styles.form}
                        >
                            <View style={styles.inputContainer}>
                                <Animated.View style={[styles.inputGlass, emailAnimatedStyle]}>
                                    <Ionicons name="mail-outline" size={20} color={emailFocus.value ? "#3B82F6" : secondaryTextColor} style={styles.inputIcon} />
                                    <TextInput
                                        placeholder="Email Address"
                                        style={[styles.input, { color: textColor }]}
                                        placeholderTextColor={secondaryTextColor}
                                        autoCapitalize="none"
                                        keyboardType="email-address"
                                        value={email}
                                        onChangeText={setEmail}
                                        editable={!loading}
                                        onFocus={() => { emailFocus.value = withTiming(1); }}
                                        onBlur={() => { emailFocus.value = withTiming(0); }}
                                    />
                                </Animated.View>
                            </View>

                            <View style={styles.inputContainer}>
                                <Animated.View style={[styles.inputGlass, passwordAnimatedStyle]}>
                                    <Ionicons name="lock-closed-outline" size={20} color={passwordFocus.value ? "#3B82F6" : secondaryTextColor} style={styles.inputIcon} />
                                    <TextInput
                                        placeholder="Password"
                                        style={[styles.input, { color: textColor }]}
                                        secureTextEntry={!showPassword}
                                        placeholderTextColor={secondaryTextColor}
                                        value={password}
                                        onChangeText={setPassword}
                                        editable={!loading}
                                        onFocus={() => { passwordFocus.value = withTiming(1); }}
                                        onBlur={() => { passwordFocus.value = withTiming(0); }}
                                    />
                                    <TouchableOpacity 
                                        onPress={() => setShowPassword(!showPassword)}
                                        style={styles.showPassword}
                                    >
                                        <Ionicons 
                                            name={showPassword ? "eye-off-outline" : "eye-outline"} 
                                            size={20} 
                                            color={secondaryTextColor} 
                                        />
                                    </TouchableOpacity>
                                </Animated.View>
                            </View>

                            <TouchableOpacity style={styles.forgotPassword}>
                                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={[styles.loginButton, loading && styles.loginButtonDisabled]} 
                                activeOpacity={0.8}
                                onPress={handleLogin}
                                disabled={loading}
                            >
                                <View style={[styles.solidButton, { backgroundColor: '#3B82F6' }]}>
                                    {loading ? (
                                        <ActivityIndicator color="#FFFFFF" />
                                    ) : (
                                        <Text style={styles.loginButtonText}>Sign In</Text>
                                    )}
                                </View>
                            </TouchableOpacity>


                            <View style={styles.dividerContainer}>
                                <View style={[styles.divider, { backgroundColor: inputBorder }]} />
                                <Text style={[styles.dividerText, { color: secondaryTextColor }]}>Or continue with</Text>
                                <View style={[styles.divider, { backgroundColor: inputBorder }]} />
                            </View>

                            <View style={styles.socialContainer}>
                                <TouchableOpacity style={[styles.socialButton, { backgroundColor: inputBackground, borderColor: inputBorder }]}>
                                    <Ionicons name="logo-google" size={24} color={textColor} />
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.socialButton, { backgroundColor: inputBackground, borderColor: inputBorder }]}>
                                    <Ionicons name="logo-apple" size={24} color={textColor} />
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.socialButton, { backgroundColor: inputBackground, borderColor: inputBorder }]}>
                                    <Ionicons name="logo-facebook" size={24} color={textColor} />
                                </TouchableOpacity>
                            </View>
                        </Animated.View>

                        <Animated.View 
                            entering={FadeInDown.delay(600).duration(800)}
                            style={styles.footer}
                        >
                            <Text style={[styles.footerText, { color: secondaryTextColor }]}>Don't have an account? </Text>
                            <TouchableOpacity onPress={() => router.push('/signup')}>
                                <Text style={styles.signUpText}>Sign Up</Text>
                            </TouchableOpacity>
                        </Animated.View>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    keyboardView: {
        flex: 1,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 20,
        marginTop: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.5)',
    },
    content: {
        flex: 1,
        paddingHorizontal: 35,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        marginBottom: 35,
        alignItems: 'center',
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: '#0F172A',
        letterSpacing: -0.5,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 15,
        color: '#64748B',
        marginTop: 8,
        textAlign: 'center',
    },
    form: {
        gap: 16,
        width: '100%',
    },
    inputContainer: {
        height: 58,
        borderRadius: 18,
        overflow: 'hidden',
    },
    inputGlass: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 18,
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.5)',
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 8,
        elevation: 2,
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        fontSize: 15,
        color: '#0F172A',
        fontWeight: '500',
    },
    showPassword: {
        padding: 4,
    },
    forgotPassword: {
        alignSelf: 'flex-end',
        marginTop: -4,
    },
    forgotPasswordText: {
        color: '#3B82F6',
        fontWeight: '600',
        fontSize: 13,
    },
    loginButton: {
        height: 58,
        borderRadius: 18,
        overflow: 'hidden',
        marginTop: 10,
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 5,
    },
    solidButton: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loginButtonText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '700',
    },
    loginButtonDisabled: {
        opacity: 0.7,
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 12,
    },
    divider: {
        flex: 1,
        height: 1,
        backgroundColor: '#E2E8F0',
    },
    dividerText: {
        paddingHorizontal: 16,
        color: '#94A3B8',
        fontSize: 13,
    },
    socialContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 14,
    },
    socialButton: {
        width: 58,
        height: 58,
        borderRadius: 18,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 35,
    },
    footerText: {
        color: '#64748B',
        fontSize: 14,
    },
    signUpText: {
        color: '#3B82F6',
        fontWeight: '700',
        fontSize: 14,
    },
});