# -*- coding: utf-8 -*-
"""
استخراج شعار وزارة التعليم الرسمي من ملف الدليل نفسه، ثم إنتاج نسختين:
  - بيضاء  (خلفية شفافة) للترويسة الداكنة
  - خضراء (خلفية شفافة) للخلفيات الفاتحة
الشكل الأصلي محفوظ بدقة — نغيّر اللون فقط عبر قناة الشفافية.

المصدر: assets/files/moe-rules-1447.pdf  (صورة مضمّنة xref 47 في ٧٤ صفحة)
شغّل:  python tools/make-logo.py
"""
import os

from PIL import Image

BASE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(BASE, '..', 'assets', 'img'))
PDF_LOGO = os.path.normpath(
    os.path.join(BASE, '..', 'assets', 'files', 'moe-rules-1447.pdf'))
CACHE = os.path.join(BASE, '_logo-source.png')

SCALE = 3          # تكبير للدقة العالية (الشاشة الكثافة)


def load_source():
    """يستخرج الشعار من الـPDF مع قناع الشفافية المنفصل (SMask)"""
    if os.path.isfile(CACHE):
        return Image.open(CACHE).convert('RGBA')

    import fitz
    doc = fitz.open(PDF_LOGO)
    counts = {}
    for pno in range(doc.page_count):
        for im in doc[pno].get_images(full=True):
            counts[im[0]] = counts.get(im[0], 0) + 1
    # الشعار هو الصورة الأكثر تكرارًا
    xref = max(counts, key=counts.get)

    info = doc.extract_image(xref)
    tmp = os.path.join(BASE, '_logo_tmp.' + info['ext'])
    with open(tmp, 'wb') as f:
        f.write(info['image'])
    base = Image.open(tmp).convert('RGB')
    os.remove(tmp)

    # الشفافية محفوظة في SMask منفصل — بدونه تكون الخلفية معتمة
    smask = info.get('smask')
    if smask:
        m = doc.extract_image(smask)
        tmp2 = os.path.join(BASE, '_logo_mask.' + m['ext'])
        with open(tmp2, 'wb') as f:
            f.write(m['image'])
        mask = Image.open(tmp2).convert('L').resize(base.size, Image.LANCZOS)
        os.remove(tmp2)
        img = Image.merge('RGBA', (*base.split(), mask))
    else:
        img = base.convert('RGBA')

    img.save(CACHE)
    return img


def recolor(src, hex_color):
    """يحافظ على قناة الشفافية ويغيّر لون البكسلات فقط"""
    r, g, b = (int(hex_color[i:i + 2], 16) for i in (1, 3, 5))
    out = Image.new('RGBA', src.size, (r, g, b, 0))
    out.putalpha(src.getchannel('A'))
    return out


def main():
    src = load_source()
    if src.width * SCALE > 900:
        src = src.resize((src.width * SCALE, src.height * SCALE), Image.LANCZOS)
    else:
        src = src.resize((src.width * SCALE, src.height * SCALE), Image.LANCZOS)

    print('  المصدر: %dx%d  (مضخّم إلى %dx%d)' %
          (src.width // SCALE, src.height // SCALE, src.width, src.height))

    for name, color in [('logo-moe-white.png', '#FFFFFF'),
                        ('logo-moe-green.png', '#0F8A5F'),
                        ('logo-moe-dark.png', '#0B3B6F')]:
        recolor(src, color).save(os.path.join(OUT, name))
        print('  %-22s  لون %s' % (name, color))

    print('\nتم إنشاء الشعار في:', OUT)


if __name__ == '__main__':
    main()