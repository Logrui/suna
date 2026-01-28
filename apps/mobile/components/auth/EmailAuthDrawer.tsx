import * as React from 'react';
import { View, TextInput, Keyboard, Platform } from 'react-native';
import { BottomSheetModal, BottomSheetScrollView, BottomSheetBackdrop, TouchableOpacity as BottomSheetTouchable } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowRight, X, Check } from 'lucide-react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts';
import { cn } from '@/lib/utils';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { useToast } from '@/components/ui/toast-provider';

export interface EmailAuthDrawerRef {
  open: () => void;
  close: () => void;
}

/**
 * EmailAuthDrawer Component
 * 
 * Simple bottom drawer for email/magic link authentication.
 * Controlled via ref - no global store needed.
 */
export const EmailAuthDrawer = React.forwardRef<EmailAuthDrawerRef, {
  onSuccess?: () => void;
}>(({ onSuccess }, ref) => {
  const bottomSheetRef = React.useRef<BottomSheetModal>(null);
  const { t } = useLanguage();
  const { colorScheme } = useColorScheme();
  const { signIn, signUp, resetPassword, isLoading } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = React.useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [acceptedTerms, setAcceptedTerms] = React.useState(false);
  const emailInputRef = React.useRef<TextInput | null>(null);

  const isDark = colorScheme === 'dark';

  // Expose open/close methods via ref
  React.useImperativeHandle(ref, () => ({
    open: () => {
      bottomSheetRef.current?.present();
      setTimeout(() => {
        emailInputRef.current?.focus();
      }, 400);
    },
    close: () => {
      bottomSheetRef.current?.dismiss();
    },
  }));

  // Dynamic snap point based on state - always 90% height
  const snapPoints = React.useMemo(() => {
    return ['90%'];
  }, []);

  const renderBackdrop = React.useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior="close"
        onPress={() => Keyboard.dismiss()}
      />
    ),
    []
  );

  const handleAuth = async () => {
    if (!email || !email.includes('@')) {
      toast.error(t('auth.validationErrors.emailRequired'));
      return;
    }

    if (!password || password.length < 6) {
      toast.error(t('auth.passwordTooShort') || 'Password must be at least 6 characters');
      return;
    }

    if (mode === 'signup') {
      if (password !== confirmPassword) {
        toast.error(t('auth.passwordsDontMatch') || 'Passwords do not match');
        return;
      }

      if (!acceptedTerms) {
        toast.error(t('auth.termsRequired'));
        return;
      }
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    let result;
    if (mode === 'signin') {
      result = await signIn({ email, password });
    } else {
      result = await signUp({ email, password });
    }

    if (result.success) {
      if (mode === 'signup' && !result.data?.session) {
        // Verification email might be required
        toast.success(t('auth.verificationEmailSent') + ' ' + email);
        bottomSheetRef.current?.dismiss();
      } else {
        // Logged in!
        bottomSheetRef.current?.dismiss();
        onSuccess?.();
      }
    } else {
      toast.error(result.error?.message || (mode === 'signin' ? t('auth.signInFailed') : t('auth.signUpFailed')));
    }
  };

  const handleForgotPassword = async () => {
    if (!email || !email.includes('@')) {
      toast.error(t('auth.validationErrors.emailRequired'));
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = await resetPassword({ email });

    if (result.success) {
      toast.success(t('auth.resetLinkSent') + ' ' + email);
    } else {
      toast.error(result.error?.message || t('auth.resetFailed'));
    }
  };

  const handleDismiss = () => {
    Keyboard.dismiss();
    // Reset state for next open
    setMode('signin');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setAcceptedTerms(false);
  };

  const handleSheetChange = React.useCallback((index: number) => {
    if (index === -1) {
      Keyboard.dismiss();
    }
  }, []);

  const isValidEmail = email.includes('@') && email.length > 3;

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      index={0}
      snapPoints={snapPoints}
      onChange={handleSheetChange}
      backdropComponent={renderBackdrop}
      enablePanDownToClose
      onDismiss={handleDismiss}
      enableDynamicSizing={false}
      animateOnMount={true}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      backgroundStyle={{
        backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
      }}
      handleIndicatorStyle={{
        backgroundColor: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
      }}
    >
      <BottomSheetScrollView
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 20) + 16,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View className="flex-1">
          <View className="flex-row items-center justify-between mb-6">
            <View className="flex-row bg-muted/20 dark:bg-muted/10 rounded-full p-1">
              <BottomSheetTouchable
                onPress={() => {
                  setMode('signin');
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                className={cn(
                  "px-6 py-2 rounded-full",
                  mode === 'signin' ? "bg-background shadow-sm" : ""
                )}
              >
                <Text className={cn(
                  "text-sm font-roobert-medium",
                  mode === 'signin' ? "text-foreground" : "text-muted-foreground"
                )}>
                  {t('auth.signIn')}
                </Text>
              </BottomSheetTouchable>
              <BottomSheetTouchable
                onPress={() => {
                  setMode('signup');
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                className={cn(
                  "px-6 py-2 rounded-full",
                  mode === 'signup' ? "bg-background shadow-sm" : ""
                )}
              >
                <Text className={cn(
                  "text-sm font-roobert-medium",
                  mode === 'signup' ? "text-foreground" : "text-muted-foreground"
                )}>
                  {t('auth.signUp')}
                </Text>
              </BottomSheetTouchable>
            </View>

            <BottomSheetTouchable
              onPress={() => bottomSheetRef.current?.dismiss()}
            >
              <Icon as={X} size={24} className="text-muted-foreground" />
            </BottomSheetTouchable>
          </View>

          <View className="gap-6">
            <View className="gap-2">
              <Text className="text-[28px] font-roobert-semibold text-foreground leading-tight">
                {mode === 'signin' ? t('auth.signIn') : t('auth.createAccount')}
              </Text>
              <Text className="text-[15px] font-roobert text-muted-foreground">
                {mode === 'signin'
                  ? t('auth.enterEmailPassword')
                  : t('auth.enterEmailAddress')}
              </Text>
            </View>

            <View className="gap-4">
              <Input
                ref={emailInputRef}
                value={email}
                onChangeText={(text) => setEmail(text.trim().toLowerCase())}
                placeholder={t('auth.emailPlaceholder')}
                keyboardType="email-address"
                returnKeyType="next"
                size="lg"
                wrapperClassName="bg-muted/10 dark:bg-muted/30"
              />

              <View className="w-full">
                <Input
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t('auth.passwordPlaceholder')}
                  secureTextEntry={!showPassword}
                  returnKeyType={mode === 'signup' ? 'next' : 'go'}
                  onSubmitEditing={mode === 'signin' ? handleAuth : undefined}
                  size="lg"
                  wrapperClassName="bg-muted/10 dark:bg-muted/30"
                />
                <BottomSheetTouchable
                  onPress={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-[18px]"
                >
                  <MaterialCommunityIcons
                    name={showPassword ? "eye-off" : "eye"}
                    size={20}
                    color={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'}
                  />
                </BottomSheetTouchable>
              </View>

              {mode === 'signup' && (
                <Input
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder={t('auth.confirmPasswordPlaceholder')}
                  secureTextEntry={!showPassword}
                  returnKeyType="go"
                  onSubmitEditing={handleAuth}
                  size="lg"
                  wrapperClassName="bg-muted/10 dark:bg-muted/30"
                />
              )}
            </View>

            {mode === 'signin' && (
              <BottomSheetTouchable onPress={handleForgotPassword}>
                <Text className="text-sm font-roobert-medium text-primary text-right">
                  {t('auth.forgotPassword')}
                </Text>
              </BottomSheetTouchable>
            )}

            {mode === 'signup' && (
              <View className="flex-row items-start">
                <BottomSheetTouchable
                  onPress={() => {
                    setAcceptedTerms(!acceptedTerms);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={{ marginRight: 12, marginTop: 2 }}
                >
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: acceptedTerms ? (isDark ? '#FFFFFF' : '#000000') : isDark ? '#454444' : '#c2c2c2',
                      backgroundColor: acceptedTerms ? (isDark ? '#FFFFFF' : '#000000') : 'transparent',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    {acceptedTerms && (
                      <Icon as={Check} size={16} color={isDark ? '#000000' : '#FFFFFF'} />
                    )}
                  </View>
                </BottomSheetTouchable>

                <View className="flex-1 flex-row flex-wrap">
                  <Text className="text-[14px] font-roobert text-muted-foreground leading-5">
                    {t('auth.agreeTerms')}{' '}
                  </Text>
                  <BottomSheetTouchable onPress={async () => {
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    const baseUrl = process.env.EXPO_PUBLIC_FRONTEND_URL || 'https://kortix.railway.syhc.dev';
                    await WebBrowser.openBrowserAsync(`${baseUrl}/legal?tab=terms`, {
                      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
                      controlsColor: isDark ? '#FFFFFF' : '#000000',
                    });
                  }}>
                    <Text className="text-[14px] font-roobert text-foreground leading-5 underline">
                      {t('auth.userTerms')}
                    </Text>
                  </BottomSheetTouchable>
                  <Text className="text-[14px] font-roobert text-muted-foreground leading-5">
                    {' '}{t('auth.and')}{' '}
                  </Text>
                  <BottomSheetTouchable onPress={async () => {
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    const baseUrl = process.env.EXPO_PUBLIC_FRONTEND_URL || 'https://kortix.railway.syhc.dev';
                    await WebBrowser.openBrowserAsync(`${baseUrl}/legal?tab=privacy`, {
                      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
                      controlsColor: isDark ? '#FFFFFF' : '#000000',
                    });
                  }}>
                    <Text className="text-[14px] font-roobert text-foreground leading-5 underline">
                      {t('auth.privacyNotice')}
                    </Text>
                  </BottomSheetTouchable>
                </View>
              </View>
            )}

            <Button
              variant="default"
              size="lg"
              onPress={handleAuth}
              disabled={isLoading || !isValidEmail || (mode === 'signup' && !acceptedTerms)}
            >
              <Text className="text-[16px] font-roobert-medium text-primary-foreground">
                {isLoading
                  ? (mode === 'signin' ? t('auth.signingIn') : t('auth.creatingAccount'))
                  : (mode === 'signin' ? t('auth.signIn') : t('auth.createAccount'))}
              </Text>
              {!isLoading && (
                <Icon as={ArrowRight} size={16} className="text-primary-foreground" />
              )}
            </Button>
          </View>
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});

EmailAuthDrawer.displayName = 'EmailAuthDrawer';
