"""EP21〜30 のナレーションを Gemini TTS（声 Leda）で作って audio/epXX.wav に置き、書き起こしで台本と照合する.

使い方（キーは with_key.py 経由で渡す。値は表示しない）:
  python with_key.py .env.local <venv python> -X utf8 make_voices.py tts 21 22 ...      # 無い回だけ作る（--force で作り直す）
  python with_key.py .env.local <venv python> -X utf8 make_voices.py verify 21 22 ...   # 最後の行 BAD: [] なら OK
- 台本は episodes.json の narration（読み上げ用の文。km/h・〜は build の段階で言い換え済み）
- 速さはそのまま（1.0）。render.mjs が 1.08 倍速と -14 LUFS にする
- 照合: 書き起こしが台本どおりか（OK/NG）と、書き起こしの数字が台本の数字と一致するか
"""
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path.home() / ".claude/skills/hazard-reel/scripts/rpg"))
sys.path.insert(0, str(Path.home() / ".claude/skills/motion-reel/template/tools"))
from tts import synth, tts_models  # noqa: E402
from tts10 import PROMPT, numbers_in, retry  # noqa: E402
from google import genai  # noqa: E402
from google.genai import types  # noqa: E402

SERIES = Path(__file__).resolve().parent.parent
AUDIO = SERIES / "audio"
VOICE = "Leda"
# 声の指示は付けない（英語の指示を付けたら、指示文ごと読み上げた・2026-11-18）。Leda はそのままで落ち着いた声
STYLE = ""


def episodes(ids):
    data = json.loads((SERIES / "episodes.json").read_text(encoding="utf-8"))
    by_id = {e["id"]: e for e in data}
    missing = [i for i in ids if i not in by_id]
    if missing:
        sys.exit(f"episodes.json にない回: {missing}")
    return [by_id[i] for i in ids]


def client():
    return genai.Client(api_key=os.environ["GEMINI_API_KEY"])


def tts(ids, force):
    c = client()
    model = tts_models(c)[0]
    print("TTS model:", model, "voice:", VOICE)
    AUDIO.mkdir(exist_ok=True)
    for ep in episodes(ids):
        out = AUDIO / f"ep{ep['id']}.wav"
        if out.exists() and not force:
            print(f"EP{ep['id']}: 既にある（作り直すなら --force）")
            continue
        d = retry(lambda: synth(c, model, VOICE, STYLE, ep["narration"], out, 1.0), f"EP{ep['id']}")
        print(f"EP{ep['id']}: {d:.2f}s -> {out}", flush=True)


def flash_model(c):
    import re
    names = [m.name.removeprefix("models/") for m in c.models.list()]
    flash = [n for n in names if re.fullmatch(r"gemini-\d+(\.\d+)?-flash", n)]
    return max(flash, key=lambda n: float(re.search(r"\d+(\.\d+)?", n).group()))


def check(c, model, ep, wav=None):
    """書き起こしが台本どおりで、数字が順番どおり一致すれば True。"""
    wav = wav or AUDIO / f"ep{ep['id']}.wav"
    if not wav.exists():
        print(f"EP{ep['id']}: wav がない")
        return False
    r = retry(lambda: c.models.generate_content(model=model, contents=[
        types.Part.from_bytes(data=wav.read_bytes(), mime_type="audio/wav"),
        PROMPT.format(line=ep["narration"])]), f"EP{ep['id']}")
    lines = (r.text or "").strip().splitlines()
    transcript = lines[0] if lines else ""
    ok = bool(lines) and lines[-1].strip().upper().startswith("OK")
    want, got = numbers_in(ep["narration"]), numbers_in(transcript)
    # 順番も比べる（第3位と第2位の数を入れ替えて読んだら NG にする）
    num_ok = list(map(float, want)) == list(map(float, got))
    verdict = "OK" if ok and num_ok else ("NUM" if ok else "NG")
    print(f"EP{ep['id']} {verdict} | {transcript}\n  want {want}\n  got  {got}", flush=True)
    return verdict == "OK"


def verify(ids):
    c = client()
    model = flash_model(c)
    print("verify model:", model)
    bad = [ep["id"] for ep in episodes(ids) if not check(c, model, ep)]
    print("BAD:", bad)


def make(ids, tries=3):
    """作る → 照合 → だめなら作り直す（最大 tries 回）。照合に通ったものだけを epXX.wav にする（だめなら置き換えない）。"""
    c = client()
    tts_model, flash = tts_models(c)[0], flash_model(c)
    print("TTS model:", tts_model, "voice:", VOICE, "| verify model:", flash)
    AUDIO.mkdir(exist_ok=True)
    bad = []
    for ep in episodes(ids):
        out = AUDIO / f"ep{ep['id']}.wav"
        tmp = AUDIO / f"ep{ep['id']}.tmp.wav"
        for attempt in range(1, tries + 1):
            d = retry(lambda: synth(c, tts_model, VOICE, STYLE, ep["narration"], tmp, 1.0), f"EP{ep['id']}")
            print(f"EP{ep['id']} try {attempt}: {d:.2f}s", flush=True)
            if check(c, flash, ep, tmp):
                tmp.replace(out)
                break
        else:
            bad.append(ep["id"])
            print(f"EP{ep['id']}: {tries} 回とも照合に通らない（{out.name} は置き換えていない。最後の試しは {tmp.name}）")
    print("BAD:", bad)


if __name__ == "__main__":
    cmd, rest = sys.argv[1], sys.argv[2:]
    ids = [x.zfill(2) for x in rest if not x.startswith("--")]
    if cmd == "tts":
        tts(ids, "--force" in rest)
    elif cmd == "verify":
        verify(ids)
    elif cmd == "make":
        make(ids)
    else:
        sys.exit(f"unknown command {cmd}")
