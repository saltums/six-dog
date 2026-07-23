<#
.SYNOPSIS
  data/six-dog-data.xlsx (Events / Performers シート)をレビュー・修正した後、
  その内容を data/events.json に取り込み直す。Node/Python不要、Excel COMで読む。

.DESCRIPTION
  Export-Xlsx.ps1 で書き出したスプレッドシートを人が確認・修正(重複行の削除、
  出演者名の訂正、行の追加など)した後にこのスクリプトを実行すると、
  Events + Performers シートの内容を正として data/events.json を作り直す。
  以後は自動スクレイピング側(Parse-Events.ps1)を再実行するとこの手動修正は
  上書きされる点に注意(その場合は都度レビューし直すか、data/corrections.json
  に恒久的な補正として書き写す)。
#>

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$xlsxPath = Join-Path $root "data\six-dog-data.xlsx"
$eventsPath = Join-Path $root "data\events.json"
$docsDataDir = Join-Path $root "docs\data"

if (-not (Test-Path $xlsxPath)) {
    throw "$xlsxPath が見つかりません。"
}

function Get-CellString($ws, $r, $c) {
    $v = $ws.Cells.Item($r, $c).Value2
    if ($null -eq $v) { return $null }
    $s = [string]$v
    if ($s -eq '') { return $null }
    return $s
}
function Get-CellNumber($ws, $r, $c) {
    $v = $ws.Cells.Item($r, $c).Value2
    if ($null -eq $v) { return $null }
    return [double]$v
}

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

try {
    $wb = $excel.Workbooks.Open($xlsxPath, 0, $true)
    $wsEvents = $wb.Worksheets.Item("Events")
    $wsPerformers = $wb.Worksheets.Item("Performers")

    # ---------- Performers: event_id ごとにグループ化(order順) ----------
    $performersByEvent = @{}
    $pUsed = $wsPerformers.UsedRange
    $pRows = $pUsed.Rows.Count
    for ($r = 2; $r -le $pRows; $r++) {
        $eid = Get-CellNumber $wsPerformers $r 1
        $name = Get-CellString $wsPerformers $r 2
        $order = Get-CellNumber $wsPerformers $r 3
        if ($null -eq $eid -or $null -eq $name) { continue }
        $key = [int]$eid
        if (-not $performersByEvent.ContainsKey($key)) { $performersByEvent[$key] = New-Object System.Collections.Generic.List[object] }
        $ord = if ($null -ne $order) { $order } else { 999999 }
        $performersByEvent[$key].Add([pscustomobject]@{ name = $name; order = $ord })
    }

    # ---------- Events ----------
    $eUsed = $wsEvents.UsedRange
    $eRows = $eUsed.Rows.Count
    $finalEvents = New-Object System.Collections.Generic.List[object]

    for ($r = 2; $r -le $eRows; $r++) {
        $eventIdRaw = Get-CellNumber $wsEvents $r 1
        $eventDate = Get-CellString $wsEvents $r 2
        if ($null -eq $eventIdRaw -or $null -eq $eventDate) { continue }  # 削除された行はスキップ
        $eventId = [int]$eventIdRaw

        $performers = @()
        if ($performersByEvent.ContainsKey($eventId)) {
            $performers = @($performersByEvent[$eventId] | Sort-Object order | ForEach-Object { $_.name })
        }

        $priceAdv = Get-CellNumber $wsEvents $r 7
        $priceDoor = Get-CellNumber $wsEvents $r 8
        $title = Get-CellString $wsEvents $r 4
        $openTime = Get-CellString $wsEvents $r 5
        $startTime = Get-CellString $wsEvents $r 6

        $fieldCount = 0
        if ($title) { $fieldCount++ }
        if ($openTime) { $fieldCount++ }
        if ($startTime) { $fieldCount++ }
        if ($null -ne $priceAdv) { $fieldCount++ }
        if ($null -ne $priceDoor) { $fieldCount++ }
        $fieldCount += $performers.Count

        $finalEvents.Add([pscustomobject]@{
            event_date                = $eventDate
            weekday                   = Get-CellString $wsEvents $r 3
            title                     = $title
            open_time                 = $openTime
            start_time                = $startTime
            price_adv                 = if ($null -ne $priceAdv) { [int]$priceAdv } else { $null }
            price_door                = if ($null -ne $priceDoor) { [int]$priceDoor } else { $null }
            price_note                = Get-CellString $wsEvents $r 9
            date_confidence           = Get-CellString $wsEvents $r 10
            notes                     = Get-CellString $wsEvents $r 11
            performers                = $performers
            source_snapshot_url       = Get-CellString $wsEvents $r 12
            source_snapshot_timestamp = Get-CellString $wsEvents $r 13
            source_era                = Get-CellString $wsEvents $r 14
            field_count               = $fieldCount
        })
    }

    $wb.Close($false)

    $finalEvents = $finalEvents | Sort-Object event_date
    Write-Output "取り込んだイベント件数: $($finalEvents.Count)"

    # 重複日付が無いか最終チェック(スプレッドシート編集で誤って残した場合の検知用)
    $dupDates = $finalEvents | Group-Object event_date | Where-Object { $_.Count -gt 1 }
    if ($dupDates) {
        Write-Warning "同じ日付が複数残っています(スプレッドシート側の確認をお願いします):"
        $dupDates | ForEach-Object { Write-Warning "  $($_.Name) ($($_.Count)件)" }
    }

    New-Item -ItemType Directory -Force -Path (Split-Path $eventsPath) | Out-Null
    New-Item -ItemType Directory -Force -Path $docsDataDir | Out-Null
    $finalEvents | ConvertTo-Json -Depth 6 | Set-Content -Path $eventsPath -Encoding UTF8
    Copy-Item -Path $eventsPath -Destination (Join-Path $docsDataDir "events.json") -Force

    Write-Output "書き出し完了: $eventsPath"
    Write-Output "書き出し完了: $(Join-Path $docsDataDir 'events.json')"
    Write-Output ""
    Write-Output "続けて .\scripts\Export-NotebookLM.ps1 を実行するとNotebookLM用Markdownも更新されます。"
} finally {
    $excel.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
