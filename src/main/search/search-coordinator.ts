import { EventEmitter } from 'events';
import type { SearchProvider } from './search-provider';
import type { UnifiedResult, SearchStats } from '../../shared/types';
import { applyFrecencyBoost } from './frecency-store';

export class SearchCoordinator extends EventEmitter {
  private providers: SearchProvider[] = [];
  private currentSearchId = 0;

  registerProvider(provider: SearchProvider): void {
    this.providers.push(provider);
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
    const startTime = Date.now();

    if (!query.trim()) {
      // For empty queries, still check providers (e.g., recent files)
      const emptyProviders = this.providers.filter((p) => p.canHandle(query));
      if (emptyProviders.length === 0) {
        this.emit('complete', { count: 0, duration: 0 } as SearchStats);
        return;
      }
    }

    const matchingProviders = this.providers.filter((p) => p.canHandle(query));

    if (matchingProviders.length === 0) {
      this.emit('complete', { count: 0, duration: 0 } as SearchStats);
      return;
    }

    let totalResults = 0;
    let completedProviders = 0;

    // Emit results progressively as each provider completes
    const providerPromises = matchingProviders.map(async (provider) => {
      try {
        const results = await provider.search(query);

        if (searchId !== this.currentSearchId) return;

        // Apply frecency boost to this batch
        applyFrecencyBoost(results, query);

        // Sort this provider's results by score
        results.sort((a, b) => b.score - a.score);

        // Emit all results from this provider as a batch
        for (const result of results) {
          if (searchId !== this.currentSearchId) return;
          totalResults++;
          this.emit('result', result);
        }
      } catch (error) {
        if (searchId !== this.currentSearchId) return;
        console.error(`Provider ${provider.id} error:`, error);
      } finally {
        completedProviders++;
      }
    });

    await Promise.allSettled(providerPromises);

    if (searchId === this.currentSearchId) {
      const stats: SearchStats = {
        count: totalResults,
        duration: Date.now() - startTime,
      };
      this.emit('complete', stats);
    }
  }

  cancel(): void {
    this.currentSearchId++;
  }

  async executeAction(result: UnifiedResult, actionId: string): Promise<void> {
    const provider = this.findProviderForResult(result);
    if (provider) {
      await provider.executeAction(result, actionId);
    }
  }

  private findProviderForResult(result: UnifiedResult): SearchProvider | undefined {
    if (result.data._providerId) {
      const provider = this.providers.find((p) => p.id === result.data._providerId);
      if (provider) return provider;
    }
    return this.providers.find((p) => p.getActions(result).length > 0);
  }

  destroy(): void {
    for (const provider of this.providers) {
      provider.destroy?.();
    }
    this.providers = [];
  }
}

export const searchCoordinator = new SearchCoordinator();
