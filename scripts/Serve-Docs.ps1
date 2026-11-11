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
    ".png"   = "image/png"
    ".jpg"   = "image/jpeg"
    ".jpeg"  = "image/jpeg"
    ".gif"   = "image/gif"
    ".svg"   = "image/svg+xml"
    ".ico"   = "image/x-icon"
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
                $res.Headers.Add("Cache-Control", "no-store, no-cache, must-revalidate")
                $bytes = [System.IO.File]::ReadAllBytes($filePath)
                $res.ContentLength64 = $bytes.Length
                # HEAD リクエスト(起動確認などで来る)に本文を書くと例外でサーバーごと落ちる
                if ($req.HttpMethod -ne "HEAD") { $res.OutputStream.Write($bytes, 0, $bytes.Length) }
            } else {
                $res.StatusCode = 404
                $msg = [System.Text.Encoding]::UTF8.GetBytes("Not Found")
                if ($req.HttpMethod -ne "HEAD") { $res.OutputStream.Write($msg, 0, $msg.Length) }
            }
        } catch {
            # 1件のリクエストの失敗(切断など)でサーバー全体を止めない
            Write-Warning "リクエスト処理に失敗: $($req.Url) $($_.Exception.Message)"
        } finally {
            try { $res.OutputStream.Close() } catch {}
        }
    }
} finally {
    $listener.Stop()
}
