'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useSlashCommands } from '@/hooks/useSlashCommands';
import { useKnowledgeFolders } from '@/hooks/react-query/knowledge-base/use-folders';
import { SLASH_COMMANDS_FOLDER_NAME } from '@/components/slash-commands/types';
import { SlashCommandAutocomplete } from '@/components/slash-commands/slash-commands';

export interface SlashCommandsProps {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  isControlled: boolean;
  controlledOnChange?: (value: string) => void;
  setLocalValue: (value: string) => void;
}

/**
 * Hook to manage slash commands state and handlers
 * Now manages its own internal state - no need to pass state from parent
 */
export const useSlashCommandsLogic = (props: SlashCommandsProps) => {
  const {
    textareaRef,
    isControlled,
    controlledOnChange,
    setLocalValue,
  } = props;

  // Internal state management
  const [showSlashCommands, setShowSlashCommands] = useState(false);
  const [slashCommandFilter, setSlashCommandFilter] = useState('');
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [activeSlashCommand, setActiveSlashCommand] = useState<any>(null);

  // Fetch slash commands
  const { data: slashCommands = [] } = useSlashCommands();

  // Fetch knowledge base folders to get prompts folder for creating new commands
  const { folders } = useKnowledgeFolders();
  const promptsFolder = useMemo(() => folders.find(f => f.name === SLASH_COMMANDS_FOLDER_NAME), [folders]);

  // Filter slash commands based on current input
  const filteredSlashCommands = useMemo(() => {
    if (!slashCommandFilter) return slashCommands;
    return slashCommands.filter(cmd =>
      cmd.name.toLowerCase().includes(slashCommandFilter.toLowerCase())
    );
  }, [slashCommands, slashCommandFilter]);

  /**
   * Handle text input changes and detect slash commands
   */
  const handleChange = useCallback((newValue: string) => {
    // Clear active command if user removes it or changes it
    if (activeSlashCommand && !newValue.startsWith('/' + activeSlashCommand.name)) {
      setActiveSlashCommand(null);
    }

    // Detect slash command
    if (newValue.startsWith('/') && !newValue.includes('\n')) {
      const parts = newValue.slice(1).split(' ');
      const commandFilter = parts[0] || '';
      setSlashCommandFilter(commandFilter);
      setShowSlashCommands(true);
      setSelectedCommandIndex(0);
    } else {
      setShowSlashCommands(false);
      setSlashCommandFilter('');
    }
  }, [activeSlashCommand]);

  /**
   * Handle slash command selection from autocomplete
   */
  const handleSlashCommandSelect = useCallback((command: any) => {
    const newValue = '/' + command.name + ' ';
    setLocalValue(newValue);
    setShowSlashCommands(false);
    setSlashCommandFilter('');
    setActiveSlashCommand(command); // Store the command for later injection

    // Notify parent in controlled mode
    if (isControlled && controlledOnChange) {
      controlledOnChange(newValue);
    }

    // Focus textarea
    textareaRef.current?.focus();
  }, [setLocalValue, isControlled, controlledOnChange, textareaRef]);

  /**
   * Handle keyboard navigation in slash commands autocomplete
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle slash command autocomplete navigation
    if (showSlashCommands && filteredSlashCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedCommandIndex(prev =>
          prev < filteredSlashCommands.length - 1 ? prev + 1 : prev
        );
        return;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedCommandIndex(prev => prev > 0 ? prev - 1 : 0);
        return;
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        // Select the highlighted command
        const selectedCommand = filteredSlashCommands[selectedCommandIndex];
        if (selectedCommand) {
          handleSlashCommandSelect(selectedCommand);
        }
        return;
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowSlashCommands(false);
        setSlashCommandFilter('');
        return;
      }
    }
  }, [showSlashCommands, selectedCommandIndex, filteredSlashCommands, handleSlashCommandSelect]);

  /**
   * Handle closing slash commands autocomplete
   */
  const handleSlashCommandClose = useCallback(() => {
    setShowSlashCommands(false);
    setSlashCommandFilter('');
  }, []);

  /**
   * Process active slash command and inject prompt into message
   */
  const processActiveSlashCommand = useCallback((message: string): string => {
    if (!activeSlashCommand || !message.startsWith('/' + activeSlashCommand.name)) {
      return message;
    }

    // Extract the user's text after the command
    const commandPattern = new RegExp(`^\\/${activeSlashCommand.name}\\s*`);
    const userText = message.replace(commandPattern, '').trim();

    // Always inject the full prompt content
    // We treat all commands the same way now - injecting their content directly
    return userText
      ? `${activeSlashCommand.prompt}\n\n${userText}`
      : activeSlashCommand.prompt;
  }, [activeSlashCommand]);

  /**
   * Clear active slash command
   */
  const clearActiveSlashCommand = useCallback(() => {
    setActiveSlashCommand(null);
  }, []);

  /**
   * Render highlighted overlay for active slash command
   */
  const renderHighlightedOverlay = useCallback((value: string) => {
    if (!activeSlashCommand || !value.startsWith('/' + activeSlashCommand.name)) {
      return null;
    }

    return (
      <div
        className="absolute inset-0 pointer-events-none px-0.5 pb-6 pt-4 whitespace-pre-wrap break-words"
        style={{
          font: 'inherit',
          lineHeight: 'inherit',
          wordBreak: 'break-word',
          overflowWrap: 'break-word',
        }}
      >
        <span className="bg-primary/20 text-transparent rounded px-1 font-medium">
          /{activeSlashCommand.name}
        </span>
      </div>
    );
  }, [activeSlashCommand]);

  /**
   * Get caret class for textarea when slash command is active
   */
  const getCaretClass = useCallback((value: string) => {
    return activeSlashCommand && value.startsWith('/' + activeSlashCommand.name) ? 'caret-primary' : '';
  }, [activeSlashCommand]);

  return {
    // State
    showSlashCommands,
    selectedCommandIndex,
    activeSlashCommand,

    // Data
    filteredSlashCommands,
    promptsFolder,

    // Handlers
    handleChange,
    handleKeyDown,
    handleSlashCommandSelect,
    handleSlashCommandClose,
    processActiveSlashCommand,
    clearActiveSlashCommand,

    // Render helpers
    renderHighlightedOverlay,
    getCaretClass,
  };
};

/**
 * Slash Commands UI Component
 */
export interface SlashCommandsUIProps {
  isOpen: boolean;
  commands: any[];
  selectedIndex: number;
  onSelect: (command: any) => void;
  onClose: () => void;
  promptsFolder: any;
  onCommandCreated?: () => void;
}

export const SlashCommandsUI: React.FC<SlashCommandsUIProps> = ({
  isOpen,
  commands,
  selectedIndex,
  onSelect,
  onClose,
  promptsFolder,
  onCommandCreated,
}) => {
  return (
    <SlashCommandAutocomplete
      isOpen={isOpen}
      commands={commands}
      selectedIndex={selectedIndex}
      onSelect={onSelect}
      onClose={onClose}
      promptsFolder={promptsFolder}
      onCommandCreated={onCommandCreated}
    />
  );
};
