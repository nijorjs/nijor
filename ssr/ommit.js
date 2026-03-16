import MagicString from "magic-string";

export default function() {
  const START = `// @ommit:start`;
  const END = `// @ommit:end`;

  return {
    name: "ommit",

    transform(code, id) {
      if (!code.includes(START)) return null;

      const s = new MagicString(code);

      let i = 0;
      let inString = false;
      let stringChar = "";
      let inTemplate = false;
      let inBlockComment = false;
      let inLineComment = false;

      let removing = false;
      let removeStart = -1;

      while (i < code.length) {
        const ch = code[i];
        const next = code[i + 1];

        /* ------------------ STRINGS ------------------ */
        if (inString) {
          if (ch === "\\" && next) {
            i += 2;
            continue;
          }
          if (ch === stringChar) {
            inString = false;
          }
          i++;
          continue;
        }

        if (inTemplate) {
          if (ch === "\\" && next) {
            i += 2;
            continue;
          }
          if (ch === "`") {
            inTemplate = false;
          }
          i++;
          continue;
        }

        /* ------------------ COMMENTS ------------------ */
        if (inBlockComment) {
          if (ch === "*" && next === "/") {
            inBlockComment = false;
            i += 2;
            continue;
          }
          i++;
          continue;
        }

        if (inLineComment) {
          if (ch === "\n") {
            inLineComment = false;
          }
          i++;
          continue;
        }

        /* ------------------ ENTER STATES ------------------ */
        if (ch === "'" || ch === '"') {
          inString = true;
          stringChar = ch;
          i++;
          continue;
        }

        if (ch === "`") {
          inTemplate = true;
          i++;
          continue;
        }

        if (ch === "/" && next === "*") {
          inBlockComment = true;
          i += 2;
          continue;
        }

        if (ch === "/" && next === "/") {
          const lineEnd = code.indexOf("\n", i);
          const comment = code
            .slice(i, lineEnd === -1 ? code.length : lineEnd)
            .trim();

          if (comment === START) {
            removing = true;
            removeStart = i;
          }

          if (comment === END && removing) {
            const removeEnd = lineEnd === -1 ? code.length : lineEnd;
            s.remove(removeStart, removeEnd);
            removing = false;
          }

          inLineComment = true;
          i += 2;
          continue;
        }

        i++;
      }

      return {
        code: s.toString(),
        map: s.generateMap({ hires: true }),
      };
    },
  };
}
