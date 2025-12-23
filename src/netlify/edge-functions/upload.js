// src/netlify/edge-functions/upload.js
import { S3Client, PutObjectCommand } from "https://esm.sh/@aws-sdk/client-s3";

export default async (request, context) => {
    // Basic Auth Check (Optionally check Supabase JWT)
    // For now, we rely on environment variables for security
    
    if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
    }

    try {
        const formData = await request.formData();
        const file = formData.get("file");
        const bucket = formData.get("bucket");
        const key = formData.get("key");
        const contentType = formData.get("contentType") || "application/octet-stream";

        if (!file || !bucket || !key) {
            return new Response("Missing parameters", { status: 400 });
        }

        const R2_ACCOUNT_ID = Netlify.env.get("R2_ACCOUNT_ID");
        const R2_ACCESS_KEY_ID = Netlify.env.get("R2_ACCESS_KEY_ID");
        const R2_SECRET_ACCESS_KEY = Netlify.env.get("R2_SECRET_ACCESS_KEY");
        const R2_PUBLIC_DOMAIN = Netlify.env.get("R2_PUBLIC_DOMAIN");

        if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
            return new Response("R2 not configured on server", { status: 500 });
        }

        const s3 = new S3Client({
            region: "auto",
            endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: R2_ACCESS_KEY_ID,
                secretAccessKey: R2_SECRET_ACCESS_KEY,
            },
        });

        const arrayBuffer = await file.arrayBuffer();

        await s3.send(new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: new Uint8Array(arrayBuffer),
            ContentType: contentType,
        }));

        const publicUrl = R2_PUBLIC_DOMAIN 
            ? `https://${R2_PUBLIC_DOMAIN}/${key}`
            : `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${bucket}/${key}`;

        return new Response(JSON.stringify({ 
            success: true, 
            url: publicUrl,
            path: key 
        }), {
            headers: { "Content-Type": "application/json" }
        });

    } catch (error) {
        console.error("R2 Upload Error:", error);
        return new Response(JSON.stringify({ error: error.message }), { 
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
};

export const config = {
    path: "/api/upload"
};
