import { ToolCallData, ToolResultData } from '../types';

export interface SSHData {
  command?: string;
  output?: string;
  exitCode?: number;
  connectionId?: string;
  host?: string;
  username?: string;
  target?: string;
  cwd?: string;
  action: 'connect' | 'execute' | 'disconnect' | 'unknown';
  success: boolean;
  timestamp?: string;
}

export function extractSSHData(
  toolCall: ToolCallData | undefined,
  toolResult?: ToolResultData,
  isSuccess: boolean = true,
  toolTimestamp?: string,
  assistantTimestamp?: string
): SSHData {
  const functionName = toolCall?.function_name;
  const args = toolCall?.arguments || {};
  let output = toolResult?.output;

  // Default values
  let command = args.command;
  let connectionId = args.connection_id;
  let host = args.host;
  let username = args.username;
  let exitCode = 0;
  let cwd = '';
  let target = '';

  // Parse output if it's JSON
  if (output && typeof output === 'string') {
    try {
        const parsed = JSON.parse(output);
        if (parsed.output !== undefined) output = parsed.output;
        if (parsed.exit_code !== undefined) exitCode = parsed.exit_code;
        if (parsed.cwd !== undefined) cwd = parsed.cwd;
        if (parsed.connection_id !== undefined) connectionId = parsed.connection_id;
        if (parsed.target !== undefined) target = parsed.target;
    } catch {
        // Not JSON, keep as string
    }
  }

  let action: SSHData['action'] = 'unknown';
  if (functionName === 'ssh_connect') action = 'connect';
  else if (functionName === 'ssh_execute') action = 'execute';
  else if (functionName === 'ssh_disconnect') action = 'disconnect';

  if (action === 'connect' && host && username) {
      target = `${username}@${host}`;
  }

  return {
    command,
    output,
    exitCode,
    connectionId,
    host,
    username,
    target,
    cwd,
    action,
    success: isSuccess,
    timestamp: toolTimestamp || assistantTimestamp,
  };
}
