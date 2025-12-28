/**
 * useAIStepValidation Hook
 *
 * Validates AI step node configuration.
 * Checks required fields, formats, and variable references.
 *
 * Feature: Advanced Visual Workflow Builder
 * Maps to: T045 (Phase 4: User Story 2)
 */

import { useMemo } from 'react';
import type { AIStepNodeData } from '@/components/workflows/types';

export interface ValidationError {
  field: string;
  message: string;
}

const VALID_MODELS = [
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
  'gpt-4o',
  'gpt-4o-mini',
  'gemini-2.0-flash-exp',
];

const VARIABLE_PATTERN = /@([a-zA-Z_][a-zA-Z0-9_.]*)/g;
const OUTPUT_VARIABLE_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export function useAIStepValidation(
  config: AIStepNodeData['config'],
  availableVariables?: string[],
): {
  isValid: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
} {
  return useMemo(() => {
    const errors: Record<string, string> = {};
    const warnings: Record<string, string> = {};

    // Required fields validation
    if (!config.prompt || config.prompt.trim().length === 0) {
      errors.prompt = 'Prompt is required';
    } else if (config.prompt.length > 10000) {
      errors.prompt = 'Prompt is too long (max 10,000 characters)';
    }

    if (!config.model || config.model.trim().length === 0) {
      errors.model = 'Model selection is required';
    } else if (!VALID_MODELS.includes(config.model)) {
      errors.model = `Invalid model: ${config.model}`;
    }

    if (!config.tools || config.tools.length === 0) {
      errors.tools = 'At least one tool must be selected';
    } else if (!Array.isArray(config.tools)) {
      errors.tools = 'Tools must be an array';
    }

    // Temperature validation
    if (config.temperature !== undefined) {
      if (typeof config.temperature !== 'number') {
        errors.temperature = 'Temperature must be a number';
      } else if (config.temperature < 0 || config.temperature > 2) {
        errors.temperature = 'Temperature must be between 0 and 2';
      }
    }

    // Max tokens validation
    if (config.max_tokens !== undefined) {
      if (typeof config.max_tokens !== 'number') {
        errors.max_tokens = 'Max tokens must be a number';
      } else if (config.max_tokens < 1 || config.max_tokens > 200000) {
        errors.max_tokens = 'Max tokens must be between 1 and 200,000';
      }
    }

    // Output variable validation
    if (config.output_variable) {
      if (config.output_variable.trim().length === 0) {
        errors.output_variable = 'Output variable name cannot be empty';
      } else if (!OUTPUT_VARIABLE_PATTERN.test(config.output_variable)) {
        errors.output_variable =
          'Output variable must start with letter or underscore, followed by letters, numbers, or underscores';
      } else if (config.output_variable.length > 100) {
        errors.output_variable = 'Output variable name is too long (max 100 characters)';
      }
    }

    // Variable reference validation
    if (config.prompt) {
      const matches = [...config.prompt.matchAll(VARIABLE_PATTERN)];
      const variables = availableVariables || [];

      matches.forEach((match) => {
        const varName = match[1];
        if (!variables.includes(varName)) {
          warnings[`variable_${varName}`] = `Variable @${varName} is not defined`;
        }
      });
    }

    const isValid = Object.keys(errors).length === 0;

    return {
      isValid,
      errors,
      warnings,
    };
  }, [config, availableVariables]);
}

export default useAIStepValidation;
