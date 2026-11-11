<#
.SYNOPSIS
  SiX-DOG (six-dog.com) の画像(フライヤー・写真・ロゴ・旧サイトのボタン等)を
  Wayback Machine から取得し、data/raw-images/ に保存する。

.DESCRIPTION
  Fetch-Snapshots.ps1 の画像版。CDX API でドメイン全体の画像キャプチャを列挙し、
  digest(内容のハッシュ)単位で重複を除いて全件ダウンロードする。
  URL に "im_" を付けて取得すると Wayback 側の書き換えが入らない元のバイト列が返る。
  取得済みのファイルはスキップするので、何度実行しても差分だけ取りにいく。

  data/raw-images-manifest.json に「どの元URLの、いつのキャプチャか」を残すため、
  HTML(data/raw)側の <img src> と突き合わせて、どのページに載っていた画像かを
  後から辿れる。
#>

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root "data\raw-images"
$manifestPath = Join-Path $root "data\raw-images-manifest.json"
$userAgent = "six-dog-archive/1.0 (personal archive project)"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

Write-Output "CDX API から画像キャプチャ一覧を取得中..."
$cdxUrl = "https://web.archive.org/cdx/search/cdx?url=six-dog.com&matchType=domain&output=json&filter=mimetype:image/.*&filter=statuscode:200&fl=timestamp,original,mimetype,digest"
$raw = Invoke-RestMethod -Uri $cdxUrl -UserAgent $userAgent -TimeoutSec 120
if ($raw.Count -le 1) { throw "CDX APIから結果が取得できませんでした(Internet Archive が一時停止中の可能性があります)。" }

$header = $raw[0]
$rows = $raw[1..($raw.Count - 1)]
$tsIdx = [array]::IndexOf($header, "timestamp")
$urlIdx = [array]::IndexOf($header, "original")
$mimeIdx = [array]::IndexOf($header, "mimetype")
$digestIdx = [array]::IndexOf($header, "digest")
Write-Output "全キャプチャ件数: $($rows.Count)"

$extByMime = @{
    "image/jpeg" = ".jpg"; "image/png" = ".png"; "image/gif" = ".gif"
    "image/webp" = ".webp"; "image/x-icon" = ".ico"; "image/svg+xml" = ".svg"
}

$seen = New-Object 'System.Collections.Generic.HashSet[string]'
$targets = New-Object System.Collections.Generic.List[object]
foreach ($r in $rows) {
    if ($seen.Add([string]$r[$digestIdx])) {
        $targets.Add([pscustomobject]@{
            timestamp = [string]$r[$tsIdx]
            original  = [string]$r[$urlIdx]
            mimetype  = [string]$r[$mimeIdx]
            digest    = [string]$r[$digestIdx]
        })
    }
}
Write-Output "ユニーク画像件数: $($targets.Count)"

function Get-SafeFileName($t) {
    $u = $t.original -replace '^https?://', '' -replace '\?.*$', '' -replace '[:/?&=]', '_'
    $u = $u -replace '\.(jpe?g|png|gif|webp|ico|svg)$', ''
    $u = $u.Substring(0, [Math]::Min(120, $u.Length))
    $ext = $extByMime[$t.mimetype]
    if (-not $ext) { $ext = ".bin" }
    return "$($t.timestamp)_$u$ext"
}

$manifest = New-Object System.Collections.Generic.List[object]
$downloaded = 0; $skipped = 0; $failed = 0; $i = 0

foreach ($t in $targets) {
    $i++
    $fileName = Get-SafeFileName $t
    $filePath = Join-Path $outDir $fileName
    if (Test-Path $filePath) {
        $skipped++
    } else {
        $imgUrl = "https://web.archive.org/web/$($t.timestamp)im_/$($t.original)"
        $ok = $false
        foreach ($attempt in 1..3) {
            try {
                Invoke-WebRequest -Uri $imgUrl -OutFile $filePath -UserAgent $userAgent -TimeoutSec 60 -UseBasicParsing | Out-Null
                $ok = $true
                break
            } catch {
                Start-Sleep -Seconds (3 * $attempt)
            }
        }
        if (-not $ok) {
            Write-Warning "取得失敗 [$($t.timestamp)] $($t.original)"
            if (Test-Path $filePath) { Remove-Item $filePath }
            $failed++
            continue
        }
        $downloaded++
        Start-Sleep -Milliseconds 300
    }
    $manifest.Add([pscustomobject]@{
        timestamp    = $t.timestamp
        original_url = $t.original
        mimetype     = $t.mimetype
        digest       = $t.digest
        file         = $fileName
        wayback_url  = "https://web.archive.org/web/$($t.timestamp)im_/$($t.original)"
    })
    if ($i % 25 -eq 0) { Write-Output "  ...$i / $($targets.Count) 件処理済み" }
}

$utf8 = New-Object System.Text.UTF8Encoding($false)
$sorted = $manifest | Sort-Object original_url, timestamp
[System.IO.File]::WriteAllText($manifestPath, (ConvertTo-Json -InputObject @($sorted) -Depth 5), $utf8)

Write-Output ""
Write-Output "完了: ダウンロード $downloaded 件 / スキップ(取得済み) $skipped 件 / 失敗 $failed 件"
Write-Output "マニフェスト: $manifestPath"
