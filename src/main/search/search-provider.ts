import type { UnifiedResult, ResultAction } from '../../shared/types';

export interface SearchProvider {
  id: string;
  name: string;
  priority: number; // lower number = higher priority (shown first)

  // Whether this provider can handle the given query
  canHandle(query: string): boolean;

  // Search and return results. Can return a promise or async generator for streaming
  search(query: string): Promise<UnifiedResult[]>;

  // Get available actions for a result from this provider
  getActions(result: UnifiedResult): ResultAction[];

  // Execute an action on a result
  executeAction(result: UnifiedResult, actionId: string): Promise<void>;

  // Optional: called once when the provider is registered
  initialize?(): Promise<void>;

  // Optional: called when the app is shutting down
  destroy?(): void;
}
