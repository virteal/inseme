/**
 * Lead Management Service
 * Pluggable utility to transmit interest data to external systems.
 */

const LEAD_WEBHOOK_URL = import.meta.env.VITE_LEAD_WEBHOOK_URL;

export const submitLead = async (leadData) => {
    console.log("Transmission du Lead:", leadData);

    if (!LEAD_WEBHOOK_URL) {
        console.warn("⚠️ VITE_LEAD_WEBHOOK_URL non configurée. Lead stocké localement (console).");
        return { success: true, local: true };
    }

    try {
        const response = await fetch(LEAD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...leadData,
                source: 'inseme_saas_landing',
                timestamp: new Date().toISOString()
            })
        });

        return { success: response.ok };
    } catch (error) {
        console.error("Erreur Transmission Lead:", error);
        return { success: false, error };
    }
};
