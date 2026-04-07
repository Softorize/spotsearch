import { clipboard, Notification } from 'electron';
import { exec } from 'child_process';
import { shell } from 'electron';
import Store from 'electron-store';

export interface WorkflowStep {
  type: 'script' | 'open-url' | 'copy' | 'notification' | 'transform' | 'delay';
  config: Record<string, string>;
}

export interface Workflow {
  id: string;
  name: string;
  keyword: string;
  icon: string;
  description: string;
  steps: WorkflowStep[];
}

interface WorkflowStoreData {
  workflows: Workflow[];
}

const store = new Store<WorkflowStoreData>({
  name: 'workflows',
  defaults: {
    workflows: [
      {
        id: 'wf-ip',
        name: 'Copy IP Address',
        keyword: 'ip',
        icon: '🌐',
        description: 'Copy your public IP address to clipboard',
        steps: [
          { type: 'script', config: { command: 'curl -s ifconfig.me' } },
          { type: 'copy', config: {} },
        ],
      },
      {
        id: 'wf-uuid',
        name: 'Generate UUID',
        keyword: 'uuid',
        icon: '🔑',
        description: 'Generate a random UUID and copy to clipboard',
        steps: [
          { type: 'script', config: { command: 'uuidgen' } },
          { type: 'transform', config: { operation: 'lowercase' } },
          { type: 'copy', config: {} },
        ],
      },
    ],
  },
});

export function getWorkflows(): Workflow[] {
  return store.get('workflows', []);
}

export function addWorkflow(workflow: Omit<Workflow, 'id'>): Workflow {
  const workflows = getWorkflows();
  const newWf: Workflow = { ...workflow, id: `wf-${Date.now()}` };
  workflows.push(newWf);
  store.set('workflows', workflows);
  return newWf;
}

export function removeWorkflow(id: string): void {
  const workflows = getWorkflows().filter((w) => w.id !== id);
  store.set('workflows', workflows);
}

function runScript(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(command, { timeout: 30000 }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout.trim());
    });
  });
}

function transformText(input: string, operation: string): string {
  switch (operation) {
    case 'uppercase': return input.toUpperCase();
    case 'lowercase': return input.toLowerCase();
    case 'trim': return input.trim();
    case 'base64-encode': return Buffer.from(input).toString('base64');
    case 'base64-decode': return Buffer.from(input, 'base64').toString('utf-8');
    case 'url-encode': return encodeURIComponent(input);
    case 'url-decode': return decodeURIComponent(input);
    case 'reverse': return input.split('').reverse().join('');
    case 'count-words': return String(input.split(/\s+/).filter(Boolean).length);
    case 'count-chars': return String(input.length);
    default: return input;
  }
}

export async function executeWorkflow(workflow: Workflow, input?: string): Promise<string> {
  let data = input || '';

  for (const step of workflow.steps) {
    switch (step.type) {
      case 'script': {
        const command = (step.config.command || '').replace(/\{input\}/g, data);
        data = await runScript(command);
        break;
      }
      case 'open-url': {
        const url = (step.config.url || '').replace(/\{input\}/g, encodeURIComponent(data));
        shell.openExternal(url);
        break;
      }
      case 'copy':
        clipboard.writeText(data);
        break;
      case 'notification':
        new Notification({
          title: step.config.title || workflow.name,
          body: data || step.config.body || 'Done',
        }).show();
        break;
      case 'transform':
        data = transformText(data, step.config.operation || '');
        break;
      case 'delay': {
        const ms = parseInt(step.config.ms || '1000');
        await new Promise((r) => setTimeout(r, ms));
        break;
      }
    }
  }

  return data;
}
