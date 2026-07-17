import s3 from "../config/s3.js";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// AWS S3 bucket se object read/download karne ke liye secure presigned URL helper.
export const getDownloadUrl = async (fileKey) => {
    if (!fileKey) {
        throw new Error("fileKey parameter required hai getDownloadUrl ke liye!");
    }

    const bucketName = process.env.AWS_S3_BUCKET_NAME;
    if (!bucketName) {
        throw new Error("AWS_S3_BUCKET_NAME environment variable undefined hai!");
    }

    try {
        const command = new GetObjectCommand({
            Bucket: bucketName,
            Key: fileKey,
        });

        // Signed URL duration sets to 7 days (604800 seconds)
        const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 604800 });
        return presignedUrl;
    } catch (error) {
        console.error("Failed to generate presigned URL:", error);
        throw new Error("Failed to generate presigned URL: " + error.message);
    }
};
