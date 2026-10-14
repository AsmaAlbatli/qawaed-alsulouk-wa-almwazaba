# -*- coding: utf-8 -*-
"""
توليد أيقونات تطبيق المنصة (PWA) بالهوية نفسها: أخضر وزارة التعليم + درع علامة نجاح.
الشكل محايد لغويًا حتى يظهر صحيحًا على كل الأجهزة.
شغّل:  python tools/make-icons.py
"""
import os
from PIL import Image, ImageDraw

BASE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(BASE, '..', 'assets', 'img'))
os.makedirs(OUT, exist_ok=True)

SS = 4
GREEN_D = (11, 107, 74)
GREEN_L = (15, 138, 95)
GOLD = (199, 154, 60)
WHITE = (255, 255, 255)


def gradient(w, h, c1, c2):
    img = Image.new('RGB', (w, h), c1)
    d = ImageDraw.Draw(img)
    span = max(1, (w + h) // 2)
    for i in range(span):
        t = i / span
        col = tuple(int(c1[k] + (c2[k] - c1[k]) * t) for k in range(3))
        d.line([(0, i), (i, i)], fill=col)
        d.line([(i, 0), (i, h)], fill=col)
    return img


def shield_pts(cx, cy, w, h):
    x0 = cx - w / 2.0
    y0 = cy - h / 2.0
    return [
        (x0,        y0),
        (x0 + w,    y0),
        (x0 + w,    y0 + h * 0.50),
        (cx,        y0 + h),
        (x0,        y0 + h * 0.50),
    ]


def rounded_mask(size, radius):
    m = Image.new('L', (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size - 1, size - 1],
                                        radius=radius, fill=255)
    return m


def make_icon(px, maskable=False):
    S = px * SS
    img = gradient(S, S, GREEN_L, GREEN_D)
    d = ImageDraw.Draw(img)

    d.arc([-S * 0.32, -S * 0.66, S * 1.32, S * 0.94],
          start=202, end=338, fill=GOLD, width=max(2, int(S * 0.030)))

    # maskable icons keep everything inside the 80% safe zone
    k = 0.74 if maskable else 0.92
    sw, sh = S * 0.44 * k, S * 0.56 * k
    cx, cy = S / 2.0, S * 0.53
    d.polygon(shield_pts(cx, cy, sw, sh), fill=WHITE)

    lw = max(2, int(S * (0.048 if not maskable else 0.036)))
    chk = [(cx - sw * 0.22, cy + sh * 0.01),
           (cx - sw * 0.05, cy + sh * 0.17),
           (cx + sw * 0.24, cy - sh * 0.16)]
    d.line(chk, fill=GREEN_D, width=lw, joint='curve')

    radius = int(S * (0.5 if maskable else 0.22))
    out = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    out.paste(img.convert('RGB'), (0, 0), rounded_mask(S, radius))
    return out.resize((px, px), Image.LANCZOS)


def make_og(px=1200, py=630):
    W, H = px * 2, py * 2
    img = gradient(W, H, GREEN_L, GREEN_D)
    d = ImageDraw.Draw(img)
    d.arc([-W * 0.18, -H * 1.35, W * 1.18, H * 0.58],
          start=202, end=338, fill=GOLD, width=int(H * 0.026))
    sw, sh = H * 0.42, H * 0.54
    d.polygon(shield_pts(W * 0.20, H * 0.52, sw, sh), fill=WHITE)
    lw = int(H * 0.045)
    d.line([(W * 0.20 - sw * 0.22, H * 0.52),
            (W * 0.20 - sw * 0.05, H * 0.52 + sh * 0.16),
            (W * 0.20 + sw * 0.24, H * 0.52 - sh * 0.15)],
           fill=GREEN_D, width=lw, joint='curve')
    return img.resize((px, py), Image.LANCZOS).convert('RGB')


def main():
    for name, px, msk in [
        ('icon-192.png',           192, False),
        ('icon-512.png',           512, False),
        ('icon-maskable-192.png',  192, True),
        ('icon-maskable-512.png',  512, True),
        ('apple-touch-icon.png',   180, False),
        ('favicon-32.png',          32, False),
        ('favicon-16.png',          16, False),
    ]:
        make_icon(px, msk).save(os.path.join(OUT, name), 'PNG')
        print('  %-24s %4d px' % (name, px))

    make_icon(64).convert('RGBA').save(
        os.path.join(OUT, 'favicon.ico'),
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
    print('  %-24s multi' % 'favicon.ico')

    make_og().save(os.path.join(OUT, 'og-cover.png'), 'PNG')
    print('  %-24s 1200x630' % 'og-cover.png')

    print('\nتم إنشاء الأيقونات في:', OUT)


if __name__ == '__main__':
    main()