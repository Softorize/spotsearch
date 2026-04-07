import { EventEmitter } from 'events';
import type { SearchProvider } from './search-provider';
import type { UnifiedResult, SearchStats } from '../../shared/types';
import { applyFrecencyBoost } from './frecency-store';

export class SearchCoordinator extends EventEmitter {
  private providers: SearchProvider[] = [];
  private currentSearchId = 0;
  private startTime = 0;

  registerProvider(provider: SearchProvider): void {
    this.providers.push(provider);
    // Keep sorted by priority (lower = higher priority)
    this.providers.sort((a, b) => a.priority - b.priority);
    provider.initialize?.();
  }

  unregisterProvider(providerId: string): void {
    const idx = this.providers.findIndex((p) => p.id === providerId);
    if (idx !== -1) {
      this.providers[idx].destroy?.();
      this.providers.splice(idx, 1);
    }
  }

  getProvider(providerId: string): SearchProvider | undefined {
    return this.providers.find((p) => p.id === providerId);
  }

  async search(query: string): Promise<void> {
    const searchId = ++this.currentSearchId;
    this.startTime = Date.now();

    if (!query.trim()) {
      this.emit('complete', { count: 0, duration: 0 } as SearchStats);
      return;
    }

    // Find all providers that can handle this query
    const matchingProviders = this.providers.filter((p) => p.canHandle(query));

    if (matchingProviders.length === 0) {
      this.emit('complete', { count: 0, duration: 0 } as SearchStats);
      return;
    }

    const allResults: UnifiedResult[] = [];

    // Run all matching providers concurrently
    const providerPromises = matchingProviders.map(async (provider) => {
      try {
        const results = await provider.search(query);

        // Check if this search is still current
        if (searchId !== this.currentSearchId) return;

        allResults.push(...results);
      } catch (error) {
        if (searchId !== this.currentSearchId) return;
        console.error(`Provider ${provider.id} error:`, error);
        this.emit('error', `${provider.name}: ${(error as Error).message}`);
      }
    });

    await Promise.allSettled(providerPromises);

    // Only emit results if this search is still current
    if (searchId === this.currentSearchId) {
      // Apply frecency boost to all results
      applyFrecencyBoost(allResults, query);

      // Sort by score descending
      allResults.sort((a, b) => b.score - a.score);

      // Emit results in sorted order
      for (const result of allResults) {
        if (searchId !== this.currentSearchId) return;
        this.emit('result', result);
      }

      const stats: SearchStats = {
        count: allResults.length,
        duration: Date.now() - this.startTime,
      };
      this.emit('complete', stats);
    }
  }

  cancel(): void {
    this.currentSearchId++;
  }

  async executeAction(result: UnifiedResult, actionId: string): Promise<void> {
    // Find the provider that owns this result based on category mapping
    const provider = this.findProviderForResult(result);
    if (provider) {
      await provider.executeAction(result, actionId);
    }
  }

  private findProviderForResult(result: UnifiedResult): SearchProvider | undefined {
    // Try to find by provider ID stored in result data
    if (result.data._providerId) {
      const provider = this.providers.find((p) => p.id === result.data._providerId);
      if (provider) return provider;
    }

    // Fallback: find first provider that has actions for this result
    return this.providers.find((p) => p.getActions(result).length > 0);
  }

  destroy(): void {
    for (const provider of this.providers) {
      provider.destroy?.();
    }
    this.providers = [];
  }
}

// Singleton instance
export const searchCoordinator = new SearchCoordinator();
