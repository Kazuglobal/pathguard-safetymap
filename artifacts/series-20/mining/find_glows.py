"""全面の写真（hook・cta）から、光のにじみを重ねる位置（ヘッドライト・街灯）を見つけて images/glows.json に書く.

使い方: python -X utf8 find_glows.py            # images/ep*/hook.jpg と cta.jpg を全部
        python -X utf8 find_glows.py 21 22      # 指定した回だけ（ほかの回の結果は残す）
やり方: 明るさの上位の小さな塊（光源）を探し、面積の大きい順に最大4つ。座標は画面の 0〜1（左上が原点）、r は半径のおよそ。
空・白っぽい路面のような大きく明るい面は光源ではないので、面積が大きすぎる塊は外す。
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

SERIES = Path(__file__).resolve().parent.parent
OUT = SERIES / "images" / "glows.json"
SCALE = 270  # 解析は幅270pxに縮めて行う


def glows(path: Path, top: int = 4):
    img = Image.open(path).convert("L")
    w, h = img.size
    small = img.resize((SCALE, round(SCALE * h / w)), Image.BILINEAR)
    a = np.asarray(small, dtype=np.float32) / 255.0
    if float(a.mean()) > 0.30:  # 昼の写真（全体が明るい）には光のにじみを足さない
        return []
    thresh = max(0.85, float(np.quantile(a, 0.997)))
    labels, n = ndimage.label(a >= thresh)
    found = []
    for i in range(1, n + 1):
        ys, xs = np.nonzero(labels == i)
        area = len(xs)
        if area < 3 or area > a.size * 0.01:  # 小さすぎる点・大きな明るい面は外す
            continue
        cy, cx = ys.mean(), xs.mean()
        # 光源はまわりより際立って明るい: 塊のまわり（半径の3倍の四角から塊を除いた所）との差が小さければ、空や白い面なので外す
        # （雨や霧のライトはまわりもにじんで明るいので、まわりの明るさそのものではなく差で見る）
        rad = max(2, int(np.sqrt(area / np.pi) * 3))
        y0, y1 = max(0, int(cy) - rad), min(a.shape[0], int(cy) + rad + 1)
        x0, x1 = max(0, int(cx) - rad), min(a.shape[1], int(cx) + rad + 1)
        box = a[y0:y1, x0:x1]
        ring = box[labels[y0:y1, x0:x1] != i]
        blob = a[labels == i]
        if ring.size and float(blob.mean()) - float(ring.mean()) < 0.22:
            continue
        if cy / a.shape[0] > 0.62:  # 画面の下のほうの光は、たいてい濡れた路面の映り込み
            continue
        r = max(0.012, min(0.06, 2.2 * np.sqrt(area / np.pi) / a.shape[1]))
        found.append({"x": round(float(cx / a.shape[1]), 3), "y": round(float(cy / a.shape[0]), 3), "r": round(float(r), 3), "area": area})
    # 濡れた路面の映り込みは、光源のすぐ下に縦に並ぶ → 真上（横のずれ0.03以内・0.15以内の上）に別の塊があれば外す
    lights = [g for g in found if not any(o is not g and abs(o["x"] - g["x"]) < 0.03 and 0 < g["y"] - o["y"] < 0.15 for o in found)]
    lights.sort(key=lambda g: -g["area"])
    return [{k: g[k] for k in ("x", "y", "r")} for g in lights[:top]]


def main():
    data = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {}
    eps = sys.argv[1:] or sorted(p.name.removeprefix("ep") for p in (SERIES / "images").glob("ep*") if p.is_dir())
    for ep in eps:
        entry = data.get(ep, {})
        for key in ("hook", "cta"):
            p = SERIES / "images" / f"ep{ep}" / f"{key}.jpg"
            if p.exists():
                entry[key] = glows(p)
        data[ep] = entry
        print(ep, json.dumps(entry, ensure_ascii=False))
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print("書き出し:", OUT)


if __name__ == "__main__":
    main()
