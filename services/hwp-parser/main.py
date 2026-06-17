"""HWP/HWPX text extraction sidecar for MyOwn."""

from __future__ import annotations

import io
import os
import re
import shutil
import subprocess
import tempfile
import zipfile
import xml.etree.ElementTree as ET
from typing import Optional

from fastapi import FastAPI, File, HTTPException, UploadFile

app = FastAPI(title="MyOwn HWP Parser", version="0.1.0")

HWP5TXT = shutil.which("hwp5txt")


def _strip_xml_text(raw: str) -> str:
    text = re.sub(r"<[^>]+>", " ", raw)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def extract_hwpx_text(data: bytes) -> str:
    chunks: list[str] = []
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        for name in sorted(zf.namelist()):
            if not name.endswith(".xml"):
                continue
            if "Contents/" not in name and "BinData/" in name:
                continue
            try:
                raw = zf.read(name).decode("utf-8", errors="ignore")
            except KeyError:
                continue
            try:
                root = ET.fromstring(raw)
                parts = [elem.text for elem in root.iter() if elem.text and elem.text.strip()]
                if parts:
                    chunks.append(" ".join(parts))
                    continue
            except ET.ParseError:
                pass
            stripped = _strip_xml_text(raw)
            if stripped:
                chunks.append(stripped)
    return "\n".join(chunks).strip()


def extract_hwp_text(data: bytes, filename: str) -> str:
    if not HWP5TXT:
        raise RuntimeError(
            "hwp5txt not found. Install pyhwp: pip install pyhwp && ensure hwp5txt is on PATH"
        )

    suffix = ".hwp"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(data)
        tmp_path = tmp.name

    try:
        result = subprocess.run(
            [HWP5TXT, tmp_path],
            capture_output=True,
            text=True,
            timeout=120,
            check=False,
        )
        if result.returncode != 0:
            stderr = (result.stderr or "").strip()
            raise RuntimeError(stderr or f"hwp5txt failed with code {result.returncode}")
        return (result.stdout or "").strip()
    finally:
        os.unlink(tmp_path)


def detect_kind(filename: str, content_type: Optional[str]) -> str:
    name = (filename or "").lower()
    if name.endswith(".hwpx"):
        return "hwpx"
    if name.endswith(".hwp"):
        return "hwp"
    if content_type and "hwp" in content_type.lower():
        return "hwp"
    return "unknown"


@app.get("/health")
def health():
    return {"ok": True, "hwp5txt": HWP5TXT is not None}


@app.post("/extract")
async def extract(file: UploadFile = File(...)):
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")

    kind = detect_kind(file.filename or "", file.content_type)
    try:
        if kind == "hwpx":
            text = extract_hwpx_text(data)
        elif kind == "hwp":
            text = extract_hwp_text(data, file.filename or "document.hwp")
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type. Use .hwp or .hwpx")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    if not text:
        raise HTTPException(status_code=422, detail="No text could be extracted from document")

    return {"text": text, "kind": kind, "length": len(text)}
