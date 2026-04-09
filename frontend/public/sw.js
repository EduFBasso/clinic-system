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
            data: {
                wa_phone: data.wa_phone,
                wa_text: data.wa_text,
                appointment_id: data.appointment_id,
            },
            actions,
        }),
    );
});

// Open or focus the /agenda page when the notification is clicked
// If the professional clicked the WhatsApp action, open WhatsApp directly
self.addEventListener('notificationclick', event => {
    event.notification.close();

    const { wa_phone, wa_text, appointment_id } = event.notification.data || {};

    if (event.action === 'whatsapp' && wa_phone && wa_text) {
        // Navigate the app with reminder params so it can call confirm-whatsapp
        // (authenticated) and open WhatsApp. The SW has no auth token, so this
        // approach delegates the confirm call to the React app.
        let appUrl = '/';
        if (appointment_id) {
            const params = new URLSearchParams({
                reminder: String(appointment_id),
                wa: '1',
            });
            params.set('wp', wa_phone);
            params.set('wt', wa_text);
            appUrl = '/?' + params.toString();
        }

        event.waitUntil(
            self.clients
                .matchAll({ type: 'window', includeUncontrolled: true })
                .then(clientList => {
                    for (const client of clientList) {
                        if ('navigate' in client) {
                            return client
                                .navigate(appUrl)
                                .then(c => c && c.focus());
                        }
                        if ('focus' in client) return client.focus();
                    }
                    if (self.clients.openWindow) {
                        return self.clients.openWindow(appUrl);
                    }
                }),
        );
        return;
    }

    // Default click (no specific action): open the SPA root (/) with reminder param so
    // Home.tsx can focus the ClientCard (or save to sessionStorage if not logged in).
    // NOTE: do NOT use /agenda here — Vite proxies that path to the Django backend.
    // Pass wa_phone and wa_text so Home.tsx can store them before login.
    let appUrl = '/';
    if (appointment_id) {
        const params = new URLSearchParams({
            reminder: String(appointment_id),
        });
        if (wa_phone) params.set('wp', wa_phone);
        if (wa_text) params.set('wt', wa_text);
        appUrl = '/?' + params.toString();
    }

    event.waitUntil(
        self.clients
            .matchAll({ type: 'window', includeUncontrolled: true })
            .then(clientList => {
                for (const client of clientList) {
                    if ('focus' in client) {
                        if (appointment_id && 'navigate' in client) {
                            return client
                                .navigate(appUrl)
                                .then(c => c && c.focus());
                        }
                        return client.focus();
                    }
                }
                if (self.clients.openWindow) {
                    return self.clients.openWindow(appUrl);
                }
            }),
    );
});
