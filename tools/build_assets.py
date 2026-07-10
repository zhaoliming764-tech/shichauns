import json
from pathlib import Path
from PIL import Image, ImageChops, ImageEnhance, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
PROCESSED = ASSETS / "processed"
CUTOUTS = ASSETS / "cutouts"
UI_CONTRACT = json.loads((ROOT / "ui-layout.json").read_text(encoding="utf-8"))

HEROES = [
    "ma-xinyu",
    "zeng-yupeng",
    "chen-haojie",
    "zeng-minjun",
    "li-jiale",
    "ren-tengfei",
    "gong-xinyi",
]

CARDS = [
    "proposal-strike",
    "quick-revision",
    "inspiration-supply",
    "client-demand",
    "deadline-night",
    "brainstorm",
    "drawing-tablet",
]


def ensure_dirs():
    PROCESSED.mkdir(parents=True, exist_ok=True)
    (PROCESSED / "heroes").mkdir(parents=True, exist_ok=True)
    (PROCESSED / "ui").mkdir(parents=True, exist_ok=True)
    (PROCESSED / "cards").mkdir(parents=True, exist_ok=True)


def crop_box_by_ratio(img, left, top, right, bottom):
    width, height = img.size
    return (
        round(width * left),
        round(height * top),
        round(width * right),
        round(height * bottom),
    )


def trim_green(slot):
    rgba = slot.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    alpha = Image.new("L", rgba.size, 0)
    alpha_pixels = alpha.load()

    for y in range(height):
        for x in range(width):
            r, g, b, _ = pixels[x, y]
            green_delta = g - max(r, b)
            is_key = g > 145 and green_delta > 48
            alpha_pixels[x, y] = 0 if is_key else 255

    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.55))
    # Generated sheets can leak a small piece of the neighboring character into
    # the slot edge. Clear a narrow gutter before trimming.
    gutter = max(10, round(width * 0.13))
    alpha_pixels = alpha.load()
    for y in range(height):
        for x in range(gutter):
            alpha_pixels[x, y] = 0
            alpha_pixels[width - 1 - x, y] = 0
    bbox = alpha.getbbox()
    if bbox:
        left, top, right, bottom = bbox
        pad_x = round(width * 0.06)
        pad_y = round(height * 0.04)
        bbox = (
            max(0, left - pad_x),
            max(0, top - pad_y),
            min(width, right + pad_x),
            min(height, bottom + pad_y),
        )
        rgba = rgba.crop(bbox)
        alpha = alpha.crop(bbox)

    rgba.putalpha(alpha)
    return rgba


def build_character_cutouts():
    sheet = Image.open(CUTOUTS / "heroes-green-sheet.png").convert("RGB")
    width, height = sheet.size
    slot_width = width / len(HEROES)
    for index, slug in enumerate(HEROES):
        left = round(index * slot_width)
        right = round((index + 1) * slot_width)
        slot = sheet.crop((left, 0, right, height))
        cutout = trim_green(slot)
        cutout.thumbnail((430, 620), Image.Resampling.LANCZOS)
        cutout.save(PROCESSED / "heroes" / f"{slug}.png")


def rounded_crop(img, radius=26):
    rgba = img.convert("RGBA")
    mask = Image.new("L", rgba.size, 0)
    mask_draw = Image.new("L", rgba.size, 0)
    ImageOps.expand(mask_draw, 0)
    from PIL import ImageDraw

    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, rgba.width - 1, rgba.height - 1), radius=radius, fill=255)
    rgba.putalpha(mask)
    return rgba


def build_ui_assets():
    ui = Image.open(ASSETS / "ui" / "table-ui-sheet.png").convert("RGB")
    crops = {
        "table-bg.jpg": crop_box_by_ratio(ui, 0.04, 0.08, 0.96, 0.88),
        "panel-parchment.jpg": crop_box_by_ratio(ui, 0.08, 0.13, 0.42, 0.76),
        "card-back.png": crop_box_by_ratio(ui, 0.63, 0.18, 0.78, 0.72),
        "phase-banner.png": crop_box_by_ratio(ui, 0.18, 0.05, 0.82, 0.2),
        "role-token.png": crop_box_by_ratio(ui, 0.77, 0.19, 0.9, 0.43),
    }
    for name, box in crops.items():
        crop = ui.crop(box)
        if name.endswith(".png"):
            crop = rounded_crop(crop, 24)
            crop.save(PROCESSED / "ui" / name)
        else:
            crop.save(PROCESSED / "ui" / name, quality=92)


def save_ui_crop(source, name, box, size, quality=94):
    crop = source.crop(crop_box_by_ratio(source, *box))
    crop = ImageOps.fit(crop, size, method=Image.Resampling.LANCZOS)
    target = PROCESSED / "ui" / name
    if target.suffix.lower() in {".jpg", ".jpeg"}:
        crop.convert("RGB").save(target, quality=quality, optimize=True)
    else:
        crop.convert("RGBA").save(target, optimize=True)
    return crop


def build_commercial_skin():
    master_path = ASSETS / "generated" / "ui-art-table-v4.png"
    if not master_path.exists():
        print(f"commercial skin skipped: missing {master_path}")
        return
    master = Image.open(master_path).convert("RGB")
    built = {}
    for name, spec in UI_CONTRACT["slots"].items():
        built[name] = save_ui_crop(master, spec["file"], tuple(spec["rect"]), tuple(spec["output"]))
    button = built["button"]
    red = ImageEnhance.Brightness(ImageEnhance.Color(button).enhance(1.65)).enhance(0.72)
    red.save(PROCESSED / "ui" / "skin-button-red.png", optimize=True)
    dark = ImageEnhance.Brightness(ImageEnhance.Color(button).enhance(0.35)).enhance(0.45)
    dark.save(PROCESSED / "ui" / "skin-button-dark.png", optimize=True)


def build_card_art():
    sheet = Image.open(ASSETS / "cards" / "card-art-sheet.png").convert("RGB")
    width, height = sheet.size
    slot_width = width / len(CARDS)
    for index, slug in enumerate(CARDS):
        left = round(index * slot_width)
        right = round((index + 1) * slot_width)
        slot = sheet.crop((left, 0, right, height))
        inner = slot.crop(crop_box_by_ratio(slot, 0.08, 0.06, 0.92, 0.94))
        inner = ImageOps.fit(inner, (360, 520), method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))
        inner.save(PROCESSED / "cards" / f"{slug}.jpg", quality=92)


def main():
    ensure_dirs()
    build_character_cutouts()
    build_ui_assets()
    build_commercial_skin()
    build_card_art()
    print("asset build complete")


if __name__ == "__main__":
    main()
