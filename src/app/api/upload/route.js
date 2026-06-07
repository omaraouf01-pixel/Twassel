// ══════════════════════════════════════════════════════════════════════
// POST /api/upload — رفع الملفات إلى Cloudinary
// ──────────────────────────────────────────────────────────────────────
// يستقبل FormData يحتوي على:
//   file:   الملف المراد رفعه
//   folder: مجلد Cloudinary (الافتراضي: tawassol/groups)
//
// يُحدّد resource_type تلقائياً:
//   - الصور  → "image"
//   - باقي الملفات (PDF، ZIP...) → "raw"
//     (سبب: Cloudinary يرفض تسليم PDF بـ resource_type=image افتراضياً)
//
// يعيد: { url, publicId, resourceType }
// ══════════════════════════════════════════════════════════════════════

import { v2 as cloudinary } from 'cloudinary';
import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/withAuth';

// ربط بيانات Cloudinary من متغيرات البيئة
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * POST /api/upload
 * يتطلب: JWT صالح (withAuth) + FormData مع حقل "file".
 */
export const POST = withAuth(async (req) => {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const folder = formData.get('folder') || 'tawassol/groups';

    if (!file) {
      return NextResponse.json({ error: "لم يتم اختيار ملف" }, { status: 400 });
    }

    // تحويل الملف إلى Buffer قابل للإرسال عبر stream
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // ملفات PDF/المستندات تُرفع كـ raw لتجاوز قيود Cloudinary الأمنية
    // على resource_type=image (الذي يُصنَّف فيه PDF افتراضياً عند auto)
    const isImage = file.type?.startsWith("image/");
    const resourceType = isImage ? "image" : "raw";

    // رفع الملف عبر stream (لا يدعم Cloudinary SDK الرفع المباشر من Buffer في Node.js)
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: resourceType,
          use_filename: true,     // استخدام اسم الملف الأصلي
          unique_filename: true,  // إضافة hash لتجنب التضارب
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(buffer);
    });

    // إعادة الرابط الآمن (HTTPS) ومعرّف الملف في Cloudinary
    return NextResponse.json({
      url: result.secure_url,
      publicId: result.public_id,
      resourceType,
    });

  } catch (error) {
    console.error("Upload API Error:", error);
    return NextResponse.json({ error: "فشل الرفع: " + error.message }, { status: 500 });
  }
}, "UPLOAD");