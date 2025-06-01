self.addEventListener('sync', (event) => {
    if (event.tag === 'location-update') {
        event.waitUntil(this.sendLocationsFromDB());
    }
});

async function sendLocationsFromDB() {
    const db = await openDatabase();
    const tx = db.transaction('locations', 'readonly');
    const store = tx.objectStore('locations');
    const locations = await store.getAll();

    try {
        await fetch('https://your-api/delivery/location/batch', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + getAuthToken()
            },
            body: JSON.stringify(locations)
        });

        // Clear only successfully sent locations
        const clearTx = db.transaction('locations', 'readwrite');
        const clearStore = clearTx.objectStore('locations');
        await Promise.all(locations.map(l => clearStore.delete(l.timestamp)));
    } catch (error) {
        console.error('Background sync failed');
        throw error;
    }
}

// Updated beforeunload handler
window.addEventListener('beforeunload', async (event) => {
    if (!this.isTrackingActive) return;

    navigator.geolocation.getCurrentPosition((position) => {
        const finalLocation = {
            sessionId: this.trackingSessionId,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            isFinal: true,
            timestamp: Date.now()
        };

        // Send final position
        navigator.sendBeacon(
            this.apiUrl + '/delivery/location',
            new Blob([JSON.stringify(finalLocation)], { type: 'application/json' })
        );

        // Clear tracking flag
        localStorage.removeItem('activeTrackingSession');
    });
});