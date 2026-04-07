import Store from 'electron-store';
import { exec } from 'child_process';
import { dirname, basename, extname } from 'path';

export interface CustomAction {
  id: string;
  name: string;
  icon: string;
  fileTypes: string[]; // extensions, or ['*'] for all
  command: string; // template with {filepath}, {filename}, {directory}, {extension}, {basename}
}

interface CustomActionStoreData {
  actions: CustomAction[];
}

const store = new Store<CustomActionStoreData>({
  name: 'custom-actions',
  defaults: {
    actions: [
      {
        id: 'ca-vscode',
        name: 'Open in VS Code',
        icon: '💻',
        fileTypes: ['*'],
        command: 'code "{filepath}"',
      },
      {
        id: 'ca-terminal',
        name: 'Open in Terminal',
        icon: '🖥️',
        fileTypes: ['*'],
        command: 'open -a Terminal "{directory}"',
      },
      {
        id: 'ca-iterm',
        name: 'Open in iTerm',
        icon: '🖥️',
        fileTypes: ['*'],
        command: 'open -a iTerm "{directory}"',
      },
    ],
  },
});

export function getCustomActions(): CustomAction[] {
  return store.get('actions', []);
}

export function addCustomAction(action: Omit<CustomAction, 'id'>): CustomAction {
  const actions = getCustomActions();
  const newAction: CustomAction = {
    ...action,
    id: `ca-${Date.now()}`,
  };
  actions.push(newAction);
  store.set('actions', actions);
  return newAction;
}

export function removeCustomAction(id: string): void {
  const actions = getCustomActions().filter((a) => a.id !== id);
  store.set('actions', actions);
}

export function getActionsForFile(filePath: string): CustomAction[] {
  const ext = extname(filePath).slice(1).toLowerCase();
  const actions = getCustomActions();

  return actions.filter((action) =>
    action.fileTypes.includes('*') || action.fileTypes.includes(ext)
  );
}

export function executeCustomAction(action: CustomAction, filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const command = action.command
      .replace(/\{filepath\}/g, filePath)
      .replace(/\{filename\}/g, basename(filePath))
      .replace(/\{directory\}/g, dirname(filePath))
      .replace(/\{extension\}/g, extname(filePath).slice(1))
      .replace(/\{basename\}/g, basename(filePath, extname(filePath)));

    exec(command, { timeout: 10000 }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}
