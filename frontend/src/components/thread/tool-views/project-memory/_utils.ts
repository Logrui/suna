export interface ProjectMemoryActionResult {
    memory_id?: string;
    content?: string;
    memory_type?: string;
    project_id?: string;
    message?: string;
    success?: boolean;
}

/**
 * Extract project memory data from structured metadata props.
 * NO CONTENT PARSING — uses toolCall.arguments and toolResult.output directly.
 */
export function extractProjectMemoryData(
    argumentsData?: Record<string, unknown>,
    outputData?: unknown
): ProjectMemoryActionResult | null {
    // Try output first (from toolResult.output)
    if (outputData) {
        if (typeof outputData === 'object' && outputData !== null) {
            const out = outputData as Record<string, unknown>;

            // Direct fields
            if (out.memory_id || out.content || out.message) {
                return out as ProjectMemoryActionResult;
            }

            // Nested output
            if (out.output && typeof out.output === 'object') {
                const nested = out.output as Record<string, unknown>;
                if (nested.memory_id || nested.content || nested.message) {
                    return nested as ProjectMemoryActionResult;
                }
            }
        }

        // String output (success message)
        if (typeof outputData === 'string') {
            return { message: outputData, success: true };
        }
    }

    // Fallback to arguments (from toolCall.arguments)
    if (argumentsData && typeof argumentsData === 'object') {
        return {
            content: argumentsData.content as string | undefined,
            memory_type: argumentsData.memory_type as string | undefined,
            memory_id: argumentsData.memory_id as string | undefined,
        };
    }

    return null;
}

/**
 * Determine if the tool call is a save or delete action based on function name.
 */
export function getMemoryActionType(
    functionName: string
): 'save' | 'delete' | 'unknown' {
    const name = functionName.replace(/_/g, '-').toLowerCase();
    if (name.includes('save')) return 'save';
    if (name.includes('delete')) return 'delete';
    return 'unknown';
}
