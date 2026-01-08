/**
 * Kortix Chrome Extension - Testing Utilities
 * 
 * Provides utilities for testing the extension with Kortix backend.
 */

import { Command, CommandResult, BrowserSession } from '../types/index';

/**
 * Mock browser extension for testing
 */
export class MockBrowserExtension {
  private sessionId: string;
  private commandHistory: Command[] = [];
  private extractionHistory: any[] = [];
  private isListening: boolean = true;

  constructor() {
    this.sessionId = this.generateSessionId();
  }

  /**
   * Simulate command execution
   */
  async executeCommand(command: Command): Promise<CommandResult> {
    this.commandHistory.push(command);

    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    switch (command.action) {
      case 'extractEmails':
        return this.mockExtractEmails(command);

      case 'getPageInfo':
        return this.mockGetPageInfo(command);

      case 'getElements':
        return this.mockGetElements(command);

      case 'navigate':
        return this.mockNavigate(command);

      case 'click':
        return this.mockClick(command);

      default:
        return {
          commandId: command.id,
          success: true,
          data: { action: command.action, executed: true },
          timestamp: Date.now(),
        };
    }
  }

  /**
   * Mock email extraction
   */
  private mockExtractEmails(command: Command): CommandResult {
    const mockEmails = [
      'test@example.com',
      'admin@example.com',
      'support@example.com',
    ];

    const result = {
      emails: mockEmails,
      count: mockEmails.length,
      sources: {
        text: 2,
        mailto: 1,
        dataAttributes: 0,
      },
    };

    this.extractionHistory.push({
      id: this.generateId(),
      command: 'extractEmails',
      data: result,
      timestamp: Date.now(),
    });

    return {
      commandId: command.id,
      success: true,
      data: result,
      timestamp: Date.now(),
    };
  }

  /**
   * Mock page info
   */
  private mockGetPageInfo(command: Command): CommandResult {
    return {
      commandId: command.id,
      success: true,
      data: {
        title: 'Test Page',
        url: 'https://example.com',
        domain: 'example.com',
        protocol: 'https:',
        scrollY: 0,
        scrollHeight: 1000,
        innerHeight: 800,
        innerWidth: 1200,
        readyState: 'complete',
      },
      timestamp: Date.now(),
    };
  }

  /**
   * Mock get elements
   */
  private mockGetElements(command: Command): CommandResult {
    return {
      commandId: command.id,
      success: true,
      data: {
        elements: [
          {
            index: 0,
            tag: 'a',
            text: 'Home',
            href: 'https://example.com',
          },
          {
            index: 1,
            tag: 'button',
            text: 'Submit',
            type: 'submit',
          },
          {
            index: 2,
            tag: 'input',
            text: '',
            type: 'email',
          },
        ],
        total: 3,
      },
      timestamp: Date.now(),
    };
  }

  /**
   * Mock navigation
   */
  private mockNavigate(command: Command): CommandResult {
    const url = command.params?.url || 'https://example.com';

    return {
      commandId: command.id,
      success: true,
      data: {
        url: url,
        title: 'Test Page',
      },
      timestamp: Date.now(),
    };
  }

  /**
   * Mock click
   */
  private mockClick(command: Command): CommandResult {
    return {
      commandId: command.id,
      success: true,
      data: {
        clicked: true,
        element: 'button',
      },
      timestamp: Date.now(),
    };
  }

  /**
   * Get session status
   */
  getSessionStatus(): BrowserSession {
    return {
      sessionId: this.sessionId,
      isActive: this.isListening,
      commandCount: this.commandHistory.length,
      extractionCount: this.extractionHistory.length,
    };
  }

  /**
   * Get command history
   */
  getCommandHistory(): Command[] {
    return [...this.commandHistory];
  }

  /**
   * Get extraction history
   */
  getExtractionHistory(): any[] {
    return [...this.extractionHistory];
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.commandHistory = [];
    this.extractionHistory = [];
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate ID
   */
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Test scenario builder
 */
export class TestScenarioBuilder {
  private scenarios: Array<{
    name: string;
    commands: Command[];
    expectedResults: CommandResult[];
  }> = [];

  /**
   * Add scenario
   */
  addScenario(
    name: string,
    commands: Command[],
    expectedResults: CommandResult[]
  ): this {
    this.scenarios.push({ name, commands, expectedResults });
    return this;
  }

  /**
   * Run all scenarios
   */
  async runAll(extension: MockBrowserExtension): Promise<TestResult[]> {
    const results: TestResult[] = [];

    for (const scenario of this.scenarios) {
      const result = await this.runScenario(scenario, extension);
      results.push(result);
    }

    return results;
  }

  /**
   * Run single scenario
   */
  private async runScenario(
    scenario: any,
    extension: MockBrowserExtension
  ): Promise<TestResult> {
    const startTime = Date.now();
    const actualResults: CommandResult[] = [];
    let passed = true;
    let error: string | null = null;

    try {
      for (const command of scenario.commands) {
        const result = await extension.executeCommand(command);
        actualResults.push(result);
      }

      // Verify results
      for (let i = 0; i < actualResults.length; i++) {
        const actual = actualResults[i];
        const expected = scenario.expectedResults[i];

        if (actual.success !== expected.success) {
          passed = false;
          error = `Command ${i}: Expected success=${expected.success}, got ${actual.success}`;
          break;
        }
      }
    } catch (err) {
      passed = false;
      error = err instanceof Error ? err.message : 'Unknown error';
    }

    const duration = Date.now() - startTime;

    return {
      name: scenario.name,
      passed,
      error,
      duration,
      commandCount: scenario.commands.length,
    };
  }
}

/**
 * Test result interface
 */
export interface TestResult {
  name: string;
  passed: boolean;
  error: string | null;
  duration: number;
  commandCount: number;
}

/**
 * Test runner
 */
export class ExtensionTestRunner {
  private extension: MockBrowserExtension;
  private results: TestResult[] = [];

  constructor() {
    this.extension = new MockBrowserExtension();
  }

  /**
   * Run email extraction test
   */
  async testEmailExtraction(): Promise<TestResult> {
    const command: Command = {
      id: 'test-1',
      action: 'extractEmails',
      timestamp: Date.now(),
    };

    const result = await this.extension.executeCommand(command);

    const passed =
      result.success &&
      result.data?.emails &&
      result.data.emails.length > 0;

    return {
      name: 'Email Extraction',
      passed,
      error: passed ? null : 'Email extraction failed',
      duration: 100,
      commandCount: 1,
    };
  }

  /**
   * Run page info test
   */
  async testPageInfo(): Promise<TestResult> {
    const command: Command = {
      id: 'test-2',
      action: 'getPageInfo',
      timestamp: Date.now(),
    };

    const result = await this.extension.executeCommand(command);

    const passed =
      result.success &&
      result.data?.title &&
      result.data?.url;

    return {
      name: 'Page Info',
      passed,
      error: passed ? null : 'Page info retrieval failed',
      duration: 100,
      commandCount: 1,
    };
  }

  /**
   * Run navigation test
   */
  async testNavigation(): Promise<TestResult> {
    const command: Command = {
      id: 'test-3',
      action: 'navigate',
      params: { url: 'https://example.com' },
      timestamp: Date.now(),
    };

    const result = await this.extension.executeCommand(command);

    const passed = result.success && result.data?.url;

    return {
      name: 'Navigation',
      passed,
      error: passed ? null : 'Navigation failed',
      duration: 100,
      commandCount: 1,
    };
  }

  /**
   * Run all tests
   */
  async runAll(): Promise<TestResult[]> {
    this.results = [
      await this.testEmailExtraction(),
      await this.testPageInfo(),
      await this.testNavigation(),
    ];

    return this.results;
  }

  /**
   * Get test summary
   */
  getSummary(): {
    total: number;
    passed: number;
    failed: number;
    successRate: number;
  } {
    const total = this.results.length;
    const passed = this.results.filter((r) => r.passed).length;
    const failed = total - passed;
    const successRate = total > 0 ? (passed / total) * 100 : 0;

    return { total, passed, failed, successRate };
  }

  /**
   * Print results
   */
  printResults(): void {
    console.log('\n=== Extension Test Results ===\n');

    for (const result of this.results) {
      const status = result.passed ? '✓' : '✗';
      console.log(`${status} ${result.name} (${result.duration}ms)`);

      if (result.error) {
        console.log(`  Error: ${result.error}`);
      }
    }

    const summary = this.getSummary();
    console.log(`\n=== Summary ===`);
    console.log(`Total: ${summary.total}`);
    console.log(`Passed: ${summary.passed}`);
    console.log(`Failed: ${summary.failed}`);
    console.log(`Success Rate: ${summary.successRate.toFixed(1)}%\n`);
  }
}
