import { authenticateEmployeeRequest, isEmployeeAuthorization } from '@/lib/employee-server';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

export async function POST(request: Request) {
  try {
    const auth = await authenticateEmployeeRequest(request);
    if (!isEmployeeAuthorization(auth)) {
      return auth;
    }

    const { user, service } = auth;

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return Response.json({ error: 'No image file uploaded' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return Response.json({ error: 'File size exceeds the 10 MB limit' }, { status: 400 });
    }

    const ext = ALLOWED_MIME_TYPES[file.type];
    if (!ext) {
      return Response.json(
        { error: 'Invalid file format. Please upload JPG, PNG, WebP, GIF, or AVIF.' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `articles/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

    // Upload to Supabase Storage bucket 'article-images'
    const { error: uploadError } = await service.storage
      .from('article-images')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('Supabase storage upload error:', uploadError);
      return Response.json(
        { error: uploadError.message || 'Failed to upload image to storage' },
        { status: 500 }
      );
    }

    const { data: urlData } = service.storage
      .from('article-images')
      .getPublicUrl(storagePath);

    const publicUrl = urlData.publicUrl;

    // Record in media_assets if table exists
    try {
      await service.from('media_assets').insert({
        storage_bucket: 'article-images',
        storage_path: storagePath,
        public_url: publicUrl,
        mime_type: file.type,
        file_size_bytes: file.size,
        status: 'published',
        uploaded_by: user.id,
      });
    } catch (e) {
      // Non-blocking if media_assets insert fails
      console.warn('Failed to insert into media_assets catalog:', e);
    }

    // Write audit log
    try {
      await service.from('audit_logs').insert({
        actor_profile_id: user.id,
        action: 'article.image_uploaded',
        target_type: 'storage_object',
        target_id: null,
        result: 'success',
        reason: 'Staff uploaded image from system',
        details: {
          file_name: sanitizedName,
          storage_path: storagePath,
          file_size: file.size,
          mime_type: file.type,
        },
      });
    } catch (auditErr) {
      console.warn('Failed to insert audit log for image upload:', auditErr);
    }

    return Response.json({
      success: true,
      url: publicUrl,
      storage_path: storagePath,
      name: file.name,
      size: file.size,
      mime_type: file.type,
    });
  } catch (err: unknown) {
    console.error('Error in POST /api/upload:', err);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
