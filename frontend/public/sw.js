// Minimal service worker for installability. No aggressive caching to avoid stale forms.
self.addEventListener('install', event => {
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(self.clients.claim());
});

// Network-first for navigation to avoid stale pages
self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.mode === 'navigate') {
        event.respondWith(fetch(req).catch(() => caches.match('/')));
    }
});

// Web Push: show notification when a push message arrives
self.addEventListener('push', event => {
    let data = {
        title: 'Lembrete de Agenda',
        body: '',
        wa_phone: '',
        wa_text: '',
    };
    if (event.data) {
        try {
            data = { ...data, ...event.data.json() };
        } catch {
            data.body = event.data.text();
        }
    }

    const actions = [];
    if (data.wa_phone && data.wa_text) {
        actions.push({ action: 'whatsapp', title: '✔ Sim, enviar WhatsApp' });
        actions.push({ action: 'dismiss', title: 'Agora não' });
    }

    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-72.png',
            tag: 'agenda-reminder',
            renotify: true,
            requireInteraction: true,
            data: { wa_phone: data.wa_phone, wa_text: data.wa_text },
            actions,
        }),
    );
});

// Open or focus the /agenda page when the notification is clicked
// If the professional clicked the WhatsApp action, open WhatsApp directly
self.addEventListener('notificationclick', event => {
    event.notification.close();

    const { wa_phone, wa_text } = event.notification.data || {};

    if (event.action === 'whatsapp' && wa_phone && wa_text) {
        const url = `https://wa.me/${wa_phone}?text=${encodeURIComponent(wa_text)}`;
        event.waitUntil(self.clients.openWindow(url));
        return;
    }

    // Default: focus or open /agenda
    event.waitUntil(
        self.clients
            .matchAll({ type: 'window', includeUncontrolled: true })
            .then(clientList => {
                for (const client of clientList) {
                    if (client.url.includes('/agenda') && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (self.clients.openWindow) {
                    return self.clients.openWindow('/agenda');
                }
            }),
    );
});
