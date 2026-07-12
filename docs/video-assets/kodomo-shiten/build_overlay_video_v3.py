# -*- coding: utf-8 -*-
"""
v3: エンタメ性(フック)を強化した版。
- 実写真のピクセルは一切再生成しない(このルールはv2から継続)
- 追加したのは「実写真の中でのズーム/クロップ移動(Ken Burns)」のみ。
  これは同じ実ピクセルの一部を拡大表示するだけで、新しい被写体は生成しない。
- 冒頭0.6秒でフックテキスト、しゃがみズーム、点線の高速リビール、
  アイコンのバウンス、を詰め込みテンポを圧縮した。
"""
import math
import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import numpy as np
import cv2

BASE_DIR = Path(__file__).resolve().parent
SRC = Path(os.environ.get("KODOMO_SOURCE_PHOTO", BASE_DIR / "source_photo_blurred.jpg"))
OUT = Path(os.environ.get("KODOMO_OUTPUT_VIDEO", BASE_DIR / "cut03_overlay_punchy.mp4"))
FRAMES_DIR = Path(os.environ.get("KODOMO_FRAMES_DIR", BASE_DIR / "frames_v3"))
if not SRC.is_file():
    raise FileNotFoundError(f"Source photo not found: {SRC}")
OUT.parent.mkdir(parents=True, exist_ok=True)
os.makedirs(FRAMES_DIR, exist_ok=True)

font_override = os.environ.get("KODOMO_FONT_PATH")
font_candidates = [
    Path(font_override) if font_override else None,
    Path(r"C:\Windows\Fonts\YuGothB.ttc"),
    Path("/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc"),
    Path("/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"),
]
FONT_PATH = next((candidate for candidate in font_candidates if candidate and candidate.is_file()), None)
if FONT_PATH is None:
    raise FileNotFoundError("Japanese bold font not found. Set KODOMO_FONT_PATH to a usable font file.")

INK = (0x43, 0x39, 0x2B)
PAPER = (0xFB, 0xF5, 0xE9)
ACCENT = (0xF4, 0x80, 0x1F)

OUT_W, OUT_H = 720, 1280
WORK_W, WORK_H = 1080, 1920  # ズームに耐える作業解像度
FPS = 24
DURATION = 5.0
N_FRAMES = int(DURATION * FPS)

# --- 実写真: クロップ+リサイズのみ。ピクセルの再生成はしない ---
src_im = Image.open(SRC).convert("RGB")
sw, sh = src_im.size
target_ratio = 9 / 16
crop_w = int(sh * target_ratio)
x_off = (sw - crop_w) // 2
work = src_im.crop((x_off, 0, x_off + crop_w, sh)).resize((WORK_W, WORK_H), Image.LANCZOS)
scale_work = WORK_W / crop_w

raw_points = [
    (564, 3326), (988, 2621), (1310, 2177),
    (1532, 1955), (1653, 1855), (1734, 1804),
]
pts_work = [((x - x_off) * scale_work, y * scale_work) for x, y in raw_points]

def point_along_path(points, t):
    if t <= 0: return points[0]
    if t >= 1: return points[-1]
    seg_lengths = [math.hypot(points[i+1][0]-points[i][0], points[i+1][1]-points[i][1]) for i in range(len(points)-1)]
    total = sum(seg_lengths)
    target = t * total
    acc = 0.0
    for i, seglen in enumerate(seg_lengths):
        if acc + seglen >= target or i == len(seg_lengths) - 1:
            local_t = 0 if seglen == 0 else (target - acc) / seglen
            ax, ay = points[i]; bx, by = points[i+1]
            return (ax + (bx-ax)*local_t, ay + (by-ay)*local_t)
        acc += seglen
    return points[-1]

def draw_dashed_path(draw, points, progress, color, width=8, dash=18, gap=12):
    if progress <= 0: return
    samples = [point_along_path(points, i/400) for i in range(401)]
    n = max(1, int(400*progress))
    samples = samples[:n+1]
    dist_acc, on = 0.0, True
    for i in range(len(samples)-1):
        ax, ay = samples[i]; bx, by = samples[i+1]
        seg_len = math.hypot(bx-ax, by-ay)
        if seg_len == 0: continue
        threshold = dash if on else gap
        if dist_acc + seg_len >= threshold:
            ratio = (threshold - dist_acc) / seg_len
            mx, my = ax + (bx-ax)*ratio, ay + (by-ay)*ratio
            if on: draw.line([(ax,ay),(mx,my)], fill=color, width=width)
            on = not on; dist_acc = 0.0
        else:
            if on: draw.line([(ax,ay),(bx,by)], fill=color, width=width)
            dist_acc += seg_len

def draw_caution_icon(draw, center, size, alpha, ink_c=INK, paper_c=PAPER):
    if size <= 0 or alpha <= 0: return
    cx, cy = center
    r = size
    def blend(c):
        return tuple(int(paper_c[i] + (c[i]-paper_c[i])*alpha) for i in range(3))
    tri = [(cx, cy-r), (cx-r*0.95, cy+r*0.8), (cx+r*0.95, cy+r*0.8)]
    draw.polygon(tri, fill=blend(PAPER), outline=blend(ink_c))
    draw.line([(cx, cy-r*0.35),(cx, cy+r*0.15)], fill=blend(ink_c), width=max(2, int(size//8)))
    draw.ellipse([cx-2, cy+r*0.35, cx+2, cy+r*0.45], fill=blend(ink_c))

def text_size(draw, text, font):
    b = draw.textbbox((0,0), text, font=font)
    return b[2]-b[0], b[3]-b[1]

def rounded_caption(draw, text, font, cy_from_bottom, alpha, out_w, out_h):
    tw, th = text_size(draw, text, font)
    pad_x, pad_y = 22, 14
    box_w, box_h = tw+pad_x*2, th+pad_y*2
    box_x = (out_w-box_w)/2
    box_y = out_h - box_h - cy_from_bottom
    def blend_a(c, a): return tuple(int(v) for v in c) + (int(255*max(0,min(1,a))),)
    draw.rounded_rectangle([box_x,box_y,box_x+box_w,box_y+box_h], radius=18,
                            fill=blend_a(PAPER, alpha*0.95), outline=blend_a(INK, alpha*0.5), width=2)
    draw.text((box_x+pad_x, box_y+pad_y-4), text, font=font, fill=blend_a(INK, alpha))

def ease_out_quad(u): return 1 - (1-u)**2
def ease_out_cubic(u): return 1 - (1-u)**3
def clamp01(u): return max(0.0, min(1.0, u))

# --- カメラワーク(ズーム/クロップ移動)の定義。実ピクセルの一部を切り出すだけ ---
FULL_BOX = (0, 0, WORK_W, WORK_H)  # 大人の視界(全体)
# しゃがみ後の子ども目線ズーム: カーブ地点付近を中心に1.4倍
zoom_cx, zoom_cy, zoom_factor = 620, 1100, 1.4
zw, zh = WORK_W/zoom_factor, WORK_H/zoom_factor
CHILD_BOX = (zoom_cx-zw/2, zoom_cy-zh/2, zoom_cx+zw/2, zoom_cy+zh/2)

def lerp_box(a, b, u):
    return tuple(a[i] + (b[i]-a[i])*u for i in range(4))

def punch_pulse(t, center, rise=0.10, fall=0.30, amp=0.05):
    if center <= t <= center+rise:
        return amp * (t-center)/rise
    if center+rise < t <= center+rise+fall:
        return amp * max(0.0, 1-(t-center-rise)/fall)
    return 0.0

def shrink_box(box, factor):
    x0,y0,x1,y1 = box
    cx, cy = (x0+x1)/2, (y0+y1)/2
    w, h = (x1-x0)/factor, (y1-y0)/factor
    return (cx-w/2, cy-h/2, cx+w/2, cy+h/2)

def get_camera_box(t):
    if t < 0.6:
        box = FULL_BOX
    elif t < 2.2:
        u = ease_out_quad(clamp01((t-0.6)/(2.2-0.6)))
        box = lerp_box(FULL_BOX, CHILD_BOX, u)
    else:
        box = CHILD_BOX
    extra = punch_pulse(t, 2.45)
    if extra > 0:
        box = shrink_box(box, 1.0+extra)
    return box

font_hook = ImageFont.truetype(FONT_PATH, 46)
font_caption = ImageFont.truetype(FONT_PATH, 40)

video = cv2.VideoWriter(str(OUT), cv2.VideoWriter_fourcc(*"mp4v"), FPS, (OUT_W, OUT_H))

HOOK_TEXT = "しゃがんで 見てみると..."
CAPTION = "この先、カーブで 見えにくいよ"

save_indices = {0, 14, 40, 60, 66, 74, 90, 119}

for f in range(N_FRAMES):
    t = f / FPS

    box = get_camera_box(t)
    x0, y0, x1, y1 = box
    crop = work.crop((int(round(x0)), int(round(y0)), int(round(x1)), int(round(y1))))
    frame = crop.resize((OUT_W, OUT_H), Image.LANCZOS)
    draw = ImageDraw.Draw(frame, "RGBA")

    # 経路点を現在のカメラボックス基準に変換する関数
    def to_frame_coords(p):
        px, py = p
        fx = (px - x0) / (x1 - x0) * OUT_W
        fy = (py - y0) / (y1 - y0) * OUT_H
        return (fx, fy)

    pts_frame = [to_frame_coords(p) for p in pts_work]

    # フックテキスト: 0〜1.0s (0.9sからフェードアウト)
    if t < 1.0:
        if t < 0.15:
            alpha = t/0.15
        elif t < 0.6:
            alpha = 1.0
        else:
            alpha = max(0.0, 1 - (t-0.6)/0.4)
        def blend_a(c, a): return tuple(int(v) for v in c) + (int(255*max(0,min(1,a))),)
        tw, th = text_size(draw, HOOK_TEXT, font_hook)
        hx = (OUT_W - tw)/2
        hy = OUT_H*0.30
        # 縁取り風に少し外側へ複製してから本体を描く(視認性確保)
        for ox, oy in [(-2,0),(2,0),(0,-2),(0,2)]:
            draw.text((hx+ox, hy+oy), HOOK_TEXT, font=font_hook, fill=blend_a(PAPER, alpha))
        draw.text((hx, hy), HOOK_TEXT, font=font_hook, fill=blend_a(INK, alpha))

    # 点線: 2.5〜2.9s で高速リビール(実在の縁石ラインをトレース)
    if t > 2.5:
        progress = min(1.0, (t-2.5)/0.4)
        draw_dashed_path(draw, pts_frame, progress, INK+(235,), width=7, dash=16, gap=11)

    # 注意アイコン: 2.9〜3.3s でバウンス登場
    if t > 2.9:
        u = clamp01((t-2.9)/0.4)
        if u < 0.6:
            s = 1.25*ease_out_cubic(u/0.6)
        else:
            s = 1.25 - 0.25*ease_out_cubic((u-0.6)/0.4)
        end_pt = pts_frame[-1]
        icon_center = (end_pt[0]-46, end_pt[1]-12)
        draw_caution_icon(draw, icon_center, 24*s, min(1.0, u*1.6))

    # キャプション: 3.3sから登場、以降保持
    if t > 3.3:
        alpha = min(1.0, (t-3.3)/0.4)
        rounded_caption(draw, CAPTION, font_caption, 60, alpha, OUT_W, OUT_H)

    if f in save_indices:
        frame.save(os.path.join(FRAMES_DIR, f"v3_{f:03d}.jpg"), quality=92)

    arr = cv2.cvtColor(np.array(frame), cv2.COLOR_RGB2BGR)
    video.write(arr)

video.release()
print("done ->", OUT)
