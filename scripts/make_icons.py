"""Рисует PNG-иконки веб-приложения (iPhone «На экран Домой», Android Chrome, вкладка браузера)
из того же знака, что и иконка APK (android/res/drawable/ic_launcher_fg.xml).
  python scripts/make_icons.py      (нужен Pillow: pip install pillow)"""
import pathlib
from PIL import Image, ImageDraw

out = pathlib.Path(__file__).resolve().parent.parent / 'app' / 'icons'
out.mkdir(parents=True, exist_ok=True)
TEAL = (11, 110, 100, 255)
WHITE = (255, 255, 255, 255)
PATH = [(38, 70), (38, 38), (70, 70), (70, 38)]  # знак «N» в поле 108×108


def icon(size, glyph):
    """glyph — какую долю иконки занимает знак (у maskable меньше: края обрезает система)."""
    ss = 4  # рисуем крупнее и уменьшаем — гладкие края
    S = size * ss
    im = Image.new('RGBA', (S, S), TEAL)
    d = ImageDraw.Draw(im)
    k = S * glyph / 32  # знак 32×32 единицы (от 38 до 70)
    pts = [((x - 54) * k + S / 2, (y - 54) * k + S / 2) for x, y in PATH]
    w = 7 * k
    d.line(pts, fill=WHITE, width=round(w), joint='curve')
    r = w / 2
    for x, y in (pts[0], pts[-1]) + tuple(pts[1:-1]):
        d.ellipse((x - r, y - r, x + r, y + r), fill=WHITE)
    return im.resize((size, size), Image.LANCZOS)


icon(180, 0.46).save(out / 'apple-touch-icon.png', optimize=True)
icon(192, 0.46).save(out / 'icon-192.png', optimize=True)
icon(512, 0.46).save(out / 'icon-512.png', optimize=True)
icon(512, 0.34).save(out / 'icon-maskable-512.png', optimize=True)
icon(32, 0.56).save(out / 'favicon-32.png', optimize=True)
print('icons ->', out)
