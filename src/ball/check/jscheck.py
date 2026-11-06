"""Crude stand-in for `node --check`: strings, comments, template literals and bracket balance.
Regex literals are not handled (the files checked have none)."""
import sys

PAIRS = {')': '(', ']': '[', '}': '{'}

def scan(path):
    s = open(path).read()
    i, line, st = 0, 1, []
    while i < len(s):
        c = s[i]
        if c == '\n':
            line += 1
        if s.startswith('//', i):
            i = s.index('\n', i)
            continue
        if s.startswith('/*', i):
            j = s.index('*/', i)
            line += s[i:j].count('\n')
            i = j + 2
            continue
        if c in '"\'`':
            j = i + 1
            while s[j] != c:
                if s[j] == '\\':
                    j += 1
                if s[j] == '\n' and c != '`':
                    return f"{path}:{line} newline in string"
                j += 1
            line += s[i:j].count('\n')
            i = j + 1
            continue
        if c in '([{':
            st.append((c, line))
        elif c in ')]}':
            if not st or st[-1][0] != PAIRS[c]:
                return f"{path}:{line} unbalanced {c} (open {st[-1] if st else None})"
            st.pop()
        i += 1
    return f"{path} balanced" if not st else f"{path} UNCLOSED {st}"

for p in sys.argv[1:]:
    print(scan(p))
