import { S3Client } from '@aws-sdk/client-s3';

// AWS credentials setup check kar rahe hain, missing variables runtime par warn karenge.
if (!process.env.AWS_REGION || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.warn("WARNING: AWS S3 credentials environment variables me missing hain! S3 features fail ho sakte hain.");
}

// S3 Client object instance create kar rahe hain.
const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    }
});

export default s3;