#!/usr/bin/env python3
"""Convert docs/PRD.md to docs/PRD.docx using only the Python standard library."""

from __future__ import annotations

import re
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parent.parent
MD_PATH = ROOT / "docs" / "PRD.md"
DOCX_PATH = ROOT / "docs" / "PRD.docx"


def xml_text(text: str) -> str:
    return escape(text)


def runs_from_inline(text: str) -> str:
    """Parse **bold** and `code` into Word runs."""
    parts: list[str] = []
    pattern = re.compile(r"(\*\*[^*]+\*\*|`[^`]+`)")
    pos = 0
    for match in pattern.finditer(text):
        if match.start() > pos:
            parts.append(plain_run(text[pos : match.start()]))
        token = match.group(0)
        if token.startswith("**"):
            parts.append(bold_run(token[2:-2]))
        else:
            parts.append(code_run(token[1:-1]))
        pos = match.end()
    if pos < len(text):
        parts.append(plain_run(text[pos:]))
    return "".join(parts) if parts else plain_run(text)


def plain_run(text: str) -> str:
    return f'<w:r><w:t xml:space="preserve">{xml_text(text)}</w:t></w:r>'


def bold_run(text: str) -> str:
    return (
        "<w:r><w:rPr><w:b/></w:rPr>"
        f"<w:t xml:space=\"preserve\">{xml_text(text)}</w:t></w:r>"
    )


def code_run(text: str) -> str:
    return (
        "<w:r><w:rPr><w:rFonts w:ascii=\"Courier New\" w:hAnsi=\"Courier New\"/>"
        "<w:shd w:val=\"clear\" w:color=\"auto\" w:fill=\"F2F2F2\"/></w:rPr>"
        f"<w:t xml:space=\"preserve\">{xml_text(text)}</w:t></w:r>"
    )


def paragraph(text: str = "", style: str | None = None) -> str:
    ppr = f"<w:pPr><w:pStyle w:val=\"{style}\"/></w:pPr>" if style else ""
    body = runs_from_inline(text) if text else ""
    return f"<w:p>{ppr}{body}</w:p>"


def code_paragraph(text: str) -> str:
  lines = text.split("\n")
  paras = []
  for line in lines:
    paras.append(
      "<w:p><w:pPr><w:shd w:val=\"clear\" w:color=\"auto\" w:fill=\"F5F5F5\"/></w:pPr>"
      f"<w:r><w:rPr><w:rFonts w:ascii=\"Courier New\" w:hAnsi=\"Courier New\"/>"
      f"</w:rPr><w:t xml:space=\"preserve\">{xml_text(line)}</w:t></w:r></w:p>"
    )
  return "".join(paras)


def table_xml(rows: list[list[str]]) -> str:
    if not rows:
        return ""
    col_count = max(len(r) for r in rows)
    tbl = [
        "<w:tbl>",
        "<w:tblPr><w:tblW w:w=\"5000\" w:type=\"pct\"/><w:tblBorders>",
        "<w:top w:val=\"single\" w:sz=\"4\" w:space=\"0\" w:color=\"CCCCCC\"/>",
        "<w:left w:val=\"single\" w:sz=\"4\" w:space=\"0\" w:color=\"CCCCCC\"/>",
        "<w:bottom w:val=\"single\" w:sz=\"4\" w:space=\"0\" w:color=\"CCCCCC\"/>",
        "<w:right w:val=\"single\" w:sz=\"4\" w:space=\"0\" w:color=\"CCCCCC\"/>",
        "<w:insideH w:val=\"single\" w:sz=\"4\" w:space=\"0\" w:color=\"CCCCCC\"/>",
        "<w:insideV w:val=\"single\" w:sz=\"4\" w:space=\"0\" w:color=\"CCCCCC\"/>",
        "</w:tblBorders></w:tblPr>",
    ]
    for r_idx, row in enumerate(rows):
        tbl.append("<w:tr>")
        for c_idx in range(col_count):
            cell = row[c_idx] if c_idx < len(row) else ""
            cell_p = paragraph(cell, "Heading4" if r_idx == 0 else None)
            if r_idx == 0:
                cell_p = (
                    "<w:p><w:pPr><w:rPr><w:b/></w:rPr><w:spacing w:after=\"0\"/></w:pPr>"
                    f"{runs_from_inline(cell)}</w:p>"
                )
            else:
                cell_p = f"<w:p><w:pPr><w:spacing w:after=\"0\"/></w:pPr>{runs_from_inline(cell)}</w:p>"
            tbl.append(f"<w:tc><w:tcPr><w:tcW w:w=\"0\" w:type=\"auto\"/></w:tcPr>{cell_p}</w:tc>")
        tbl.append("</w:tr>")
    tbl.append("</w:tbl>")
    return "".join(tbl)


def md_to_document_body(md: str) -> str:
    lines = md.splitlines()
    out: list[str] = []
    in_code = False
    code_lines: list[str] = []
    in_table = False
    table_rows: list[list[str]] = []
    list_type: str | None = None

    def close_list() -> None:
        nonlocal list_type
        list_type = None

    def close_table() -> None:
        nonlocal in_table, table_rows
        if in_table and table_rows:
            out.append(table_xml(table_rows))
        in_table = False
        table_rows = []

    heading_styles = {
        1: "Heading1",
        2: "Heading2",
        3: "Heading3",
        4: "Heading4",
        5: "Heading5",
        6: "Heading6",
    }

    for line in lines:
        if line.startswith("```"):
            if not in_code:
                close_list()
                close_table()
                in_code = True
                code_lines = []
            else:
                out.append(code_paragraph("\n".join(code_lines)))
                in_code = False
                code_lines = []
            continue

        if in_code:
            code_lines.append(line)
            continue

        if line.startswith("|"):
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            if all(re.fullmatch(r":?-+:?", c.replace(" ", "")) for c in cells):
                continue
            if not in_table:
                close_list()
                in_table = True
                table_rows = []
            table_rows.append(cells)
            continue
        else:
            close_table()

        if re.fullmatch(r"-{3,}", line.strip()):
            close_list()
            out.append(paragraph())
            continue

        m = re.match(r"^(#{1,6})\s+(.*)$", line)
        if m:
            close_list()
            level = len(m.group(1))
            out.append(paragraph(m.group(2), heading_styles.get(level, "Heading4")))
            continue

        ul = re.match(r"^[-*]\s+(.*)$", line)
        if ul:
            if list_type != "bullet":
                close_list()
                list_type = "bullet"
            out.append(
                "<w:p><w:pPr><w:pStyle w:val=\"ListParagraph\"/><w:numPr>"
                "<w:ilvl w:val=\"0\"/><w:numId w:val=\"1\"/></w:numPr></w:pPr>"
                f"{runs_from_inline(ul.group(1))}</w:p>"
            )
            continue

        ol = re.match(r"^\d+\.\s+(.*)$", line)
        if ol:
            if list_type != "number":
                close_list()
                list_type = "number"
            out.append(
                "<w:p><w:pPr><w:pStyle w:val=\"ListParagraph\"/><w:numPr>"
                "<w:ilvl w:val=\"0\"/><w:numId w:val=\"2\"/></w:numPr></w:pPr>"
                f"{runs_from_inline(ol.group(1))}</w:p>"
            )
            continue

        if not line.strip():
            close_list()
            continue

        close_list()
        out.append(paragraph(line))

    close_list()
    close_table()
    return "".join(out)


CONTENT_TYPES = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>"""

RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>"""

DOCUMENT_RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>"""

STYLES = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:spacing w:after="40" w:line="240" w:lineRule="auto"/></w:pPr>
    <w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="100" w:after="35"/></w:pPr><w:rPr><w:b/><w:sz w:val="22"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="80" w:after="25"/></w:pPr><w:rPr><w:b/><w:sz w:val="20"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="60" w:after="15"/></w:pPr><w:rPr><w:b/><w:sz w:val="18"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading4"><w:name w:val="heading 4"/><w:basedOn w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="18"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="20"/></w:pPr></w:style>
</w:styles>"""

NUMBERING = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0">
    <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/></w:lvl>
  </w:abstractNum>
  <w:abstractNum w:abstractNumId="1">
    <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/></w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
  <w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>"""

CORE = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>PRD — Algebra Learn-by-Doing App</dc:title>
  <dc:creator>Brilliant Project</dc:creator>
  <cp:lastModifiedBy>Brilliant Project</cp:lastModifiedBy>
</cp:coreProperties>"""


def build_docx(md: str, output: Path) -> None:
    body = md_to_document_body(md)
    document = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    {body}
    <w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="900" w:right="900" w:bottom="900" w:left="900"/></w:sectPr>
  </w:body>
</w:document>"""

    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", CONTENT_TYPES)
        zf.writestr("_rels/.rels", RELS)
        zf.writestr("word/_rels/document.xml.rels", DOCUMENT_RELS)
        zf.writestr("word/document.xml", document)
        zf.writestr("word/styles.xml", STYLES)
        zf.writestr("word/numbering.xml", NUMBERING)
        zf.writestr("docProps/core.xml", CORE)


def main() -> None:
    md = MD_PATH.read_text(encoding="utf-8")
    build_docx(md, DOCX_PATH)
    print(f"Wrote {DOCX_PATH}")


if __name__ == "__main__":
    main()
