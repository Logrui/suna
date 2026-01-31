/**
 * SelectableListItem Component - Unified selectable list item
 *
 * A single, reusable list item component for all entity types:
 * - Agents/Workers
 * - Models
 * - Threads/Chats
 * - Triggers
 * - Any selectable entity
 */

import React, { ReactNode } from 'react';
import { View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { Text } from '@/components/ui/text';
import { Check, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { TouchableOpacity as BottomSheetTouchable } from '@gorhom/bottom-sheet';

export interface SelectableListItemProps {
  /** Avatar component (AgentAvatar, ModelAvatar, etc.) */
  avatar: ReactNode;

  /** Primary title (can be string or ReactNode for custom styling) */
  title: string | ReactNode;

  /** Optional subtitle */
  subtitle?: string;

  /** Optional metadata (date, status, etc.) */
  meta?: string;

  /** Whether item is selected */
  isSelected?: boolean;

  /** Show chevron for navigation (default: false) */
  showChevron?: boolean;

  /** Hide all selection indicators (no chevron, no checkmark) */
  hideIndicator?: boolean;

  /** Press handler */
  onPress?: () => void;

  /** Accessibility label */
  accessibilityLabel?: string;

  /** Custom selection background */
  selectionBackground?: string;

  /** Right icon (e.g., Crown for premium) */
  rightIcon?: ReactNode;

  /** Whether item is active */
  isActive?: boolean;
}

export function SelectableListItem({
  avatar,
  title,
  subtitle,
  meta,
  isSelected = false,
  showChevron = false,
  hideIndicator = false,
  isActive = true,
  onPress,
  accessibilityLabel,
  rightIcon,
}: SelectableListItemProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const textColor = isDark ? '#F8F8F8' : '#121215';
  const mutedColor = isDark ? 'rgba(248, 248, 248, 0.5)' : 'rgba(18, 18, 21, 0.5)';

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  return (
    <BottomSheetTouchable
      onPress={handlePress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
        paddingHorizontal: 4,
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || `Select ${title}`}
    >
      {/* Left: Avatar + Text */}
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        {/* Avatar */}
        <View style={{ opacity: isActive ? 1 : 0.3, marginRight: 10 }}>{avatar}</View>

        {/* Text Content */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {typeof title === 'string' ? (
              <Text
                style={{
                  color: textColor,
                  fontSize: 15,
                  fontFamily: 'Roobert-Medium',
                }}
                numberOfLines={1}
              >
                {title}
              </Text>
            ) : (
              title
            )}

            {/* Inactive badge */}
            {!isActive && (
              <Text
                style={{
                  color: mutedColor,
                  fontSize: 12,
                  fontFamily: 'Roobert',
                  marginLeft: 8,
                }}
              >
                Inactive
              </Text>
            )}
          </View>
          {subtitle && (
            <Text
              style={{
                color: mutedColor,
                fontSize: 12,
                fontFamily: 'Roobert',
                marginTop: 2,
              }}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          )}
        </View>

        {/* Optional Meta */}
        {meta && (
          <Text
            style={{
              color: mutedColor,
              fontSize: 12,
              fontFamily: 'Roobert-Medium',
              marginLeft: 8,
            }}
          >
            {meta}
          </Text>
        )}
      </View>

      {/* Right: Selection Indicator or Right Icon */}
      {rightIcon && <View style={{ marginRight: 8 }}>{rightIcon}</View>}
      {!hideIndicator && (
        <View style={{ width: 24, alignItems: 'center', justifyContent: 'center' }}>
          {showChevron ? (
            <ChevronRight size={18} color={mutedColor} />
          ) : isSelected ? (
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: textColor,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Check size={12} color={isDark ? '#121215' : '#F8F8F8'} strokeWidth={3} />
            </View>
          ) : null}
        </View>
      )}
    </BottomSheetTouchable>
  );
}
