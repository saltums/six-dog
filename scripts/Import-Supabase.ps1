<#
.SYNOPSIS
  Export-Supabase.ps1 で書き出した data/supabase/*.json を Supabase に書き戻す
  (DBの作り直し・引っ越し時の復元用)。

.DESCRIPTION
  事前に supabase/schema.sql を SQL Editor で実行してテーブルと権限を作っておくこと。
  anon key はサイト向けの権限(閲覧・投稿など)しか持たないため、復元には
  ダッシュボードの Project Settings → API Keys にある service_role(secret)key を
  -Key に渡す。このキーは絶対にリポジトリやサイトに書き込まないこと。

  既に同じ主キーの行があれば上書きする(upsert)ので、何度実行しても結果は同じ。

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts/Import-Supabase.ps1 -Key "<service_role key>"
#>
param(
    [Parameter(Mandatory = $true)][string]$Key,
    [string]$Url = "",
    [string]$TablePrefix = $null
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$inDir = Join-Path $root "data\supabase"

$configText = [System.IO.File]::ReadAllText((Join-Path $root "docs\supabase-config.js"), [System.Text.Encoding]::UTF8)
if (-not $Url) { $Url = ([regex]::Match($configText, 'const url\s*=\s*"([^"]+)"')).Groups[1].Value }
if ($null -eq $TablePrefix -or $TablePrefix -eq "") {
    $TablePrefix = ([regex]::Match($configText, 'const tablePrefix\s*=\s*"([^"]*)"')).Groups[1].Value
}

# 論理名 → upsert時の衝突判定に使う主キー
$tables = [ordered]@{
    "event_overrides"    = "event_date"
    "event_links"        = "id"
    "event_tweets"       = "id"
    "event_title_groups" = "id"
    "videos"             = "id"
    "event_hype"         = "id"
    "event_emoi"         = "id"
}

$utf8 = New-Object System.Text.UTF8Encoding($false)
$headers = @{
    apikey        = $Key
    Authorization = "Bearer $Key"
    Prefer        = "resolution=merge-duplicates,return=minimal"
}
$batchSize = 500

foreach ($logical in $tables.Keys) {
    $path = Join-Path $inDir "$logical.json"
    if (-not (Test-Path $path)) { Write-Warning "$logical.json がないためスキップ"; continue }
    # Windows PowerShell 5.1 の ConvertFrom-Json は配列を1個の値として返すため展開する
    $list = New-Object System.Collections.Generic.List[object]
    foreach ($r in (ConvertFrom-Json -InputObject ([System.IO.File]::ReadAllText($path, $utf8)))) { $list.Add($r) }
    $rows = $list.ToArray()
    $table = "$TablePrefix$logical"
    for ($i = 0; $i -lt $rows.Count; $i += $batchSize) {
        $batch = $rows[$i..([Math]::Min($i + $batchSize, $rows.Count) - 1)]
        $body = $utf8.GetBytes((ConvertTo-Json -InputObject @($batch) -Depth 10 -Compress))
        Invoke-WebRequest -Uri "$Url/rest/v1/$table`?on_conflict=$($tables[$logical])" -Method Post `
            -Headers $headers -ContentType "application/json; charset=utf-8" -Body $body -UseBasicParsing | Out-Null
    }
    Write-Output ("{0,-20} {1,5} 件を復元" -f $logical, $rows.Count)
}

Write-Output ""
Write-Output "完了。id の連番を復元後のデータに合わせるため、最後に supabase/schema.sql 末尾の"
Write-Output "「連番の再同期」ブロックを SQL Editor で実行してください。"
