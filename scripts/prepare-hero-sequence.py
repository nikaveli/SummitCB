"""Extract a supplied 24 fps hero edit into responsive WebP scroll frames."""
import json
import shutil
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

site = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('/Users/nicholasmolina/Downloads/HeroSummit.mp4')
out = site / 'public/assets/hero-sequence-v5'

for name in ('desktop', 'mobile'):
    directory = out / name
    directory.mkdir(parents=True, exist_ok=True)
    for stale in directory.glob('frame-*.webp'):
        stale.unlink()

with tempfile.TemporaryDirectory(prefix='summit-sequence-') as tmp:
    subprocess.run([
        'ffmpeg', '-v', 'error', '-i', str(source), '-map', '0:v:0', '-an',
        '-start_number', '0', f'{tmp}/frame-%03d.png'
    ], check=True)
    frames = sorted(Path(tmp).glob('*.png'))

    def encode(frame):
        name = frame.with_suffix('.webp').name
        subprocess.run(['cwebp', '-quiet', '-q', '86', '-m', '5', str(frame), '-o', str(out / 'desktop' / name)], check=True)
        subprocess.run(['cwebp', '-quiet', '-crop', '554', '0', '810', '1080', '-q', '86', '-m', '5', str(frame), '-o', str(out / 'mobile' / name)], check=True)

    with ThreadPoolExecutor(max_workers=3) as pool:
        list(pool.map(encode, frames))

logo = site / 'public/assets/hero-sequence-v4/logo.webp'
if logo.exists():
    shutil.copy2(logo, out / 'logo.webp')

metadata = {
    'source': source.name,
    'duration': len(frames) / 24,
    'fps': 24,
    'frames': len(frames),
    'desktop': [1920, 1080],
    'mobile': [810, 1080],
    'quality': 86,
    'bytes': {name: sum(file.stat().st_size for file in (out / name).glob('*.webp')) for name in ('desktop', 'mobile')},
}
(out / 'manifest.json').write_text(json.dumps(metadata, indent=2) + '\n')
print(json.dumps(metadata, indent=2))
