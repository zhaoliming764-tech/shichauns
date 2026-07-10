import argparse
import json
from pathlib import Path

from PIL import Image, ImageFilter, ImageOps, ImageStat


def crop_norm(image, rect):
    w, h = image.size
    x1, y1, x2, y2 = rect
    return image.crop((round(x1 * w), round(y1 * h), round(x2 * w), round(y2 * h)))


def brightness(image):
    return ImageStat.Stat(image.convert("L")).mean[0]


def detail(image):
    edges = image.convert("L").filter(ImageFilter.FIND_EDGES)
    return ImageStat.Stat(edges).mean[0]


def review(image_path, contract_path, normalized_path=None):
    contract = json.loads(Path(contract_path).read_text(encoding="utf-8"))
    expected = (contract["canvas"]["width"], contract["canvas"]["height"])
    source = Image.open(image_path).convert("RGB")
    image = ImageOps.fit(source, expected, method=Image.Resampling.LANCZOS)
    if normalized_path:
        Path(normalized_path).parent.mkdir(parents=True, exist_ok=True)
        image.save(normalized_path, quality=96)

    limits = contract["review"]
    failures = []
    slots = {}
    for name, spec in contract["slots"].items():
        slot = crop_norm(image, spec["rect"])
        b = brightness(slot)
        inset = float(spec.get("safeInset", 0.08))
        safe = slot.crop((round(slot.width * inset), round(slot.height * inset), round(slot.width * (1 - inset)), round(slot.height * (1 - inset))))
        safe_detail = detail(safe)
        border_width = max(2, round(min(slot.size) * 0.08))
        inner = slot.crop((border_width, border_width, slot.width - border_width, slot.height - border_width))
        border_contrast = abs(brightness(slot) - brightness(inner))
        passed = True
        reasons = []
        if not limits["minBrightness"] <= b <= limits["maxBrightness"]:
            passed = False; reasons.append(f"brightness {b:.1f} outside range")
        if safe_detail > limits["maxSafeZoneDetail"]:
            passed = False; reasons.append(f"safe-zone detail {safe_detail:.1f} too high")
        if name != "board" and border_contrast < limits["minBorderContrast"]:
            passed = False; reasons.append(f"border contrast {border_contrast:.1f} too low")
        slots[name] = {"passed": passed, "brightness": round(b, 1), "safeZoneDetail": round(safe_detail, 1), "borderContrast": round(border_contrast, 1), "reasons": reasons}
        failures.extend(f"{name}: {reason}" for reason in reasons)

    return {
        "passed": not failures,
        "sourceSize": source.size,
        "normalizedSize": image.size,
        "slots": slots,
        "failures": failures,
        "retryFeedback": "Keep the exact slot geometry. " + "; ".join(failures[:8]) if failures else "",
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", required=True)
    parser.add_argument("--contract", default="ui-layout.json")
    parser.add_argument("--normalized")
    parser.add_argument("--report")
    args = parser.parse_args()
    report = review(args.image, args.contract, args.normalized)
    text = json.dumps(report, ensure_ascii=False, indent=2)
    if args.report:
        Path(args.report).parent.mkdir(parents=True, exist_ok=True)
        Path(args.report).write_text(text, encoding="utf-8")
    print(text)
    raise SystemExit(0 if report["passed"] else 2)


if __name__ == "__main__":
    main()
