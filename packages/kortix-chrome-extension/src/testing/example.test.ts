/**
 * Example tests for Kortix Chrome Extension
 * 
 * These examples show how to test the extension with the Kortix backend.
 */

import {
  MockBrowserExtension,
  TestScenarioBuilder,
  ExtensionTestRunner,
} from './test-utils';
import { Command } from '../types/index';

/**
 * Example 1: Basic command execution
 */
export async function exampleBasicCommandExecution() {
  console.log('\n=== Example 1: Basic Command Execution ===\n');

  const extension = new MockBrowserExtension();

  // Create a simple command
  const command: Command = {
    id: 'cmd-1',
    action: 'getPageInfo',
    timestamp: Date.now(),
  };

  // Execute command
  const result = await extension.executeCommand(command);

  console.log('Command:', command);
  console.log('Result:', result);
  console.log('Success:', result.success);
}

/**
 * Example 2: Email extraction workflow
 */
export async function exampleEmailExtraction() {
  console.log('\n=== Example 2: Email Extraction ===\n');

  const extension = new MockBrowserExtension();

  // Step 1: Navigate to page
  const navigateCmd: Command = {
    id: 'cmd-1',
    action: 'navigate',
    params: { url: 'https://example.com/contacts' },
    timestamp: Date.now(),
  };

  const navResult = await extension.executeCommand(navigateCmd);
  console.log('Navigated to:', navResult.data?.url);

  // Step 2: Extract emails
  const extractCmd: Command = {
    id: 'cmd-2',
    action: 'extractEmails',
    timestamp: Date.now(),
  };

  const extractResult = await extension.executeCommand(extractCmd);
  console.log('Emails found:', extractResult.data?.emails);
  console.log('Total:', extractResult.data?.count);
}

/**
 * Example 3: Multi-step scenario
 */
export async function exampleMultiStepScenario() {
  console.log('\n=== Example 3: Multi-Step Scenario ===\n');

  const extension = new MockBrowserExtension();
  const builder = new TestScenarioBuilder();

  // Define commands
  const commands: Command[] = [
    {
      id: 'step-1',
      action: 'navigate',
      params: { url: 'https://example.com' },
      timestamp: Date.now(),
    },
    {
      id: 'step-2',
      action: 'getPageInfo',
      timestamp: Date.now(),
    },
    {
      id: 'step-3',
      action: 'extractEmails',
      timestamp: Date.now(),
    },
  ];

  // Execute all commands
  const results = [];
  for (const cmd of commands) {
    const result = await extension.executeCommand(cmd);
    results.push(result);
    console.log(`Step ${cmd.id}: ${result.success ? 'Success' : 'Failed'}`);
  }

  // Print session status
  const status = extension.getSessionStatus();
  console.log('\nSession Status:');
  console.log('  Session ID:', status.sessionId);
  console.log('  Commands executed:', status.commandCount);
  console.log('  Extractions:', status.extractionCount);
}

/**
 * Example 4: Test runner
 */
export async function exampleTestRunner() {
  console.log('\n=== Example 4: Test Runner ===\n');

  const runner = new ExtensionTestRunner();

  // Run all tests
  const results = await runner.runAll();

  // Print results
  runner.printResults();

  // Get summary
  const summary = runner.getSummary();
  console.log('Success Rate:', summary.successRate.toFixed(1) + '%');
}

/**
 * Example 5: Error handling
 */
export async function exampleErrorHandling() {
  console.log('\n=== Example 5: Error Handling ===\n');

  const extension = new MockBrowserExtension();

  // Command with invalid action (will still succeed in mock)
  const command: Command = {
    id: 'cmd-error',
    action: 'unknownAction' as any,
    timestamp: Date.now(),
  };

  try {
    const result = await extension.executeCommand(command);

    if (result.success) {
      console.log('Command executed:', result.data);
    } else {
      console.error('Command failed:', result.error);
    }
  } catch (error) {
    console.error('Error executing command:', error);
  }
}

/**
 * Example 6: Integration with Kortix backend
 */
export async function exampleKortixIntegration() {
  console.log('\n=== Example 6: Kortix Backend Integration ===\n');

  const extension = new MockBrowserExtension();

  // Simulate Kortix backend sending commands
  const backendCommands: Command[] = [
    {
      id: 'backend-1',
      action: 'navigate',
      params: { url: 'https://example.com/search' },
      timestamp: Date.now(),
    },
    {
      id: 'backend-2',
      action: 'type',
      params: { selector: 'input[type="search"]', text: 'kortix ai' },
      timestamp: Date.now(),
    },
    {
      id: 'backend-3',
      action: 'click',
      params: { selector: 'button[type="submit"]' },
      timestamp: Date.now(),
    },
    {
      id: 'backend-4',
      action: 'extractEmails',
      timestamp: Date.now(),
    },
  ];

  console.log('Backend sending', backendCommands.length, 'commands\n');

  for (const cmd of backendCommands) {
    const result = await extension.executeCommand(cmd);
    console.log(`[${cmd.action}] ${result.success ? '✓' : '✗'}`);
  }

  // Print final status
  const status = extension.getSessionStatus();
  console.log('\nFinal Status:');
  console.log('  Commands processed:', status.commandCount);
  console.log('  Extractions:', status.extractionCount);
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  console.log('========================================');
  console.log('Kortix Chrome Extension - Test Examples');
  console.log('========================================');

  try {
    await exampleBasicCommandExecution();
    await exampleEmailExtraction();
    await exampleMultiStepScenario();
    await exampleTestRunner();
    await exampleErrorHandling();
    await exampleKortixIntegration();

    console.log('\n========================================');
    console.log('All examples completed successfully!');
    console.log('========================================\n');
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples();
}
