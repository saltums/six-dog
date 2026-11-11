<#
.SYNOPSIS
  Supabase に保存されている「手作業・ユーザー投稿のデータ」をすべて
  data/supabase/*.json に書き出し、git で保存できるようにする。

.DESCRIPTION
  Wayback Machine 由来の元データ(data/raw → data/events.json)は
  Fetch-Snapshots.ps1 / Parse-Events.ps1 で何度でも作り直せるが、
  X・YouTube・mixi・ブログなどから手作業で集めた公演情報や、
  サイト利用者が投稿した動画・関連URL・反応は Supabase にしか存在しない。
  X やmixiは投稿が消えたりログインが必要だったりして再スクレイピングでは
  再現できないため、このスクリプトで定期的にDBのスナップショットを
  リポジトリに残す。復元は Import-Supabase.ps1 で行う。

  出力ファイル名はテーブルの接頭辞(sixdog_)を除いた論理名にしているため、
  将来DBを引っ越して接頭辞が変わっても差分が崩れない。

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts/Export-Supabase.ps1
#>
param(
    [string]$Url = "",
    [string]$Key = "",
    [string]$TablePrefix = $null
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root "data\supabase"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

# 接続先は docs/supabase-config.js(サイト本体と同じ設定)から読む。
# サイトと別の値を使いたいときだけ引数で上書きする。
$configPath = Join-Path $root "docs\supabase-config.js"
$configText = [System.IO.File]::ReadAllText($configPath, [System.Text.Encoding]::UTF8)
if (-not $Url) { $Url = ([regex]::Match($configText, 'const url\s*=\s*"([^"]+)"')).Groups[1].Value }
if (-not $Key) { $Key = ([regex]::Match($configText, 'const anonKey\s*=\s*"([^"]+)"')).Groups[1].Value }
if ($null -eq $TablePrefix -or $TablePrefix -eq "") {
    $TablePrefix = ([regex]::Match($configText, 'const tablePrefix\s*=\s*"([^"]*)"')).Groups[1].Value
}
if (-not $Url -or -not $Key) { throw "Supabase の接続先を docs/supabase-config.js から読めませんでした。" }

# 論理名 → 並び順のキー(差分が安定するよう主キー順で取得する)
$tables = [ordered]@{
    "event_overrides"    = "event_date"
    "event_links"        = "id"
    "event_tweets"       = "id"
    "event_title_groups" = "id"
    "videos"             = "id"
    "event_hype"         = "id"
    "event_emoi"         = "id"
}

$headers = @{ apikey = $Key; Authorization = "Bearer $Key" }
$utf8 = New-Object System.Text.UTF8Encoding($false)
$pageSize = 1000
$summary = New-Object System.Collections.Generic.List[string]

foreach ($logical in $tables.Keys) {
    $table = "$TablePrefix$logical"
    $orderKey = $tables[$logical]
    $rows = New-Object System.Collections.Generic.List[object]
    $offset = 0
    while ($true) {
        $reqUrl = "$Url/rest/v1/$table`?select=*&order=$orderKey.asc&limit=$pageSize&offset=$offset"
        # Windows PowerShell 5.1 は応答の文字コードを誤判定することがあるため、
        # バイト列を受け取って自前で UTF-8 として解釈する
        $resp = Invoke-WebRequest -Uri $reqUrl -Headers $headers -UseBasicParsing -TimeoutSec 60
        $text = $utf8.GetString($resp.RawContentStream.ToArray())
        # Windows PowerShell 5.1 の ConvertFrom-Json は JSON配列を「配列1個」として
        # 返すため、foreach で要素ごとに展開してから数える
        $pageCount = 0
        foreach ($r in (ConvertFrom-Json -InputObject $text)) { $rows.Add($r); $pageCount++ }
        if ($pageCount -lt $pageSize) { break }
        $offset += $pageSize
    }
    $json = ConvertTo-Json -InputObject @($rows.ToArray()) -Depth 10
    [System.IO.File]::WriteAllText((Join-Path $outDir "$logical.json"), $json, $utf8)
    $summary.Add(("{0,-20} {1,5} 件" -f $logical, $rows.Count))
}

$meta = [ordered]@{
    exported_at  = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    source_url   = $Url
    table_prefix = $TablePrefix
    tables       = @($tables.Keys)
}
[System.IO.File]::WriteAllText((Join-Path $outDir "_export-meta.json"), (ConvertTo-Json -InputObject $meta -Depth 5), $utf8)

Write-Output "書き出し完了: $outDir"
$summary | ForEach-Object { Write-Output "  $_" }
