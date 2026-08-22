# Da3wa — دعوات أفراح إلكتروني

نظام دعوات أفراح إلكتروني: رابط شخصي لكل ضيف، تأكيد حضور بحد أقصى للمرافقين،
QR Code للدخول يوم الفرح عبر واتساب، سكانر للباب، وتقرير لحظي للعروسين.

## التشغيل محليًا

```bash
npm install
cp .env.example .env.local   # وعدّل القيم
npm run dev
```

بدون `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` هيستخدم ملف
`data/db.json` محلي. على Vercel لازم تضيف Upstash Redis عشان البيانات تفضل
محفوظة بين الطلبات.

## الصفحات

- `/admin` — لوحة تحكم العروسين (محمية بكلمة مرور `ADMIN_PASSWORD`)
- `/invite/[id]?t=token` — الدعوة الشخصية للضيف
- `/scan` — سكانر الباب (محمي بنفس كلمة المرور)

## واتساب (Wati)

الإرسال الحقيقي عبر [Wati](https://wati.io) — API endpoint + access token في
`WATI_API_ENDPOINT` / `WATI_ACCESS_TOKEN`. لازم Template معتمد من Meta لإرسال
أول رسالة (كود الـ QR) — اسم القالب في `WATI_QR_TEMPLATE_NAME`.
