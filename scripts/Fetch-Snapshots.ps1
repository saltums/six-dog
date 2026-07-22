<#
.SYNOPSIS
  SiX-DOG (six-dog.com) の Wayback Machine スナップショットを取得し、
  data/raw/ にHTMLをキャッシュする。ローカルにNode/Pythonが無い環境向けに
  PowerShellのみで完結させている。

.DESCRIPTION
  サイトは運営期間中にURL構造が何度も変わっており(スケジュールページの
  IDが月ごとに変わる時期もある)、固定URLを追いかける方式は使えない。
  そのため CDX API でドメイン全体のHTMLキャプチャを取得し、コンテンツの
  digest単位で重複を除いた上で全件ダウンロードする。どれがスケジュール
  ページかの判定は Parse-Events.ps1 側でコンテンツの中身を見て行う。
#>

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$rawDir = Join-Path $root "data\raw"
$manifestPath = Join-Path $root "data\raw-manifest.json"

New-Item -ItemType Directory -Force -Path $rawDir | Out-Null

Write-Output "CDX API からキャプチャ一覧を取得中..."
$cdxUrl = "http://web.archive.org/cdx/search/cdx?url=six-dog.com&matchType=domain&output=json&filter=mimetype:text/html&filter=statuscode:200&fl=timestamp,original,digest"
$raw = Invoke-RestMethod -Uri $cdxUrl -UserAgent "six-dog-archive/1.0 (personal archive project)"

if ($raw.Count -le 1) {
    throw "CDX APIから結果が取得できませんでした。"
}

$header = $raw[0]
$rows = $raw[1..($raw.Count - 1)]
$tsIdx = [array]::IndexOf($header, "timestamp")
$urlIdx = [array]::IndexOf($header, "original")
$digestIdx = [array]::IndexOf($header, "digest")

Write-Output "全キャプチャ件数: $($rows.Count)"

# digestベースでグローバルに重複排除(同一コンテンツは最初の1件だけ残す)
$seenDigest = New-Object 'System.Collections.Generic.HashSet[string]'
$targets = New-Object System.Collections.Generic.List[object]
foreach ($r in $rows) {
    $digest = [string]$r[$digestIdx]
    if ($seenDigest.Add($digest)) {
        $targets.Add([pscustomobject]@{
            timestamp = [string]$r[$tsIdx]
            original  = [string]$r[$urlIdx]
            digest    = $digest
        })
    }
}
Write-Output "ユニークコンテンツ件数: $($targets.Count)"

function Get-SafeFileName([string]$timestamp, [string]$originalUrl) {
    $u = $originalUrl -replace '^https?://', '' -replace '[:/?&=]', '_'
    $u = $u.Substring(0, [Math]::Min(120, $u.Length))
    return "$timestamp`_$u.html"
}

$manifest = New-Object System.Collections.Generic.List[object]
$i = 0
$downloaded = 0
$skipped = 0
$failed = 0

foreach ($t in $targets) {
    $i++
    $fileName = Get-SafeFileName -timestamp $t.timestamp -originalUrl $t.original
    $filePath = Join-Path $rawDir $fileName

    if (Test-Path $filePath) {
        $skipped++
    } else {
        $waybackUrl = "https://web.archive.org/web/$($t.timestamp)/$($t.original)"
        try {
            Invoke-WebRequest -Uri $waybackUrl -OutFile $filePath -UserAgent "six-dog-archive/1.0 (personal archive project)" -TimeoutSec 30 | Out-Null
            $downloaded++
            Start-Sleep -Milliseconds 300
        } catch {
            Write-Warning "取得失敗 [$($t.timestamp)] $($t.original): $($_.Exception.Message)"
            $failed++
            continue
        }
    }

    $manifest.Add([pscustomobject]@{
        timestamp    = $t.timestamp
        original_url = $t.original
        digest       = $t.digest
        file         = $fileName
        wayback_url  = "https://web.archive.org/web/$($t.timestamp)/$($t.original)"
    })

    if ($i % 25 -eq 0) { Write-Output "  ...$i / $($targets.Count) 件処理済み" }
}

$manifest | ConvertTo-Json -Depth 5 | Set-Content -Path $manifestPath -Encoding UTF8

Write-Output ""
Write-Output "完了: ダウンロード $downloaded 件 / スキップ(既存キャッシュ) $skipped 件 / 失敗 $failed 件"
Write-Output "マニフェスト: $manifestPath"
