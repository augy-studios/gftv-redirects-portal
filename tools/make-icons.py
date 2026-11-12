# GFTV.asia Link Shortener app icon. Flat, in the GFTV icon family shared with
# OneLink GFTV (OLG-*.png in gftv-linktree): a glyph over the multicolour GFTV
# wordmark, every shape outlined, on the #fedc00 background.
#
# The glyph is the short link mark this app has always used, a cloud with a
# chain link under it, redrawn for the yellow ground. The chain gets a white
# halo the way the OneLink chain does. The old mark's sparkles are gone: they
# sat off to one side and pulled the artwork off centre.
#
# Everything is drawn on a transparent layer at 4x and only then scaled down,
# so curves are antialiased. Every shape is drawn on one vertical centre
# line, and the artwork is centred on the icon by its painted extent, exactly
# on both axes, in two framings:
#
#   any       every painted pixel sits inside a centred circle of ANY_RADIUS,
#             so the icon survives being cropped to a circle (round avatars,
#             link previews, launchers that ignore "maskable") with nothing
#             cut off. Used for the browser tab, the desktop install icon, iOS
#             and the og:image.
#   maskable  every painted pixel sits inside a centred circle of 40% radius,
#             the maskable safe zone, so Android can crop the icon to a
#             circle, squircle or anything else with nothing cut off.
#
# Outputs, all in the project root:
#
#   gsl-main.png            2250, any        og:image on the 404 page
#   gsl-512.png             512,  any        manifest
#   gsl-192.png             192,  any        manifest
#   gsl-180.png             180,  any        apple-touch-icon
#   gsl-512-maskable.png    512,  maskable   manifest
#   gsl-192-maskable.png    192,  maskable   manifest
#   favicon.ico             16/32/48/64/128/256, any
#
# Usage, from the project root:
#
#   python3 tools/make-icons.py [font.ttf]
#
# The wordmark font is Archivo Black, a heavy grotesque in the same mould as
# the Arial Black OneLink uses, free under the OFL from
# https://fonts.google.com/specimen/Archivo+Black. The shipped icons were
# drawn with it. Pass its path as the argument, set GSL_ICON_FONT, or drop
# ArchivoBlack-Regular.ttf into tools/ (it is not committed). Arial Black is
# the fallback when none of those exist.
import math
import os
import sys
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Design units. Coordinates below are written for a 1024 canvas and drawn at
# K times that, so the downscale does the antialiasing.
S = 1024
K = 4

BG = '#fedc00'
INK = '#2e2800'        # outline colour for the wordmark, as in OneLink
WHITE = '#ffffff'
BLUE = '#2cabe1'       # cloud blue, shared with OneLink
BLUE_MID = '#b5e2f7'
BLUE_LIGHT = '#e1f3fc'
GOLD = '#ffc00e'       # chain gold, shared with OneLink
GOLD_DARK = '#f39a11'
GOLD_LIGHT = '#ffebb2'
WORD = ['#fd0000', '#ffda00', '#17ad1b', '#1a8cff']

# Both radii are fractions of the icon's width. The inscribed circle is 0.50;
# ANY_RADIUS leaves a margin inside it so a circular crop never touches ink.
ANY_RADIUS = 0.45
SAFE_RADIUS = 0.40
FONT_CANDIDATES = [
    os.environ.get('GSL_ICON_FONT'),
    os.path.join(ROOT, 'tools', 'ArchivoBlack-Regular.ttf'),
    'C:/Windows/Fonts/ariblk.ttf',
    '/Library/Fonts/Arial Black.ttf',
    '/System/Library/Fonts/Supplemental/Arial Black.ttf',
    '/usr/share/fonts/truetype/msttcorefonts/Arial_Black.ttf',
]


def find_font():
    if len(sys.argv) > 1:
        return sys.argv[1]
    for path in FONT_CANDIDATES:
        if path and os.path.exists(path):
            return path
    sys.exit('No wordmark font found. Pass Archivo Black (or Arial Black): '
             'python3 tools/make-icons.py path/to/font.ttf')


def u(v):
    """Design units to drawing pixels."""
    return round(v * K)


def box(x0, y0, x1, y1):
    return (u(x0), u(y0), u(x1), u(y1))


def circle(d, cx, cy, r, fill):
    d.ellipse(box(cx - r, cy - r, cx + r, cy + r), fill=fill)


def cloud(d, inset, fill):
    """The cloud silhouette, grown or shrunk by `inset` design units, so one
    shape can be stacked as outline, middle band and face."""
    g = -inset
    # A flat bottom between the two end bumps, which are tangent to it, so
    # the outline runs smoothly round both bottom corners.
    d.rectangle(box(372, 330 - g, 648, 450 + g), fill=fill)
    circle(d, 372, 372, 78 + g, fill)    # left bump
    circle(d, 498, 290, 120 + g, fill)   # big middle bump
    circle(d, 648, 362, 88 + g, fill)    # right bump


def chain(d):
    """Two chain links joined by a bar, on one white halo like a sticker."""
    cy = 540
    h = 100          # link height
    w = 168          # link width
    gap = 28
    band = 24
    halo = 16
    left = 512 - w - gap / 2
    right = 512 + gap / 2
    d.rounded_rectangle(box(left - halo, cy - h / 2 - halo, right + w + halo, cy + h / 2 + halo),
                        radius=u(h / 2 + halo), fill=WHITE)
    for a in (left, right):
        d.rounded_rectangle(box(a, cy - h / 2, a + w, cy + h / 2), radius=u(h / 2), fill=GOLD)
        d.rounded_rectangle(box(a + band, cy - h / 2 + band, a + w - band, cy + h / 2 - band),
                            radius=u(h / 2 - band), fill=GOLD_LIGHT)
    # The bar runs from inside one link to inside the other, over both bands.
    bar = 13
    d.rounded_rectangle(box(left + w / 2, cy - bar, right + w / 2, cy + bar), radius=u(bar), fill=GOLD_DARK)


def wordmark(layer, font_path):
    """GFTV, one colour per letter, each outlined so the yellow F reads on
    the yellow ground. Drawn on its own layer and then centred on x = 512 by
    its inked extent, because glyph advance widths are not symmetric."""
    font = ImageFont.truetype(font_path, u(172))
    word = Image.new('RGBA', layer.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(word)
    x = 0
    for ch, colour in zip('GFTV', WORD):
        d.text((x, u(628)), ch, font=font, fill=colour, stroke_width=u(9), stroke_fill=INK)
        x += d.textlength(ch, font=font) + u(4)
    x0, _, x1, _ = word.getbbox()
    layer.alpha_composite(word, (round(u(S / 2) - (x0 + x1) / 2), 0))


def draw_artwork(font_path):
    layer = Image.new('RGBA', (u(S), u(S)), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)

    cloud(d, -22, BLUE)        # outline
    cloud(d, 0, BLUE_MID)      # middle band
    cloud(d, 22, BLUE_LIGHT)   # face

    chain(d)
    wordmark(layer, font_path)
    return layer


def painted(layer):
    """Crop to the painted pixels, widened where needed so the crop is
    symmetric about the vertical centre line (x = 512) every shape is drawn
    on. Centring the crop then centres the artwork exactly: vertically by its
    painted extent, horizontally on its axis."""
    x0, y0, x1, y1 = layer.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
    axis = u(S / 2)
    half = max(axis - x0, x1 - axis)
    return layer.crop((axis - half, y0, axis + half, y1))


def farthest_from_centre(art):
    """Distance from the crop's centre to its farthest painted pixel, sampled
    on a reduced copy because the full one is tens of millions of pixels."""
    step = 4
    small = art.getchannel('A').resize((art.width // step, art.height // step))
    px = small.load()
    ox, oy = small.width / 2, small.height / 2
    far = 0.0
    for y in range(small.height):
        for x in range(small.width):
            if px[x, y] > 8:
                far = max(far, math.hypot(abs(x + 0.5 - ox) + 0.5, abs(y + 0.5 - oy) + 0.5))
    return far * step


def compose(art, size, scale):
    """Scale the cropped artwork and centre it on a BG square of `size`."""
    w, h = round(art.width * scale), round(art.height * scale)
    scaled = art.resize((w, h), Image.LANCZOS)
    icon = Image.new('RGBA', (size, size), BG)
    icon.alpha_composite(scaled, ((size - w) // 2, (size - h) // 2))
    return icon.convert('RGB')


def render():
    art = painted(draw_artwork(find_font()))
    far = farthest_from_centre(art)
    any_scale = ANY_RADIUS / far          # per unit of icon size
    mask_scale = SAFE_RADIUS / far

    def any_icon(size):
        return compose(art, size, any_scale * size)

    def mask_icon(size):
        return compose(art, size, mask_scale * size)

    out = lambda name: os.path.join(ROOT, name)
    any_icon(2250).save(out('gsl-main.png'), optimize=True)
    for size in (512, 192, 180):
        any_icon(size).save(out(f'gsl-{size}.png'), optimize=True)
    for size in (512, 192):
        mask_icon(size).save(out(f'gsl-{size}-maskable.png'), optimize=True)
    any_icon(256).save(out('favicon.ico'),
                       sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    print(f'artwork {art.width}x{art.height} at {K}x; '
          f'any fits a {ANY_RADIUS:.0%} circle, maskable a {SAFE_RADIUS:.0%} one')


render()
