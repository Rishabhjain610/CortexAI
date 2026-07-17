import s3 from "../config/s3.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getDownloadUrl } from "./getDownloadUrl.js";

// AWS S3 bucket par file upload karne ka core helper module.
export const uploadToS3 = async (filename, filebuffer, mimeType) => {
    // Inputs validate kar rahe hain taaki unhandled exceptions na aayen
    if (!filename || !filebuffer) {
        throw new Error("Filename aur File Buffer dono parameters required hain uploadToS3 ke liye!");
    }
    
    const bucketName = process.env.AWS_S3_BUCKET_NAME;
    if (!bucketName) {
        throw new Error("AWS_S3_BUCKET_NAME environment variable undefined hai!");
    }

    try {
        // Space aur special characters remove karne ke liye filename sanitize kar rahe hain
        const sanitizedFilename = filename
            .replace(/\s+/g, '-')
            .replace(/[^a-zA-Z0-9.-]/g, '');

        const fileKey = `uploads/${Date.now()}-${sanitizedFilename}`;
        const contentType = mimeType || "application/octet-stream";

        console.log(`Starting S3 upload: key=${fileKey}, type=${contentType}`);

        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: fileKey,
            Body: filebuffer,
            ContentType: contentType,
        });

        // Client send method execute kar rahe hain
        await s3.send(command);

        // Naye getDownloadUrl utility ka use karke presigned URL generate kiya
        const presignedUrl = await getDownloadUrl(fileKey);
        console.log(`S3 upload completed, generated presigned URL: ${presignedUrl}`);
        
        return presignedUrl;
    } catch (error) {
        console.error("S3 upload operations failed:", error);
        throw new Error("S3 file upload failed: " + error.message);
    }
};