import React from 'react';
import Image from 'next/image';
import { Cpu } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ModelProvider =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'xai'
  | 'moonshotai'
  | 'bedrock'
  | 'openrouter'
  | 'lm_studio'
  | 'ollama';

/**
 * Get the provider from a model ID
 * 
 * Supports multiple formats:
 * - Prefixed: "lm_studio:hermes-2-pro" or "ollama:neural-chat"
 * - Contained: "model-lm_studio" or "ollama-model"
 * - Fallback: "provider/model" format
 */
export function getModelProvider(modelId: string): ModelProvider {
  const lowerModelId = modelId.toLowerCase();
  
  // Debug logging
  if (lowerModelId.includes('ollama') || lowerModelId.includes('lm_studio')) {
    console.log('[getModelProvider] Detecting local model:', modelId, '→ lowercase:', lowerModelId);
  }
  
  // Check for prefixed format (highest priority)
  if (lowerModelId.startsWith('lm_studio:') || lowerModelId.startsWith('lm_studio-')) {
    console.log('[getModelProvider] Matched lm_studio prefix:', modelId);
    return 'lm_studio';
  }
  if (lowerModelId.startsWith('ollama:') || lowerModelId.startsWith('ollama-')) {
    console.log('[getModelProvider] Matched ollama prefix:', modelId);
    return 'ollama';
  }
  
  // Check for contained strings
  if (lowerModelId.includes('lm_studio')) {
    return 'lm_studio';
  }
  if (lowerModelId.includes('ollama')) {
    return 'ollama';
  }
  if (lowerModelId.includes('anthropic') || lowerModelId.includes('claude')) {
    return 'anthropic';
  }
  if (lowerModelId.includes('openai') || lowerModelId.includes('gpt')) {
    return 'openai';
  }
  if (lowerModelId.includes('google') || lowerModelId.includes('gemini')) {
    return 'google';
  }
  if (lowerModelId.includes('xai') || lowerModelId.includes('grok')) {
    return 'xai';
  }
  if (lowerModelId.includes('moonshotai') || lowerModelId.includes('kimi')) {
    return 'moonshotai';
  }
  if (lowerModelId.includes('bedrock')) {
    return 'bedrock';
  }
  if (lowerModelId.includes('openrouter')) {
    return 'openrouter';
  }

  // Fallback: try to extract provider from "provider/model" format
  const parts = modelId.split('/');
  if (parts.length > 1) {
    const provider = parts[0].toLowerCase();
    if (['openai', 'anthropic', 'google', 'xai', 'moonshotai', 'bedrock', 'openrouter', 'lm_studio', 'ollama'].includes(provider)) {
      return provider as ModelProvider;
    }
  }

  return 'openai'; // Default fallback
}

/**
 * Component to render the model provider icon
 */
interface ModelProviderIconProps {
  modelId: string;
  size?: number;
  className?: string;
  variant?: 'default' | 'compact';
}

export function ModelProviderIcon({
  modelId,
  size = 24, // Default to 24px for better visibility
  className = '',
  variant = 'default'
}: ModelProviderIconProps) {
  const provider = getModelProvider(modelId);

  const iconMap: Record<ModelProvider, string> = {
    anthropic: '/images/models/Anthropic.svg',
    openai: '/images/models/OAI.svg',
    google: '/images/models/Gemini.svg',
    xai: '/images/models/Grok.svg',
    moonshotai: '/images/models/Moonshot.svg',
    bedrock: '/images/models/Anthropic.svg', // Bedrock uses Anthropic models primarily
    openrouter: '/images/models/OAI.svg', // Default to OpenAI icon for OpenRouter
    lm_studio: '/images/models/lmstudio.svg',
    ollama: '/images/models/ollama.svg',
  };

  const iconSrc = iconMap[provider];

  // Calculate responsive border radius - proportional to size (matching AgentAvatar)
  const borderRadiusStyle = {
    borderRadius: `${Math.min(size * 0.25, 16)}px` // 25% of size, max 16px
  };

  if (!iconSrc) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-card border flex-shrink-0",
          className
        )}
        style={{ width: size, height: size, ...borderRadiusStyle }}
      >
        <Cpu size={size * 0.6} className="text-muted-foreground dark:text-zinc-200" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center bg-card border flex-shrink-0",
        className
      )}
      style={{ width: size, height: size, ...borderRadiusStyle }}
    >
      <Image
        src={iconSrc}
        alt={`${provider} icon`}
        width={size * 0.6} // Match agent avatar spacing
        height={size * 0.6}
        className="object-contain dark:brightness-0 dark:invert"
        style={{ width: size * 0.6, height: size * 0.6 }}
      />
    </div>
  );
}

/**
 * Get the provider display name
 */
export function getModelProviderName(modelId: string): string {
  const provider = getModelProvider(modelId);

  const nameMap: Record<ModelProvider, string> = {
    anthropic: 'Anthropic',
    openai: 'OpenAI',
    google: 'Google',
    xai: 'xAI',
    moonshotai: 'Moonshot AI',
    bedrock: 'AWS Bedrock',
    openrouter: 'OpenRouter',
    lm_studio: 'LM Studio',
    ollama: 'Ollama',
  };

  return nameMap[provider] || 'Unknown';
}
