'use client';

import React from 'react';
import { BookOpen, Database, Plus, Zap } from 'lucide-react';
import { FancyTabs, TabConfig } from '@/components/ui/fancy-tabs';

interface KBTabsNavigationProps {
  activeTab: string;
  onTabChange: (value: string) => void;
  onAddDatabase?: () => void;
}

const kbTabs: TabConfig[] = [
  {
    value: 'knowledge-base',
    icon: BookOpen,
    label: 'Knowledge Base',
  },
  {
    value: 'prompts',
    icon: Zap,
    label: 'Prompts',
  },
  {
    value: 'databases',
    icon: Database,
    label: 'Databases',
  },
];

export const KBTabsNavigation = ({ activeTab, onTabChange, onAddDatabase }: KBTabsNavigationProps) => {
  const tabs = React.useMemo(() => {
    if (onAddDatabase) {
      return [
        ...kbTabs,
        { value: 'add-database', icon: Plus, label: 'Add New' }
      ];
    }
    return kbTabs;
  }, [onAddDatabase]);

  const handleTabSelection = (value: string) => {
    if (value === 'add-database') {
      onAddDatabase?.();
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
};
