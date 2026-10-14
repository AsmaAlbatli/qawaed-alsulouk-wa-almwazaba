import sys, os, re

ROOT = os.path.dirname(os.path.abspath(__file__))
JS  = os.path.join(os.path.dirname(ROOT), 'assets', 'js')

ARABIC = re.compile(r'[\u0600-\u06FF\u0750-\u077F]')
LATIN  = re.compile(r'[A-Za-z]')
CJK    = re.compile(r'[\u3000-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF]')
BADCH  = re.compile(r'[\uFFFD\u200E\u200F\u061C]')
# single-quoted JS string literal (no nested quotes)
STR = re.compile(r"'([^'\\]*)'")
OK_LATIN = set('pdfPDF1447')

def check(path):
    out = []
    with open(path, encoding='utf-8') as f:
        for i, line in enumerate(f, 1):
            for s in STR.findall(line):
                if not ARABIC.search(s):
                    continue
                hits = []
                if LATIN.search(s):
                    rest = set(LATIN.findall(s)) - OK_LATIN
                    if rest:
                        hits.append('LATIN:' + ','.join(sorted(rest)))
                if CJK.search(s):
                    hits.append('CJK:' + ','.join(sorted(set(CJK.findall(s)))))
                if BADCH.search(s):
                    hits.append('CTRL')
                if hits:
                    out.append((i, ' '.join(hits), s[:110]))
    return out

total = 0
for name in sorted(os.listdir(JS)):
    if not name.startswith('data-') or not name.endswith('.js'):
        continue
    iss = check(os.path.join(JS, name))
    if iss:
        print('===', name)
        for ln, kind, txt in iss:
            print('  L%-4d %s\n        %s' % (ln, kind, txt))
            total += 1
print('TOTAL SUSPECT STRINGS:', total)
sys.exit(1 if total else 0)