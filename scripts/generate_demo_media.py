"""Generate original synthetic demo media; requires FFmpeg with libx264/libwebp."""
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parent.parent
PALETTES = [
    ('0x172554', '0x38bdf8'),
    ('0x3b0764', '0xe879f9'),
    ('0x064e3b', '0x34d399'),
    ('0x7c2d12', '0xfb923c'),
    ('0x312e81', '0xa5b4fc'),
    ('0x831843', '0xfda4af'),
]


def main():
    if not shutil.which('ffmpeg'):
        raise SystemExit('FFmpeg is required to regenerate demo media.')
    output = ROOT / 'public' / 'media'
    output.mkdir(parents=True, exist_ok=True)
    for index, (start, end) in enumerate(PALETTES, 1):
        video = output / f'video-{index}.mp4'
        poster = output / f'poster-{index}.webp'
        source = (
            f'gradients=s=360x640:r=24:d=6:c0={start}:c1={end}:'
            f'seed={index}:speed=0.08'
        )
        subprocess.run([
            'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
            '-f', 'lavfi', '-i', source, '-an', '-c:v', 'libx264',
            '-preset', 'medium', '-crf', '28', '-pix_fmt', 'yuv420p',
            '-movflags', '+faststart', str(video),
        ], check=True)
        subprocess.run([
            'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
            '-i', str(video), '-frames:v', '1', '-c:v', 'libwebp',
            '-quality', '80', str(poster),
        ], check=True)
        print(f'Generated video and poster {index}')


if __name__ == '__main__':
    main()
