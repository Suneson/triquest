# serve.ps1 — dependency-free static dev server (fallback for machines without
# Node). Serves the repo root on http://localhost:<port>/ with ES-module-safe
# MIME types. Usage: powershell -File tools/serve.ps1 [port]
param([int]$Port = 8744)

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.mjs'  = 'text/javascript; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.webmanifest' = 'application/manifest+json; charset=utf-8'
  '.png'  = 'image/png'
  '.webp' = 'image/webp'
  '.jpg'  = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.svg'  = 'image/svg+xml'
  '.ico'  = 'image/x-icon'
  '.txt'  = 'text/plain; charset=utf-8'
  '.ics'  = 'text/calendar; charset=utf-8'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Output "Serving $root at http://localhost:$Port/"

while ($listener.IsListening) {
  try { $ctx = $listener.GetContext() } catch { break }
  $req = $ctx.Request
  $res = $ctx.Response
  try {
    $rel = [Uri]::UnescapeDataString($req.Url.AbsolutePath.TrimStart('/'))
    if ($rel -eq '') { $rel = 'index.html' }
    $path = Join-Path $root $rel
    # Resolve and confine to the root (no traversal).
    $full = [IO.Path]::GetFullPath($path)
    if (-not $full.StartsWith([string]$root, [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path $full -PathType Leaf)) {
      $res.StatusCode = 404
      $body = [Text.Encoding]::UTF8.GetBytes('404 Not Found')
    } else {
      $ext = [IO.Path]::GetExtension($full).ToLowerInvariant()
      $type = $mime[$ext]; if (-not $type) { $type = 'application/octet-stream' }
      $res.ContentType = $type
      $res.Headers.Add('Cache-Control', 'no-store')  # dev: always fresh
      $body = [IO.File]::ReadAllBytes($full)
    }
    $res.ContentLength64 = $body.Length
    $res.OutputStream.Write($body, 0, $body.Length)
  } catch {
    try { $res.StatusCode = 500 } catch {}
  } finally {
    try { $res.OutputStream.Close() } catch {}
  }
}
