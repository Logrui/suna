import { backendApi } from '../api-client';

export interface ModelMetadata {
  id: string;
  name: string;
  provider: string;
  enabled: boolean;
  context_window: number;
  max_output_tokens?: number;
  input_cost_per_million: number;
  output_cost_per_million: number;
  litellm_id: string;
  fallbacks: string[];
  capabilities: string[];
  tier_availability: string[];
  priority: number;
  recommended: boolean;
}

export interface TestResult {
  model_id: string;
  status: 'PASS' | 'FAIL';
  latency_ms: number;
  outcome: string;
  provider: string;
}

export interface TestRequest {
  include_local: boolean;
  disable_fallbacks: boolean;
}

export const listAdminModels = async (): Promise<ModelMetadata[]> => {
  const response = await backendApi.get<ModelMetadata[]>('/admin/models/');
  if (response.error) {
    throw new Error(response.error.message || 'Failed to list models');
  }
  return response.data || [];
};

export const testModels = async (request: TestRequest): Promise<TestResult[]> => {
  const response = await backendApi.post<TestResult[]>('/admin/models/test', request);
  if (response.error) {
    throw new Error(response.error.message || 'Failed to test models');
  }
  return response.data || [];
};
