import { clipboard } from 'electron';
import type { SearchProvider } from '../search-provider';
import type { UnifiedResult, ResultAction } from '../../../shared/types';
import { getWorkflows, executeWorkflow } from '../../workflows/workflow-engine';

export class WorkflowProvider implements SearchProvider {
  id = 'workflow';
  name = 'Workflows';
  priority = 30;

  canHandle(query: string): boolean {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return false;

    const workflows = getWorkflows();
    return workflows.some((wf) =>
      wf.keyword.toLowerCase().startsWith(q) ||
      wf.name.toLowerCase().includes(q)
    ) || q.startsWith('wf ');
  }

  async search(query: string): Promise<UnifiedResult[]> {
    let q = query.trim();
    if (q.toLowerCase().startsWith('wf ')) q = q.slice(3);
    const qLower = q.toLowerCase();

    const parts = q.split(' ');
    const keyword = parts[0].toLowerCase();
    const args = parts.slice(1).join(' ');

    const workflows = getWorkflows();
    const results: UnifiedResult[] = [];

    for (const wf of workflows) {
      let score = 0;
      const kwLower = wf.keyword.toLowerCase();
      const nameLower = wf.name.toLowerCase();

      if (kwLower === keyword) score = 1000;
      else if (kwLower.startsWith(qLower)) score = 800;
      else if (nameLower.includes(qLower)) score = 600;

      if (score > 0) {
        results.push({
          id: `wf-${wf.id}`,
          name: wf.name,
          subtitle: wf.description || `Keyword: ${wf.keyword}`,
          icon: wf.icon,
          category: 'workflow',
          score,
          actions: [
            { id: 'execute', name: 'Run', shortcut: 'Enter', isDefault: true },
          ],
          data: {
            _providerId: this.id,
            workflowId: wf.id,
            args,
          },
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 10);
  }

  getActions(result: UnifiedResult): ResultAction[] {
    if (result.category !== 'workflow') return [];
    return [{ id: 'execute', name: 'Run', shortcut: 'Enter', isDefault: true }];
  }

  async executeAction(result: UnifiedResult, actionId: string): Promise<void> {
    if (actionId !== 'execute') return;

    const workflowId = result.data.workflowId as string;
    const args = result.data.args as string;
    const workflows = getWorkflows();
    const wf = workflows.find((w) => w.id === workflowId);

    if (!wf) return;

    const output = await executeWorkflow(wf, args || undefined);

    // If output wasn't handled by a step, copy it
    if (output && !wf.steps.some((s) => s.type === 'copy' || s.type === 'notification')) {
      clipboard.writeText(output);
    }
  }
}
