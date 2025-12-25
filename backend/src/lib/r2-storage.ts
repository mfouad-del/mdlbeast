import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import stream from "stream";
import { promisify } from "util";

const BUCKET = process.env.CF_R2_BUCKET || '';
const ENDPOINT = (process.env.CF_R2_ENDPOINT || '').replace(/\/$/, '');
const REGION = process.env.CF_R2_REGION || 'auto';

const s3 = new S3Client({
  region: REGION,
  endpoint: ENDPOINT || undefined,
  credentials: {
    accessKeyId: process.env.CF_R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.CF_R2_SECRET_ACCESS_KEY || '',
  },
  forcePathStyle: false,
});

export async function uploadBuffer(key: string, buf: Buffer, contentType = "application/pdf", cacheControl = "public, max-age=0") {
  if (!BUCKET) throw new Error('CF_R2_BUCKET not configured')
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buf,
    ContentType: contentType,
    CacheControl: cacheControl,
  }));
  return getPublicUrl(key);
}

export function getPublicUrl(key: string) {
  if (!ENDPOINT) throw new Error('CF_R2_ENDPOINT not configured')
  return `${ENDPOINT}/${BUCKET}/${encodeURIComponent(key)}`;
}

export async function getSignedDownloadUrl(key: string, expiresSeconds = 300) {
  if (!BUCKET) throw new Error('CF_R2_BUCKET not configured')
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, cmd, { expiresIn: expiresSeconds });
}

async function streamToBuffer(readable: any) {
  if (typeof readable?.transformToByteArray === 'function') {
    const arr = await readable.transformToByteArray()
    return Buffer.from(arr)
  }
  const chunks: Buffer[] = [];
  return new Promise<Buffer>((resolve, reject) => {
    readable.on('data', (chunk: any) => chunks.push(Buffer.from(chunk)));
    readable.on('error', reject);
    readable.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

export async function downloadToBuffer(key: string) {
  if (!BUCKET) throw new Error('CF_R2_BUCKET not configured')
  const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
  const Body = (res as any).Body
  if (!Body) throw new Error('Empty body from R2')
  const buf = await streamToBuffer(Body)
  return buf
}

export async function deleteObject(key: string) {
  if (!BUCKET) throw new Error('CF_R2_BUCKET not configured')
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
}
