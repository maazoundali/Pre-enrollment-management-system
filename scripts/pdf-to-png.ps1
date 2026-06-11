# pdf-to-png.ps1
# Converts the first page of a PDF to a PNG using Windows built-in PDF APIs.
# Usage:  powershell -File scripts/pdf-to-png.ps1 [<path-to-pdf>]
#
# If no argument given, searches for the first relevenotesbqc.pdf in public/uploads.

param(
    [string]$PdfPath = ""
)

Add-Type -AssemblyName Windows.Data
Add-Type -AssemblyName Windows.Storage
Add-Type -AssemblyName System.Drawing

# ── Find PDF if not given ──────────────────────────────────────────────────────
if (-not $PdfPath) {
    $found = Get-ChildItem -Path "public\uploads" -Recurse -Filter "relevenotesbqc.pdf" |
             Select-Object -First 1
    if (-not $found) {
        Write-Host "No relevenotesbqc.pdf found in public/uploads." -ForegroundColor Red
        Write-Host "Provide a path: powershell -File scripts/pdf-to-png.ps1 path\to\file.pdf"
        exit 1
    }
    $PdfPath = $found.FullName
}

if (-not (Test-Path $PdfPath)) {
    Write-Host "File not found: $PdfPath" -ForegroundColor Red
    exit 1
}

$outPath = [System.IO.Path]::ChangeExtension($PdfPath, ".png")
Write-Host "Converting: $PdfPath"
Write-Host "Output    : $outPath"

# ── Use Windows.Data.Pdf to render page 0 ─────────────────────────────────────
try {
    $absPath = [System.IO.Path]::GetFullPath($PdfPath)
    $uri     = [System.Uri]::new($absPath)

    $pdfFile  = [Windows.Storage.StorageFile]::GetFileFromPathAsync($absPath).GetAwaiter().GetResult()
    $pdfDoc   = [Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($pdfFile).GetAwaiter().GetResult()

    if ($pdfDoc.PageCount -eq 0) {
        Write-Host "PDF has no pages." -ForegroundColor Red
        exit 1
    }

    $page    = $pdfDoc.GetPage(0)
    $outFile = [System.IO.Path]::GetFullPath($outPath)

    # Render at 2x for better OCR quality
    $renderOptions = [Windows.Data.Pdf.PdfPageRenderOptions]::new()
    $renderOptions.DestinationWidth  = [uint32]($page.Size.Width  * 2)
    $renderOptions.DestinationHeight = [uint32]($page.Size.Height * 2)

    $stream = [Windows.Storage.Streams.InMemoryRandomAccessStream]::new()
    $page.RenderToStreamAsync($stream, $renderOptions).GetAwaiter().GetResult()

    # Convert IRandomAccessStream → byte[] → File
    $reader = [Windows.Storage.Streams.DataReader]::FromBuffer($stream.GetInputStreamAt(0).ReadAsync(
        [Windows.Storage.Streams.Buffer]::new([uint32]$stream.Size),
        [uint32]$stream.Size,
        [Windows.Storage.Streams.InputStreamOptions]::None
    ).GetAwaiter().GetResult())

    $bytes = [byte[]]::new($stream.Size)
    $reader.ReadBytes($bytes)
    [System.IO.File]::WriteAllBytes($outFile, $bytes)

    Write-Host "Done! Saved to: $outFile" -ForegroundColor Green
    Write-Host ""
    Write-Host "Now run the OCR benchmark:"
    Write-Host "  node scripts/benchmark-ocr.mjs `"$outFile`""

} catch {
    Write-Host "Windows PDF API failed: $_" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Alternative: open the PDF in Microsoft Edge, press Ctrl+P,"
    Write-Host "  choose 'Microsoft Print to PDF' — save as a new file first."
    Write-Host "  Then screenshot a page with Win+Shift+S and save as PNG."
    Write-Host "  Then run: node scripts/benchmark-ocr.mjs path\to\screenshot.png"
}
