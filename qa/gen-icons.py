"""Generate PWA icons: Sam's Club blue tile + white diamond + check.
Run with the bundled Python (Pillow available).
"""
from PIL import Image, ImageDraw

S = 1024
TOP = (10, 127, 184)
BOTTOM = (0, 103, 160)
BRAND = (0, 103, 160)
WHITE = (255, 255, 255)


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

    diamond = [(256 * k, 78 * k), (434 * k, 256 * k), (256 * k, 434 * k), (78 * k, 256 * k)]
    d.polygon(diamond, fill=WHITE)

    pts = [(172 * k, 258 * k), (230 * k, 316 * k), (346 * k, 194 * k)]
    w = int(40 * k)
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
