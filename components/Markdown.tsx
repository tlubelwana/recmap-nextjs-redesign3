// A tiny, dependency-free markdown-to-JSX renderer. Supports just what the
// chat answers actually use: **bold**, *italic*, pipe tables, and simple
// "- " / "1. " lists — no npm markdown library is installed in this
// sandbox, and none may be added, so this hand-rolled subset stands in for
// one. Deliberately does not touch dangerouslySetInnerHTML: everything is
// built as React nodes, so arbitrary text from the API can never inject markup.
import React from "react";

function parseInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;
  const pattern = /\*\*(.+?)\*\*|\*(.+?)\*/;
  while (remaining.length > 0) {
    const match = pattern.exec(remaining);
    if (!match) {
      nodes.push(remaining);
      break;
    }
    if (match.index > 0) {
      nodes.push(remaining.slice(0, match.index));
    }
    if (match[1] !== undefined) {
      nodes.push(<strong key={`${keyPrefix}-${key++}`}>{match[1]}</strong>);
    } else if (match[2] !== undefined) {
      nodes.push(<em key={`${keyPrefix}-${key++}`}>{match[2]}</em>);
    }
    remaining = remaining.slice(match.index + match[0].length);
  }
  return nodes;
}

function isSeparatorRow(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes("-") || !trimmed.includes("|")) return false;
  return /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/.test(trimmed);
}

function splitRow(line: string): string[] {
  let l = line.trim();
  if (l.startsWith("|")) l = l.slice(1);
  if (l.endsWith("|")) l = l.slice(0, -1);
  return l.split("|").map((c) => c.trim());
}

function isListBlock(lines: string[]): boolean {
  return lines.length > 0 && lines.every((l) => /^\s*([-*]|\d+\.)\s+/.test(l));
}

function renderTable(lines: string[], blockKey: string): React.ReactNode {
  const headerCells = splitRow(lines[0]);
  const alignCells = splitRow(lines[1]);
  const rightAlign = alignCells.map((c) => c.trim().endsWith(":"));
  const bodyRows = lines
    .slice(2)
    .map(splitRow)
    .filter((row) => row.some((c) => c.length > 0));

  return (
    <div className="md-table-wrap">
      <table className="md-table">
        <thead>
          <tr>
            {headerCells.map((c, i) => (
              <th key={i}>{parseInline(c, `${blockKey}-th-${i}`)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyRows.map((row, ri) => (
            <tr key={ri}>
              {row.map((c, ci) => (
                <td key={ci} className={rightAlign[ci] ? "num" : undefined}>
                  {parseInline(c, `${blockKey}-td-${ri}-${ci}`)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Markdown({ text }: { text: string }) {
  const blocks = text
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  return (
    <>
      {blocks.map((block, bi) => {
        const lines = block
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.length > 0);
        const blockKey = `b${bi}`;
        if (lines.length === 0) return null;

        if (lines.length >= 2 && lines[0].includes("|") && isSeparatorRow(lines[1])) {
          return <React.Fragment key={blockKey}>{renderTable(lines, blockKey)}</React.Fragment>;
        }

        if (isListBlock(lines)) {
          return (
            <ul key={blockKey}>
              {lines.map((line, li) => (
                <li key={li}>
                  {parseInline(line.replace(/^\s*([-*]|\d+\.)\s+/, ""), `${blockKey}-li-${li}`)}
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={blockKey}>
            {lines.map((line, li) => (
              <React.Fragment key={li}>
                {li > 0 && <br />}
                {parseInline(line, `${blockKey}-l${li}`)}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
}
