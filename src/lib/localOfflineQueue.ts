// Engine de Contingência Offline (Local-First IndexedDB)
// Garante que se a internet do restaurante cair no pico de sábado, o caixa continua registrando vendas

export interface PedidoOffline {
  idLocal: string;
  lojaId: string;
  criadoEm: string;
  valorTotal: number;
  tipoPedido: string;
  itens: any[];
  pagamentoMetodo: string;
  statusSync: 'PENDENTE' | 'SINCRONIZADO' | 'ERRO';
}

const DB_NAME = 'MiseOnLocalOfflineDB';
const STORE_NAME = 'fila_pedidos_offline';

function abrirBanco(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'idLocal' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function salvarPedidoOffline(pedido: Omit<PedidoOffline, 'idLocal' | 'statusSync'>): Promise<string> {
  const db = await abrirBanco();
  const idLocal = `OFFLINE-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  const registro: PedidoOffline = {
    ...pedido,
    idLocal,
    statusSync: 'PENDENTE',
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.add(registro);
    req.onsuccess = () => resolve(idLocal);
    req.onerror = () => reject(req.error);
  });
}

export async function listarPedidosOfflinePendentes(): Promise<PedidoOffline[]> {
  const db = await abrirBanco();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      const lista: PedidoOffline[] = req.result || [];
      resolve(lista.filter((p) => p.statusSync === 'PENDENTE'));
    };
    req.onerror = () => reject(req.error);
  });
}

export async function marcarSincronizado(idLocal: string): Promise<void> {
  const db = await abrirBanco();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(idLocal);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
