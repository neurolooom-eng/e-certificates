#!/usr/bin/env python3
"""
Certificate generator: overlays recipient data onto a template image.
Outputs individual PNG files and prints a JSON array to stdout.
"""
import argparse
import json
import os
import re
import sys

from PIL import Image, ImageDraw, ImageFont
import pandas as pd


def ordinal(n: int) -> str:
    n = int(n)
    if 11 <= (n % 100) <= 13:
        suffix = "th"
    else:
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suffix}"


def format_value(raw, fmt: str) -> str:
    if pd.isna(raw):
        return ""
    if fmt == "ordinal":
        return ordinal(raw)
    if fmt == "number":
        f = float(raw)
        return str(int(f)) if f == int(f) else str(f)
    return str(raw).strip()


def fit_text(draw, text, font_path, font_size, max_width, min_size=14):
    while font_size >= min_size:
        font = ImageFont.truetype(font_path, font_size)
        bbox = draw.textbbox((0, 0), text, font=font)
        if (bbox[2] - bbox[0]) <= max_width:
            return font, font_size
        font_size -= 1
    return ImageFont.truetype(font_path, min_size), min_size


def find_font() -> str:
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/liberation/LiberationSans-Bold.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]
    for p in candidates:
        if os.path.exists(p):
            return p
    raise FileNotFoundError("No bold TTF font found. Install fonts-dejavu or set CERT_FONT env var.")


def hex_to_rgb(hex_color: str):
    hex_color = hex_color.lstrip("#")
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))


def load_data(data_path: str, header_row: int) -> pd.DataFrame:
    df = pd.read_excel(data_path, header=None)
    # Filter: keep only rows where the first column in config is numeric
    # Use header_row as the actual header, rows below are data
    header = df.iloc[header_row].tolist()
    data = df.iloc[header_row + 1:].reset_index(drop=True)
    data.columns = range(len(data.columns))
    return data


def generate(template_path, data_path, config, output_dir, preview=False):
    font_path = os.environ.get("CERT_FONT") or find_font()
    text_color = tuple(hex_to_rgb(config.get("textColor", "#8B1E1E")))
    fields = config["fields"]
    header_row = config.get("headerRowIndex", 0)

    template = Image.open(template_path).convert("RGB")
    df = load_data(data_path, header_row)

    # Filter rows where the first field's column index has a numeric value
    first_col = fields[0]["columnIndex"] if fields else 0
    numeric_mask = pd.to_numeric(df[first_col], errors="coerce").notna()
    df = df[numeric_mask].reset_index(drop=True)

    if preview:
        # Find the row with the longest name for worst-case preview
        name_col = next((f["columnIndex"] for f in fields if f["format"] == "text"), fields[0]["columnIndex"])
        df["_name_len"] = df[name_col].astype(str).str.len()
        idx = df["_name_len"].idxmax()
        rows = [df.iloc[[idx]].reset_index(drop=True)]
    else:
        rows = [df]

    results = []
    target_df = rows[0]

    for i, row in target_df.iterrows():
        img = template.copy()
        draw = ImageDraw.Draw(img)

        name_val = ""
        for field in fields:
            raw = row[field["columnIndex"]]
            text = format_value(raw, field["format"])
            if field["format"] == "text" and not name_val:
                name_val = text

            font, _ = fit_text(
                draw, text, font_path,
                field["fontSize"], field["maxWidth"]
            )
            bbox = draw.textbbox((0, 0), text, font=font)
            text_width = bbox[2] - bbox[0]
            x = field["centerX"] - text_width // 2
            y = field["topY"]
            draw.text((x, y), text, font=font, fill=text_color)

        safe_name = re.sub(r'[^\w\s-]', '', name_val).strip().replace(" ", "_")
        filename = f"{i+1:04d}_{safe_name}.png"
        img.save(os.path.join(output_dir, filename), "PNG")

        results.append({"rowIndex": int(i), "name": name_val, "file": filename})

    return results


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--template", required=True)
    parser.add_argument("--data", required=True)
    parser.add_argument("--config", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--preview", action="store_true")
    args = parser.parse_args()

    with open(args.config) as f:
        config = json.load(f)

    os.makedirs(args.output_dir, exist_ok=True)
    results = generate(args.template, args.data, config, args.output_dir, args.preview)
    print(json.dumps(results))


if __name__ == "__main__":
    main()
