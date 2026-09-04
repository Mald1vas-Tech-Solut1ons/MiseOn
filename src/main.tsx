/// <reference types="vite-plugin-pwa/client" />

// Global WebSocket URL sanitizer: prevents stray %0A or trailing newlines in any WebSocket URL
if (typeof window !== 'undefined' && window.WebSocket) {
  const NativeWebSocket = window.WebSocket;
  function CustomWebSocket(this: WebSocket, url: string | URL, protocols?: string | string[]) {
    const cleanUrl = typeof url === 'string'
      ? url.replace(/%0[aAdD]/g, '').replace(/[\r\n\t\0\s]+/g, '')
      : url;
    return new (NativeWebSocket as any)(cleanUrl, protocols);
  }
  CustomWebSocket.prototype = NativeWebSocket.prototype;
  CustomWebSocket.CONNECTING = NativeWebSocket.CONNECTING;
  CustomWebSocket.OPEN = NativeWebSocket.OPEN;
  CustomWebSocket.CLOSING = NativeWebSocket.CLOSING;
  CustomWebSocket.CLOSED = NativeWebSocket.CLOSED;
  window.WebSocket = CustomWebSocket as any;
}

import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './index.css';



import { instalarMonitorDeErros } from './lib/monitorErros';
import App from './App';

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateSW(true);
  },
});

/**
 * Mantém o app na versão publicada, mesmo com cache de borda no caminho.
 *
 * O sw.js é servido com Cache-Control de 4 horas (a borda sobrescreve o
 * max-age=0 que o projeto define), então o navegador podia continuar rodando o
 * app antigo por horas depois de um deploy — e o lojista via bug já corrigido,
 * sem ter como saber que era versão velha.
 *
 * A checagem abaixo roda ao abrir, ao voltar o foco da aba e a cada 15 minutos.
 * `registration.update()` busca o script do service worker ignorando o cache
 * HTTP, então não depende do TTL da borda. Quando encontra versão nova, o
 * onNeedRefresh acima aplica e recarrega.
 */
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  const procurarAtualizacao = () => {
    navigator.serviceWorker.getRegistrations().then((registros) => {
      for (const registro of registros) registro.update().catch(() => {});
    }).catch(() => {});
  };

  procurarAtualizacao();

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') procurarAtualizacao();
  });

  window.setInterval(procurarAtualizacao, 15 * 60 * 1000);
}

// Antes de montar a arvore: erro que estoura no proprio render inicial
// tambem precisa ser capturado.
instalarMonitorDeErros();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
