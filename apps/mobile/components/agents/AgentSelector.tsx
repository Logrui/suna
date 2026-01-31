import { Icon } from '@/components/ui/icon';
import { ChevronDown } from 'lucide-react-native';
import * as React from 'react';
import { Platform, TouchableOpacity, View } from 'react-native';
import { useAgent } from '@/contexts/AgentContext';
import { AgentAvatar } from './AgentAvatar';
import { Text } from '@/components/ui/text';

// Android hit slop for better touch targets
const ANDROID_HIT_SLOP = Platform.OS === 'android' ? { top: 10, bottom: 10, left: 10, right: 10 } : undefined;

interface AgentSelectorProps {
  onPress?: () => void;
  compact?: boolean;
}

/**
 * AgentSelector - Displays the selected worker (agent) trigger
 *
 * Aligned with web frontend: shows worker name and avatar.
 * Tapping opens the agent drawer for worker/model configuration.
 */
export function AgentSelector({ onPress, compact = true }: AgentSelectorProps) {
  const { agents, selectedAgentId, isLoading, hasInitialized } = useAgent();

  const selectedAgent = React.useMemo(() =>
    agents.find(a => a.agent_id === selectedAgentId),
    [agents, selectedAgentId]
  );

  // Show loading state until initialization is complete
  if (isLoading || !hasInitialized) {
    return (
      <View className="flex-row items-center gap-1.5 rounded-full px-3.5 py-2">
        <View className="w-16 h-4 bg-muted rounded animate-pulse" />
      </View>
    );
  }

  const workerName = selectedAgent?.name || 'Suna';

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: compact ? 6 : 10,
        paddingVertical: 4,
        borderRadius: 20,
      }}
      hitSlop={ANDROID_HIT_SLOP}
      activeOpacity={0.7}
    >
      <AgentAvatar agent={selectedAgent} size={compact ? 24 : 28} />
      {!compact && (
        <Text
          className="text-foreground/80 font-medium"
          style={{ fontSize: 15, fontFamily: 'Roobert-Medium' }}
          numberOfLines={1}
        >
          {workerName}
        </Text>
      )}
      <Icon
        as={ChevronDown}
        size={compact ? 12 : 14}
        className="text-foreground/40"
        strokeWidth={2.5}
      />
    </TouchableOpacity>
  );
}
