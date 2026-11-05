"""Generate the simple, opaque Dokusho iOS app icon with Python's standard library."""

from __future__ import annotations

import math
import struct
import zlib
from pathlib import Path


SIZE = 1024
PIXELS = bytearray(SIZE * SIZE * 3)


def blend_pixel(x: int, y: int, color: tuple[int, int, int]) -> None:
    if 0 <= x < SIZE and 0 <= y < SIZE:
        index = (y * SIZE + x) * 3
        PIXELS[index : index + 3] = bytes(color)


for y in range(SIZE):
    for x in range(SIZE):
        glow = max(0.0, 1.0 - math.hypot(x - 760, y - 180) / 1050)
        t = y / (SIZE - 1)
        color = (
            int(24 + 20 * glow - 7 * t),
            int(38 + 42 * glow - 2 * t),
            int(82 + 74 * glow + 18 * t),
        )
        blend_pixel(x, y, color)


def polygon(points: list[tuple[int, int]], color: tuple[int, int, int]) -> None:
    min_y = max(0, min(y for _, y in points))
    max_y = min(SIZE - 1, max(y for _, y in points))
    for y in range(min_y, max_y + 1):
        intersections = []
        for index, (x1, y1) in enumerate(points):
            x2, y2 = points[(index + 1) % len(points)]
            if y1 == y2 or y < min(y1, y2) or y >= max(y1, y2):
                continue
            intersections.append(round(x1 + (y - y1) * (x2 - x1) / (y2 - y1)))
        intersections.sort()
        for left, right in zip(intersections[::2], intersections[1::2]):
            for x in range(max(0, left), min(SIZE, right + 1)):
                blend_pixel(x, y, color)


def thick_line(start: tuple[int, int], end: tuple[int, int], color: tuple[int, int, int], width: int) -> None:
    x1, y1 = start
    x2, y2 = end
    steps = max(abs(x2 - x1), abs(y2 - y1), 1)
    radius = width // 2
    for step in range(steps + 1):
        x = round(x1 + (x2 - x1) * step / steps)
        y = round(y1 + (y2 - y1) * step / steps)
        for py in range(y - radius, y + radius + 1):
            for px in range(x - radius, x + radius + 1):
                if (px - x) ** 2 + (py - y) ** 2 <= radius**2:
                    blend_pixel(px, py, color)


# A small stack of page edges gives the book a little depth.
polygon([(155, 665), (486, 758), (486, 802), (155, 703)], (178, 193, 230))
polygon([(538, 758), (869, 665), (869, 703), (538, 802)], (178, 193, 230))

# Open pages, with a narrow central gutter and a soft blue-gray border.
polygon([(145, 236), (500, 333), (500, 758), (145, 650)], (207, 222, 250))
polygon([(524, 333), (879, 236), (879, 650), (524, 758)], (207, 222, 250))
polygon([(174, 263), (485, 348), (485, 718), (174, 624)], (250, 248, 235))
polygon([(539, 348), (850, 263), (850, 624), (539, 718)], (250, 248, 235))

# Short indigo strokes suggest Japanese text without using a specific typeface.
for y, length in [(374, 205), (423, 247), (472, 190), (521, 225), (570, 162)]:
    thick_line((218, y), (218 + length, y + 58), (105, 130, 184), 13)
for y, length in [(374, 205), (423, 247), (472, 190), (521, 225), (570, 162)]:
    thick_line((806, y), (806 - length, y + 58), (105, 130, 184), 13)

thick_line((512, 326), (512, 757), (112, 139, 193), 18)


def png_chunk(kind: bytes, data: bytes) -> bytes:
    payload = kind + data
    return struct.pack(">I", len(data)) + payload + struct.pack(">I", zlib.crc32(payload) & 0xFFFFFFFF)


rows = b"".join(b"\x00" + PIXELS[y * SIZE * 3 : (y + 1) * SIZE * 3] for y in range(SIZE))
png = (
    b"\x89PNG\r\n\x1a\n"
    + png_chunk(b"IHDR", struct.pack(">IIBBBBB", SIZE, SIZE, 8, 2, 0, 0, 0))
    + png_chunk(b"IDAT", zlib.compress(rows, 9))
    + png_chunk(b"IEND", b"")
)

destination = Path(__file__).resolve().parents[1] / "ios" / "DokushoApp" / "Assets.xcassets" / "AppIcon.appiconset" / "AppIcon.png"
destination.parent.mkdir(parents=True, exist_ok=True)
destination.write_bytes(png)
print(destination)
