// Service Worker MiseOn — Push Notifications & PWA Garçom
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.titulo || '🔔 MiseOn Garçom';
    const options = {
      body: data.mensagem || 'Chamado de atendimento no salão.',
      icon: '/icon.png',
      badge: '/icon.png',
      vibrate: data.tipo === 'FECHAMENTO' ? [300, 100, 300, 100, 500] : [200, 100, 200],
      data: {
        url: data.url || '/admin/garcom-mobile',
        mesaId: data.mesaId,
      },
      tag: `chamado-${data.mesaId || 'geral'}`,
      renotify: true,
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error('[SW] Erro ao processar Push:', err);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/admin/garcom-mobile';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes('/admin/garcom-mobile') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
