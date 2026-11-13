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
# SUPERSAMPLE times that, so the downscale does the antialiasing.
CANVAS_SIZE = 1024
SUPERSAMPLE = 4

BACKGROUND = '#fedc00'
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
    """Return the path of the wordmark font: the command-line argument if
    given, otherwise the first candidate that exists. Exits with a message
    when none is found."""
    if len(sys.argv) > 1:
        return sys.argv[1]
    for path in FONT_CANDIDATES:
        if path and os.path.exists(path):
            return path
    sys.exit('No wordmark font found. Pass Archivo Black (or Arial Black): '
             'python3 tools/make-icons.py path/to/font.ttf')


def to_pixels(units):
    """Design units to drawing pixels."""
    return round(units * SUPERSAMPLE)


def box(left, top, right, bottom):
    """A bounding box given in design units, returned in drawing pixels."""
    return (to_pixels(left), to_pixels(top), to_pixels(right), to_pixels(bottom))


def circle(draw, centre_x, centre_y, radius, fill):
    """Draw a filled circle, with its centre and radius in design units."""
    draw.ellipse(box(centre_x - radius, centre_y - radius, centre_x + radius, centre_y + radius), fill=fill)


def cloud(draw, inset, fill):
    """The cloud silhouette, grown or shrunk by `inset` design units, so one
    shape can be stacked as outline, middle band and face."""
    grow = -inset
    # A flat bottom between the two end bumps, which are tangent to it, so
    # the outline runs smoothly round both bottom corners.
    draw.rectangle(box(372, 330 - grow, 648, 450 + grow), fill=fill)
    circle(draw, 372, 372, 78 + grow, fill)    # left bump
    circle(draw, 498, 290, 120 + grow, fill)   # big middle bump
    circle(draw, 648, 362, 88 + grow, fill)    # right bump


def chain(draw):
    """Two chain links joined by a bar, on one white halo like a sticker."""
    centre_y = 540
    link_height = 100
    link_width = 168
    gap = 28
    band = 24
    halo = 16
    left_link = 512 - link_width - gap / 2
    right_link = 512 + gap / 2
    draw.rounded_rectangle(
        box(left_link - halo, centre_y - link_height / 2 - halo,
            right_link + link_width + halo, centre_y + link_height / 2 + halo),
        radius=to_pixels(link_height / 2 + halo), fill=WHITE)
    for link_left in (left_link, right_link):
        draw.rounded_rectangle(
            box(link_left, centre_y - link_height / 2, link_left + link_width, centre_y + link_height / 2),
            radius=to_pixels(link_height / 2), fill=GOLD)
        draw.rounded_rectangle(
            box(link_left + band, centre_y - link_height / 2 + band,
                link_left + link_width - band, centre_y + link_height / 2 - band),
            radius=to_pixels(link_height / 2 - band), fill=GOLD_LIGHT)
    # The bar runs from inside one link to inside the other, over both bands.
    bar = 13
    draw.rounded_rectangle(
        box(left_link + link_width / 2, centre_y - bar, right_link + link_width / 2, centre_y + bar),
        radius=to_pixels(bar), fill=GOLD_DARK)


def wordmark(layer, font_path):
    """GFTV, one colour per letter, each outlined so the yellow F reads on
    the yellow ground. Drawn on its own layer and then centred on x = 512 by
    its inked extent, because glyph advance widths are not symmetric."""
    font = ImageFont.truetype(font_path, to_pixels(172))
    word = Image.new('RGBA', layer.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(word)
    x = 0
    for letter, colour in zip('GFTV', WORD):
        draw.text((x, to_pixels(628)), letter, font=font, fill=colour,
                  stroke_width=to_pixels(9), stroke_fill=INK)
        x += draw.textlength(letter, font=font) + to_pixels(4)
    left, _, right, _ = word.getbbox()
    layer.alpha_composite(word, (round(to_pixels(CANVAS_SIZE / 2) - (left + right) / 2), 0))


def draw_artwork(font_path):
    """Draw the whole artwork (cloud, chain and wordmark) on a transparent
    layer at SUPERSAMPLE times the design size."""
    layer = Image.new('RGBA', (to_pixels(CANVAS_SIZE), to_pixels(CANVAS_SIZE)), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)

    cloud(draw, -22, BLUE)        # outline
    cloud(draw, 0, BLUE_MID)      # middle band
    cloud(draw, 22, BLUE_LIGHT)   # face

    chain(draw)
    wordmark(layer, font_path)
    return layer


def alpha_to_mask(alpha_value):
    """Treat any alpha above 8 as painted (255) and the rest as empty (0)."""
    if alpha_value > 8:
        return 255
    return 0


def painted(layer):
    """Crop to the painted pixels, widened where needed so the crop is
    symmetric about the vertical centre line (x = 512) every shape is drawn
    on. Centring the crop then centres the artwork exactly: vertically by its
    painted extent, horizontally on its axis."""
    left, top, right, bottom = layer.getchannel('A').point(alpha_to_mask).getbbox()
    axis = to_pixels(CANVAS_SIZE / 2)
    half_width = max(axis - left, right - axis)
    return layer.crop((axis - half_width, top, axis + half_width, bottom))


def farthest_from_centre(art):
    """Distance from the crop's centre to its farthest painted pixel, sampled
    on a reduced copy because the full one is tens of millions of pixels."""
    step = 4
    small = art.getchannel('A').resize((art.width // step, art.height // step))
    pixel_access = small.load()
    centre_x, centre_y = small.width / 2, small.height / 2
    farthest = 0.0
    for y in range(small.height):
        for x in range(small.width):
            if pixel_access[x, y] > 8:
                farthest = max(farthest, math.hypot(abs(x + 0.5 - centre_x) + 0.5, abs(y + 0.5 - centre_y) + 0.5))
    return farthest * step


def compose(art, size, scale):
    """Scale the cropped artwork and centre it on a BACKGROUND square of `size`."""
    width, height = round(art.width * scale), round(art.height * scale)
    scaled = art.resize((width, height), Image.LANCZOS)
    icon = Image.new('RGBA', (size, size), BACKGROUND)
    icon.alpha_composite(scaled, ((size - width) // 2, (size - height) // 2))
    return icon.convert('RGB')


def render():
    """Draw the artwork once, then write every icon file into the project root."""
    art = painted(draw_artwork(find_font()))
    farthest = farthest_from_centre(art)
    any_scale = ANY_RADIUS / farthest          # per unit of icon size
    mask_scale = SAFE_RADIUS / farthest

    def any_icon(size):
        """The icon for the "any" purpose, at `size` pixels."""
        return compose(art, size, any_scale * size)

    def mask_icon(size):
        """The icon for the "maskable" purpose, at `size` pixels."""
        return compose(art, size, mask_scale * size)

    def output_path(name):
        """Where an output file goes: the project root."""
        return os.path.join(ROOT, name)

    any_icon(2250).save(output_path('gsl-main.png'), optimize=True)
    for size in (512, 192, 180):
        any_icon(size).save(output_path(f'gsl-{size}.png'), optimize=True)
    for size in (512, 192):
        mask_icon(size).save(output_path(f'gsl-{size}-maskable.png'), optimize=True)
    any_icon(256).save(output_path('favicon.ico'),
                       sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    print(f'artwork {art.width}x{art.height} at {SUPERSAMPLE}x; '
          f'any fits a {ANY_RADIUS:.0%} circle, maskable a {SAFE_RADIUS:.0%} one')


render()
