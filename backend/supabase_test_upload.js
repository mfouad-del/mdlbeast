// Supabase test upload script — DEPRECATED
// Project has migrated to Cloudflare R2-only. Do not run this script.
console.error('Supabase tests deprecated: project is R2-only')
process.exit(1)

;(async () => {
  try {
    const supabase = createClient(url, key, { auth: { persistSession: false } })
    const path = 'backend/test2.pdf'
    const body = fs.readFileSync(path)
    const keyName = `uploads/test-supabase-${Date.now()}.pdf`
    console.log('Uploading to bucket', bucket, 'key', keyName)
    const { data, error } = await supabase.storage.from(bucket).upload(keyName, body, { contentType: 'application/pdf' })
    if (error) {
      console.error('Supabase upload error:', error)
      // Try to get bucket list or info
      try {
        const { data: list, error: listErr } = await supabase.storage.from(bucket).list('uploads')
        console.log('Bucket list result:', { list, listErr })
      } catch (e) {}
      process.exit(1)
    }

    console.log('Upload data:', data)
    const { data: pub, error: pubErr } = supabase.storage.from(bucket).getPublicUrl(keyName)
    console.log('Public URL result:', { pub, pubErr })
    process.exit(0)
  } catch (err) {
    console.error('Unexpected error:', err)
    process.exit(1)
  }
})()
