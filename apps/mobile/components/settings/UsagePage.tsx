import * as React from 'react';
import { Pressable, View, ScrollView } from 'react-native';
import { SettingsHeader } from './SettingsHeader';
import * as Haptics from 'expo-haptics';
import { UsageContent } from './UsageContent';

interface UsagePageProps {
  visible: boolean;
  onClose: () => void;
}

export function UsagePage({ visible, onClose }: UsagePageProps) {
  const handleClose = React.useCallback(() => {
    console.log('🎯 Usage page closing');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  }, [onClose]);

  const handleThreadPress = React.useCallback((threadId: string, projectId: string | null) => {
    console.log('🎯 Thread pressed:', threadId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  if (!visible) return null;

  return (
    <View className="absolute inset-0 z-50">
      <Pressable
        onPress={handleClose}
        className="absolute inset-0 bg-black/50"
      />
      
      <View className="absolute top-0 left-0 right-0 bottom-0 bg-background">
        <ScrollView 
          className="flex-1" 
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
        >
          <SettingsHeader
            title="Usage"
            onClose={handleClose}
          />

          <UsageContent onThreadPress={handleThreadPress} />

          <View className="h-20" />
        </ScrollView>
      </View>
    </View>
  );
}

