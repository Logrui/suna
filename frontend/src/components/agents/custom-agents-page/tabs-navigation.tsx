'use client';

import React from 'react';
import { Bot, ShoppingBag, FileText, Plus, Layers } from 'lucide-react';
import { FancyTabs, TabConfig } from '@/components/ui/fancy-tabs';

interface TabsNavigationProps {
  activeTab: string;
  onTabChange: (value: string) => void;
  onCreateAgent?: () => void;
}

const agentTabs: TabConfig[] = [
  {
    value: 'my-agents',
    icon: Bot,
    label: 'My Agents',
  },
  {
    value: 'sub-agents',
    icon: Layers,
    label: 'Subagents',
  },
]; 

export const TabsNavigation = ({ activeTab, onTabChange, onCreateAgent }: TabsNavigationProps) => {
  const tabs = React.useMemo(() => {
    if (onCreateAgent) {
      return [
        ...agentTabs,
        { value: 'create-agent', icon: Plus, label: 'Create Agent' }
      ];
    }
    return agentTabs;
  }, [onCreateAgent]);

  const handleTabSelection = (value: string) => {
    if (value === 'create-agent') {
      onCreateAgent?.();
    } else {
      onTabChange(value);
    }
  };

  return (
    <FancyTabs
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={handleTabSelection}
    />
);
}
