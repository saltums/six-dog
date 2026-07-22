<#
.SYNOPSIS
  Node/Pythonが無い環境向けの、docs/ を配信するだけの最小PowerShell製静的サーバー。
  開発中のプレビュー用途のみ(GitHub Pagesでは不要)。
#>
param(
    [int]$Port = 8080
)

$root = Split-Path -Parent $PSScriptRoot
$docsDir = Join-Path $root "docs"

$mime = @{
    ".html" = "text/html; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".woff2" = "font/woff2"
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Output "Serving $docsDir at http://localhost:$Port/  (Ctrl+C to stop)"

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $req = $context.Request
        $res = $context.Response
        try {
            $path = $req.Url.AbsolutePath
            if ($path -eq "/") { $path = "/index.html" }
            $filePath = Join-Path $docsDir ($path.TrimStart("/"))
            $filePath = [System.IO.Path]::GetFullPath($filePath)

            if (-not $filePath.StartsWith([System.IO.Path]::GetFullPath($docsDir))) {
                $res.StatusCode = 403
            } elseif (Test-Path $filePath -PathType Leaf) {
                $ext = [System.IO.Path]::GetExtension($filePath)
                $ct = $mime[$ext]
                if (-not $ct) { $ct = "application/octet-stream" }
                $res.ContentType = $ct
                $bytes = [System.IO.File]::ReadAllBytes($filePath)
                $res.ContentLength64 = $bytes.Length
                $res.OutputStream.Write($bytes, 0, $bytes.Length)
            } else {
                $res.StatusCode = 404
                $msg = [System.Text.Encoding]::UTF8.GetBytes("Not Found")
                $res.OutputStream.Write($msg, 0, $msg.Length)
            }
        } finally {
            $res.OutputStream.Close()
        }
    }
} finally {
    $listener.Stop()
}
