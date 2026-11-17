"""Cross-compile the per-user Edge launcher for three Windows architectures."""
from concurrent.futures import ThreadPoolExecutor
import os
from pathlib import Path
import shutil
import struct
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
BUILDS = {'386': 'x86', 'amd64': 'x64', 'arm64': 'arm64'}


def build(architecture, work, output):
    label = BUILDS[architecture]
    env = {**os.environ, 'GOOS': 'windows', 'GOARCH': architecture, 'CGO_ENABLED': '0', 'GOTOOLCHAIN': 'local'}
    target = output / f'Who-Would-Win-2.0-Windows-{label}.exe'
    subprocess.run([os.getenv('FIGHT2_GO', 'go'), 'build', '-trimpath', '-buildvcs=false',
                    '-ldflags=-H=windowsgui -s -w', '-o', str(target), 'setup.go'], cwd=work, env=env, check=True)
    raw = target.read_bytes()
    pe = struct.unpack_from('<I', raw, 60)[0]
    machine = struct.unpack_from('<H', raw, pe + 4)[0]
    if raw[:2] != b'MZ' or raw[pe:pe + 4] != b'PE\0\0' or machine != {
        '386': 0x014c, 'amd64': 0x8664, 'arm64': 0xaa64,
    }[architecture]:
        raise RuntimeError(f'Architecture validation failed for {target.name}')
    print(f'{target.name}: 0x{machine:04x} verified')


def main():
    output = ROOT / 'web/downloads'
    output.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory() as folder:
        work = Path(folder)
        png = (ROOT / 'web/assets/icon.png').read_bytes()
        header = struct.pack('<HHHBBBBHHII', 0, 1, 1, 192, 192, 0, 0, 1, 32, len(png), 22)
        (work / 'Fight2.ico').write_bytes(header + png)
        shutil.copyfile(ROOT / 'windows/setup.go', work / 'setup.go')
        with ThreadPoolExecutor(max_workers=3) as executor:
            list(executor.map(lambda architecture: build(architecture, work, output), BUILDS))


if __name__ == '__main__':
    main()
