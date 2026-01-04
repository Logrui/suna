import { extractToolData } from '../utils';

export interface CodeExecutionData {
  runtime: string | null;
  code: string | null;
  session: number | null;
  output: string | null;
  status: any | null;
  success?: boolean;
  timestamp?: string;
}

const parseContent = (content: any): any => {
  if (typeof content === 'string') {
    try {
      return JSON.parse(content);
    } catch (e) {
      return content;
    }
  }
  return content;
};

const extractFromNewFormat = (content: any): CodeExecutionData => {
  const parsedContent = parseContent(content);

  if (!parsedContent || typeof parsedContent !== 'object') {
    return {
      runtime: null,
      code: null,
      session: null,
      output: null,
      status: null,
      success: undefined,
      timestamp: undefined
    };
  }

  if ('tool_execution' in parsedContent && typeof parsedContent.tool_execution === 'object') {
    const toolExecution = parsedContent.tool_execution;
    const args = toolExecution.arguments || {};

    let output = toolExecution.result?.output;
    let status = toolExecution.result?.status;

    // Parse output if it's a string
    if (typeof output === 'string') {
      try {
        const parsed = JSON.parse(output);
        if (parsed && typeof parsed === 'object') {
          output = parsed.output || parsed.message || parsed.content || output;
          status = parsed.status || status;
        }
      } catch (e) {
        // Keep as plain text
      }
    }

    const extractedData = {
      runtime: args.runtime || null,
      code: args.code || null,
      session: args.session !== undefined ? args.session : null,
      output: output || null,
      status: status || null,
      success: toolExecution.result?.success,
      timestamp: toolExecution.execution_details?.timestamp
    };

    return extractedData;
  }

  if ('role' in parsedContent && 'content' in parsedContent) {
    return extractFromNewFormat(parsedContent.content);
  }

  return {
    runtime: null,
    code: null,
    session: null,
    output: null,
    status: null,
    success: undefined,
    timestamp: undefined
  };
};

const extractFromLegacyFormat = (content: any): Omit<CodeExecutionData, 'success' | 'timestamp'> => {
  const toolData = extractToolData(content);

  if (toolData.toolResult) {
    const args = toolData.arguments || {};

    return {
      runtime: args.runtime || null,
      code: args.code || null,
      session: args.session !== undefined ? args.session : null,
      output: toolData.toolResult.toolOutput || null,
      status: null
    };
  }

  return {
    runtime: null,
    code: null,
    session: null,
    output: null,
    status: null
  };
};

export function extractCodeExecutionData(
  assistantContent: any,
  toolContent: any,
  isSuccess: boolean,
  toolTimestamp?: string,
  assistantTimestamp?: string
): {
  runtime: string | null;
  code: string | null;
  session: number | null;
  output: string | null;
  status: any | null;
  actualIsSuccess: boolean;
  actualToolTimestamp?: string;
  actualAssistantTimestamp?: string;
} {
  let runtime: string | null = null;
  let code: string | null = null;
  let session: number | null = null;
  let output: string | null = null;
  let status: any | null = null;
  let actualIsSuccess = isSuccess;
  let actualToolTimestamp = toolTimestamp;
  let actualAssistantTimestamp = assistantTimestamp;

  const assistantNewFormat = extractFromNewFormat(assistantContent);
  const toolNewFormat = extractFromNewFormat(toolContent);

  if (assistantNewFormat.runtime || assistantNewFormat.output) {
    runtime = assistantNewFormat.runtime;
    code = assistantNewFormat.code;
    session = assistantNewFormat.session;
    output = assistantNewFormat.output;
    status = assistantNewFormat.status;
    if (assistantNewFormat.success !== undefined) {
      actualIsSuccess = assistantNewFormat.success;
    }
    if (assistantNewFormat.timestamp) {
      actualAssistantTimestamp = assistantNewFormat.timestamp;
    }
  } else if (toolNewFormat.runtime || toolNewFormat.output) {
    runtime = toolNewFormat.runtime;
    code = toolNewFormat.code;
    session = toolNewFormat.session;
    output = toolNewFormat.output;
    status = toolNewFormat.status;
    if (toolNewFormat.success !== undefined) {
      actualIsSuccess = toolNewFormat.success;
    }
    if (toolNewFormat.timestamp) {
      actualToolTimestamp = toolNewFormat.timestamp;
    }
  } else {
    const assistantLegacy = extractFromLegacyFormat(assistantContent);
    const toolLegacy = extractFromLegacyFormat(toolContent);

    runtime = assistantLegacy.runtime || toolLegacy.runtime;
    code = assistantLegacy.code || toolLegacy.code;
    session = assistantLegacy.session !== null ? assistantLegacy.session : toolLegacy.session;
    output = assistantLegacy.output || toolLegacy.output;
    status = assistantLegacy.status || toolLegacy.status;
  }

  return {
    runtime,
    code,
    session,
    output,
    status,
    actualIsSuccess,
    actualToolTimestamp,
    actualAssistantTimestamp
  };
}

export function getRuntimeIcon(runtime: string | null): string {
  switch (runtime?.toLowerCase()) {
    case 'python':
      return '🐍';
    case 'nodejs':
      return '📗';
    case 'terminal':
      return '💻';
    case 'output':
      return '📄';
    case 'reset':
      return '🔄';
    default:
      return '⚙️';
  }
}

export function getRuntimeColor(runtime: string | null): {
  bg: string;
  text: string;
  border: string;
} {
  switch (runtime?.toLowerCase()) {
    case 'python':
      return {
        bg: 'bg-gradient-to-br from-blue-500/20 to-blue-600/10',
        text: 'text-blue-500 dark:text-blue-400',
        border: 'border-blue-500/20'
      };
    case 'nodejs':
      return {
        bg: 'bg-gradient-to-br from-green-500/20 to-green-600/10',
        text: 'text-green-500 dark:text-green-400',
        border: 'border-green-500/20'
      };
    case 'terminal':
      return {
        bg: 'bg-gradient-to-br from-purple-500/20 to-purple-600/10',
        text: 'text-purple-500 dark:text-purple-400',
        border: 'border-purple-500/20'
      };
    case 'output':
      return {
        bg: 'bg-gradient-to-br from-orange-500/20 to-orange-600/10',
        text: 'text-orange-500 dark:text-orange-400',
        border: 'border-orange-500/20'
      };
    case 'reset':
      return {
        bg: 'bg-gradient-to-br from-red-500/20 to-red-600/10',
        text: 'text-red-500 dark:text-red-400',
        border: 'border-red-500/20'
      };
    default:
      return {
        bg: 'bg-gradient-to-br from-gray-500/20 to-gray-600/10',
        text: 'text-gray-500 dark:text-gray-400',
        border: 'border-gray-500/20'
      };
  }
}
