#!/usr/bin/env python3
"""
MedSync Architecture PDF Generator
Reads docs/MASTER_ARCHITECTURE_TECHNICAL_MANUAL.md, converts to high-end styled HTML,
and compiles to publication-grade PDF via Chrome Headless print-to-pdf.
"""

import os
import sys
import base64
import subprocess
import re
import markdown

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MD_PATH = os.path.join(ROOT_DIR, "docs", "MASTER_ARCHITECTURE_TECHNICAL_MANUAL.md")
HTML_PATH = os.path.join(ROOT_DIR, "docs", "MedSync_Master_Architecture_Technical_Manual.html")
PDF_PATH = os.path.join(ROOT_DIR, "docs", "MedSync_Master_Architecture_Technical_Manual.pdf")
LOGO_PATH = os.path.join(ROOT_DIR, "website", "public", "medsync-logo.png")

CHROME_PATHS = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
]

def get_browser_exe():
    for p in CHROME_PATHS:
        if os.path.exists(p):
            return p
    raise FileNotFoundError("Neither Google Chrome nor Microsoft Edge was found on standard paths.")

def load_logo_base64():
    if os.path.exists(LOGO_PATH):
        with open(LOGO_PATH, "rb") as f:
            return "data:image/png;base64," + base64.b64encode(f.read()).decode("utf-8")
    return ""

def preprocess_markdown(text):
    # Convert GitHub alert blockquotes: > [!NOTE] etc.
    def replace_alert(match):
        alert_type = match.group(1).upper()
        content = match.group(2).strip()
        icon = "ℹ️"
        color_class = "alert-note"
        if alert_type == "TIP":
            icon = "💡"
            color_class = "alert-tip"
        elif alert_type in ("IMPORTANT", "WARNING"):
            icon = "⚠️"
            color_class = "alert-warning"
        elif alert_type == "CAUTION":
            icon = "🚨"
            color_class = "alert-caution"
        return f'<div class="alert-box {color_class}"><div class="alert-title">{icon} {alert_type}</div><div class="alert-content">{content}</div></div>'

    text = re.sub(r'>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*\n((?:>.*(?:\n|$))*)', 
                  lambda m: replace_alert(re.match(r'>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*\n((?:>.*(?:\n|$))*)', m.group(0))), 
                  text)
    return text

def build_html(body_html, logo_data_uri):
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>MedSync — Master Architecture, Technical Manual & Deep-Dive Blueprint</title>
<style>
  @page {{
    size: A4 portrait;
    margin: 18mm 16mm 18mm 16mm;
    @bottom-right {{
      content: counter(page);
    }}
  }}

  *, *::before, *::after {{
    box-sizing: border-box;
  }}

  body {{
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 13px;
    line-height: 1.6;
    color: #1e293b;
    background-color: #ffffff;
    margin: 0;
    padding: 0;
    text-rendering: optimizeLegibility;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }}

  /* Cover Page */
  .cover-page {{
    page-break-after: always;
    display: flex;
    flex-direction: column;
    justifyContent: space-between;
    min-height: 92vh;
    padding: 24px 0;
  }}

  .cover-header {{
    display: flex;
    align-items: center;
    gap: 18px;
    border-bottom: 2px solid #0D7377;
    padding-bottom: 20px;
    margin-bottom: 30px;
  }}

  .cover-logo {{
    width: 64px;
    height: 64px;
    border-radius: 14px;
    box-shadow: 0 4px 14px rgba(13, 115, 119, 0.35);
  }}

  .cover-org-title {{
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #0D7377;
    margin: 0;
  }}

  .cover-org-sub {{
    font-size: 11px;
    color: #64748b;
    margin: 2px 0 0 0;
    letter-spacing: 0.05em;
  }}

  .cover-hero {{
    margin: 40px 0;
  }}

  .cover-badge {{
    display: inline-block;
    background: #E6FFFA;
    color: #0D7377;
    border: 1px solid #38B2AC;
    padding: 4px 12px;
    border-radius: 9999px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin-bottom: 18px;
  }}

  .cover-title {{
    font-size: 32px;
    font-weight: 800;
    line-height: 1.2;
    color: #0f172a;
    margin: 0 0 16px 0;
    letter-spacing: -0.02em;
  }}

  .cover-subtitle {{
    font-size: 16px;
    line-height: 1.5;
    color: #475569;
    margin: 0 0 32px 0;
    max-width: 680px;
  }}

  .cover-metadata-card {{
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 20px 24px;
    margin-top: 24px;
  }}

  .metadata-grid {{
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }}

  .metadata-item {{
    display: flex;
    flex-direction: column;
  }}

  .metadata-label {{
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #64748b;
    margin-bottom: 4px;
  }}

  .metadata-val {{
    font-size: 12px;
    font-weight: 600;
    color: #0f172a;
  }}

  .cover-footer {{
    border-top: 1px solid #e2e8f0;
    padding-top: 18px;
    font-size: 11px;
    color: #94a3b8;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }}

  /* Content Headings */
  h1 {{
    font-size: 22px;
    font-weight: 800;
    color: #0f172a;
    border-bottom: 2px solid #0D7377;
    padding-bottom: 8px;
    margin-top: 36px;
    margin-bottom: 16px;
    letter-spacing: -0.01em;
    break-after: avoid;
  }}

  /* Break before major sections except the first */
  .content-body > h1:not(:first-child) {{
    break-before: page;
  }}

  h2 {{
    font-size: 17px;
    font-weight: 700;
    color: #0D7377;
    margin-top: 28px;
    margin-bottom: 12px;
    border-left: 3px solid #0D7377;
    padding-left: 10px;
    break-after: avoid;
  }}

  h3 {{
    font-size: 14px;
    font-weight: 700;
    color: #1e293b;
    margin-top: 20px;
    margin-bottom: 10px;
    break-after: avoid;
  }}

  h4 {{
    font-size: 13px;
    font-weight: 700;
    color: #334155;
    margin-top: 16px;
    margin-bottom: 8px;
    break-after: avoid;
  }}

  p, li {{
    font-size: 12.5px;
    line-height: 1.65;
    color: #334155;
    margin-top: 0;
    margin-bottom: 10px;
  }}

  ul, ol {{
    padding-left: 20px;
    margin-bottom: 14px;
  }}

  li {{
    margin-bottom: 5px;
  }}

  strong {{
    color: #0f172a;
    font-weight: 700;
  }}

  /* Tables */
  table {{
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0 20px 0;
    font-size: 11px;
    break-inside: avoid;
  }}

  th {{
    background-color: #081B26;
    color: #F8FAFC;
    font-weight: 700;
    text-align: left;
    padding: 8px 10px;
    border: 1px solid #1E293B;
    letter-spacing: 0.03em;
  }}

  td {{
    padding: 7px 10px;
    border: 1px solid #CBD5E1;
    color: #334155;
    vertical-align: top;
  }}

  tr:nth-child(even) td {{
    background-color: #F8FAFC;
  }}

  /* Code & Monospace */
  code {{
    font-family: "Cascadia Code", "JetBrains Mono", Consolas, Monaco, monospace;
    font-size: 11px;
    background-color: #f1f5f9;
    color: #0f766e;
    padding: 2px 5px;
    border-radius: 4px;
    border: 1px solid #e2e8f0;
  }}

  pre {{
    background-color: #060F17;
    color: #E2E8F0;
    font-family: "Cascadia Code", "JetBrains Mono", Consolas, Monaco, monospace;
    font-size: 10px;
    line-height: 1.32;
    padding: 12px 14px;
    border-radius: 8px;
    border-left: 3px solid #00F0FF;
    overflow-x: auto;
    margin: 14px 0;
    break-inside: avoid;
    white-space: pre;
  }}

  pre code {{
    background-color: transparent;
    color: inherit;
    padding: 0;
    border: none;
    font-size: inherit;
  }}

  /* Horizontal Rule */
  hr {{
    border: none;
    border-top: 1px solid #E2E8F0;
    margin: 24px 0;
  }}

  /* Blockquotes & Callouts */
  blockquote {{
    border-left: 3.5px solid #0D7377;
    background-color: #F0FDFA;
    margin: 14px 0;
    padding: 10px 14px;
    color: #134E4A;
    font-size: 12px;
    border-radius: 0 6px 6px 0;
    break-inside: avoid;
  }}

  .alert-box {{
    border-radius: 6px;
    padding: 12px 14px;
    margin: 14px 0;
    font-size: 12px;
    break-inside: avoid;
  }}

  .alert-note {{
    background-color: #F0F9FF;
    border-left: 4px solid #0284C7;
    color: #0C4A6E;
  }}

  .alert-tip {{
    background-color: #F0FDF4;
    border-left: 4px solid #16A34A;
    color: #14532D;
  }}

  .alert-warning {{
    background-color: #FFFBEB;
    border-left: 4px solid #D97706;
    color: #78350F;
  }}

  .alert-title {{
    font-weight: 700;
    margin-bottom: 4px;
    font-size: 12px;
  }}

  /* Page Footer Note */
  .running-footer {{
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 14mm;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 9.5px;
    color: #94A3B8;
    border-top: 1px solid #E2E8F0;
    padding-top: 4px;
  }}
</style>
</head>
<body>

  <!-- Cover Page -->
  <div class="cover-page">
    <div class="cover-header">
      {f'<img src="{logo_data_uri}" class="cover-logo" alt="MedSync">' if logo_data_uri else ''}
      <div>
        <div class="cover-org-title">MedSync Clinical Systems Architecture</div>
        <div class="cover-org-sub">Healthcare-Grade Medication Adherence & Clinical Oversight Ecosystem</div>
      </div>
    </div>

    <div class="cover-hero">
      <div class="cover-badge">Official Architecture Specification • v1.2.1 Production</div>
      <div class="cover-title">Master Architecture, Technical Manual & Deep-Dive Blueprint</div>
      <div class="cover-subtitle">
        An exhaustive technical reproduction specification, complete database DDL, systems rationale matrix,
        and high-availability adherence blueprint for senior patients, caregivers, and licensed physicians.
      </div>

      <div class="cover-metadata-card">
        <div class="metadata-grid">
          <div class="metadata-item">
            <span class="metadata-label">System Release & Target</span>
            <span class="metadata-val">MedSync v1.2.1 (EAS Build e6bddbc8)</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-label">Runtime Engine</span>
            <span class="metadata-val">React Native 0.88.1 • Expo SDK 58 • React 19</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-label">Persistence & Backend</span>
            <span class="metadata-val">PostgreSQL 15.8 (Supabase) • Deno Edge Functions</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-label">Regulatory Compliance</span>
            <span class="metadata-val">DPDP Act 2023 (India) • HIPAA Security Rule § 164.312</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-label">Automated Test Coverage</span>
            <span class="metadata-val">77 Passing Invariant Tests across 35 Test Suites</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-label">Document Security Level</span>
            <span class="metadata-val">Public Open Source Specification • MIT Licensed</span>
          </div>
        </div>
      </div>
    </div>

    <div class="cover-footer">
      <span>Architectural Systems Engineering Group</span>
      <span>Published: November 2026 • Verified Deterministic Build</span>
    </div>
  </div>

  <!-- Document Content -->
  <div class="content-body">
    {body_html}
  </div>

</body>
</html>
"""

def main():
    print(f"Reading master markdown from {MD_PATH}...")
    if not os.path.exists(MD_PATH):
        print(f"Error: {MD_PATH} not found.")
        sys.exit(1)

    with open(MD_PATH, "r", encoding="utf-8") as f:
        md_text = f.read()

    # Preprocess custom alerts
    md_text = preprocess_markdown(md_text)

    # Convert to HTML via markdown package
    print("Converting Markdown to publication-grade HTML...")
    body_html = markdown.markdown(
        md_text,
        extensions=["tables", "fenced_code", "toc"]
    )

    logo_data_uri = load_logo_base64()
    full_html = build_html(body_html, logo_data_uri)

    with open(HTML_PATH, "w", encoding="utf-8") as f:
        f.write(full_html)
    print(f"HTML intermediate saved to: {HTML_PATH}")

    # Discover Chrome / Edge
    browser_exe = get_browser_exe()
    print(f"Using browser executable: {browser_exe}")

    cmd = [
        browser_exe,
        "--headless=new",
        "--disable-gpu",
        "--run-all-compositor-stages-before-draw",
        "--no-pdf-header-footer",
        f"--print-to-pdf={PDF_PATH}",
        HTML_PATH,
    ]

    print(f"Compiling PDF via Headless Chrome: {PDF_PATH}...")
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"Error executing browser PDF command: {res.stderr}")
        sys.exit(res.returncode)

    if os.path.exists(PDF_PATH):
        size_bytes = os.path.getsize(PDF_PATH)
        print(f"SUCCESS: Publication-grade PDF created successfully!")
        print(f"File Path: {PDF_PATH}")
        print(f"File Size: {size_bytes:,} bytes ({size_bytes / (1024*1024):.2f} MB)")
    else:
        print("Error: PDF output file was not created.")
        sys.exit(1)

if __name__ == "__main__":
    main()
