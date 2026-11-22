import { openDB, type DBSchema } from 'idb';
import type { HighlighterPreset, Notebook, PenPreset, ToolbarDock } from '../types/notebook';

interface AkilliDefterDB extends DBSchema {
  notebooks: {
    key: string;
    value: Notebook;
  };
  settings: {
    key: string;
    value: unknown;
  };
}

const DB_NAME = 'akilli-defter-db';
const DB_VERSION = 1;

async function getDb() {
  return openDB<AkilliDefterDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('notebooks')) {
        db.createObjectStore('notebooks', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings');
      }
    },
  });
}

export async function loadAllNotebooks(): Promise<Notebook[]> {
  try {
    const db = await getDb();
    const list = await db.getAll('notebooks');
    return list.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export async function saveNotebook(notebook: Notebook): Promise<void> {
  try {
    const db = await getDb();
    await db.put('notebooks', notebook);
  } catch (err) {
    console.error('Defter kaydedilemedi:', err);
  }
}

export async function deleteNotebookFromDb(id: string): Promise<void> {
  try {
    const db = await getDb();
    await db.delete('notebooks', id);
  } catch (err) {
    console.error('Defter silinemedi:', err);
  }
}

export interface PersistedPrefs {
  penPresets?: PenPreset[];
  highlighterPresets?: HighlighterPreset[];
  palmRejection?: boolean;
  autoShape?: boolean;
  toolbarDock?: ToolbarDock;
  activeNotebookId?: string;
}

export async function loadPrefs(): Promise<PersistedPrefs> {
  try {
    const db = await getDb();
    const prefs = (await db.get('settings', 'prefs')) as PersistedPrefs | undefined;
    return prefs ?? {};
  } catch {
    return {};
  }
}

export async function savePrefs(prefs: PersistedPrefs): Promise<void> {
  try {
    const db = await getDb();
    await db.put('settings', prefs, 'prefs');
  } catch (err) {
    console.error('Ayarlar kaydedilemedi:', err);
  }
}
