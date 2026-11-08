"""Generate PWA icons (PNG) from the same design as icon.svg.
Run with the bundled Python (Pillow available).
"""
from PIL import Image, ImageDraw

S = 1024
TOP = (11, 111, 196)
BOTTOM = (0, 88, 163)
BRAND = (0, 88, 163)
WHITE = (255, 255, 255)
YELLOW = (255, 194, 32)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def build(rounded=True):
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    grad = Image.new("RGB", (1, S))
    for y in range(S):
        grad.putpixel((0, y), lerp(TOP, BOTTOM, y / (S - 1)))
    grad = grad.resize((S, S))
    if rounded:
        mask = Image.new("L", (S, S), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.219), fill=255)
        img.paste(grad, (0, 0), mask)
    else:
        img.paste(grad, (0, 0))

    d = ImageDraw.Draw(img)
    k = S / 512.0

    def r(x, y, w, h, rad, fill):
        d.rounded_rectangle([x * k, y * k, (x + w) * k, (y + h) * k], radius=rad * k, fill=fill)

    r(152, 120, 208, 292, 40, WHITE)   # clipboard
    r(204, 92, 104, 64, 24, YELLOW)    # clip

    pts = [(196 * k, 278 * k), (236 * k, 318 * k), (318 * k, 228 * k)]
    w = int(30 * k)
    d.line(pts, fill=BRAND, width=w, joint="curve")
    for p in (pts[0], pts[-1]):
        rad = w / 2
        d.ellipse([p[0] - rad, p[1] - rad, p[0] + rad, p[1] + rad], fill=BRAND)
    return img


def main():
    rounded = build(True)
    square = build(False)
    out = "icons"
    rounded.resize((512, 512), Image.LANCZOS).save(f"{out}/icon-512.png")
    rounded.resize((192, 192), Image.LANCZOS).save(f"{out}/icon-192.png")
    square.resize((512, 512), Image.LANCZOS).save(f"{out}/icon-maskable-512.png")
    square.resize((180, 180), Image.LANCZOS).save(f"{out}/apple-touch-icon.png")
    print("icons written")


if __name__ == "__main__":
    main()
