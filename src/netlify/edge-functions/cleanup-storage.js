// src/netlify/edge-functions/cleanup-storage.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

export default async (request, context) => {
    // This function can be triggered via a Cron Job (Netlify Scheduled Functions)
    // or manually via a webhook.
    
    const authHeader = request.headers.get("Authorization");
    const secret = Deno.env.get("CLEANUP_SECRET");
    
    // Simple security check if secret is configured
    if (secret && authHeader !== `Bearer ${secret}`) {
        return new Response("Unauthorized", { status: 401 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); // Need Service Role for deletion
    
    if (!supabaseUrl || !supabaseServiceKey) {
        return new Response("Supabase configuration missing", { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const BUCKET_NAME = "public-documents";
    const TTL_DAYS = 30; // Protect files for 30 days
    const MIN_FILES_PER_ROOM = 10; // Always keep the last 10 files per room

    try {
        // 1. List all files in 'temp'
        const { data: files, error: listError } = await supabase.storage
            .from(BUCKET_NAME)
            .list('temp', { limit: 1000 }); // Increase limit to see more files

        if (listError) throw listError;

        if (!files || files.length === 0) {
            return new Response(JSON.stringify({ message: "No files to cleanup" }), {
                headers: { "Content-Type": "application/json" }
            });
        }

        const now = new Date();
        const filesByRoom = {};

        // Group files by room (based on filename prefix)
        files.forEach(file => {
            // New format: roomid_timestamp_random.webm
            // Old format: vocal_timestamp_random.webm
            const parts = file.name.split('_');
            const roomName = parts.length > 2 ? parts[0] : 'legacy';
            
            if (!filesByRoom[roomName]) filesByRoom[roomName] = [];
            filesByRoom[roomName].push(file);
        });

        const filesToDelete = [];

        Object.keys(filesByRoom).forEach(room => {
            const roomFiles = filesByRoom[room];
            
            // Sort by creation date (newest first)
            roomFiles.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            roomFiles.forEach((file, index) => {
                const created = new Date(file.created_at);
                const ageDays = (now - created) / (1000 * 60 * 60 * 24);

                // Delete if older than TTL AND not within the "protected" last N files
                if (ageDays > TTL_DAYS && index >= MIN_FILES_PER_ROOM) {
                    filesToDelete.push(`temp/${file.name}`);
                }
            });
        });

        if (filesToDelete.length === 0) {
            return new Response(JSON.stringify({ message: "No expired files found (protected by TTL or Min Count)" }), {
                headers: { "Content-Type": "application/json" }
            });
        }

        // 2. Delete expired files
        const { error: deleteError } = await supabase.storage
            .from(BUCKET_NAME)
            .remove(filesToDelete);

        if (deleteError) throw deleteError;

        return new Response(JSON.stringify({ 
            message: `Cleanup successful`, 
            deleted_count: filesToDelete.length,
            files: filesToDelete
        }), {
            headers: { "Content-Type": "application/json" }
        });

    } catch (error) {
        console.error("Cleanup Error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
};

export const config = {
    path: "/api/admin/cleanup-storage",
};
