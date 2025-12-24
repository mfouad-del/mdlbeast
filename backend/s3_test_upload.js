const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')
const fs = require('fs')

const key = process.env.S3_ACCESS_KEY || 'b1e9db6467095264b0ee9a7710db1758'
const secret = process.env.S3_SECRET_KEY || '25d614c3318d69637594bb2d269db869c7b2db127fb6cbcb4cf4f5f4012b7104'
const endpoint = process.env.S3_ENDPOINT || 'https://gomnynxfdmxoirmccqjf.storage.supabase.co/storage/v1/s3'
const region = process.env.S3_REGION || 'ap-southeast-1'
const bucket = process.env.S3_BUCKET || 'documents'

;(async () => {
  try {
    const client = new S3Client({ region, endpoint: endpoint.replace(/\/storage\/v1\/s3\/?$/,'') , forcePathStyle: true, credentials: { accessKeyId: key, secretAccessKey: secret } })
    const body = Buffer.from('test upload '+Date.now())
    const s3Key = `uploads/test-s3-${Date.now()}.txt`
    console.log('Uploading to', bucket, s3Key)
    const cmd = new PutObjectCommand({ Bucket: bucket, Key: s3Key, Body: body, ContentType: 'text/plain' })
    const res = await client.send(cmd)
    console.log('Upload result:', res)
    console.log('File URL:', `${endpoint}/${bucket}/${s3Key}`)
  } catch (err) {
    console.error('S3 upload error:', err)
    process.exit(1)
  }
})()
