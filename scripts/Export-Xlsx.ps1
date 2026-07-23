<#
.SYNOPSIS
  data/events.json を正規化したスキーマ(Events / Performers / Videos の3シート)で
  Excelファイルに書き出す。Googleスプレッドシートにそのままインポート可能。
  Node/Python不要、ローカルのMicrosoft Excel(COM)を直接操作する。

.DESCRIPTION
  Events:     event_id(PK), event_date, weekday, title, open_time, start_time,
              price_adv(前売り), price_door(当日), price_note, date_confidence,
              notes, source_url, source_snapshot_timestamp, source_era
  Performers: event_id(FK), performer_name, order  (縦持ち/ロング形式)
  Videos:     video_id(PK), event_id(FK), video_url, submitted_by, submitted_at, notes
              (今後、複数人が動画URLを投稿していくための入れ物。今回は空+記入例1行のみ)
#>

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$eventsPath = Join-Path $root "data\events.json"
$outPath = Join-Path $root "data\six-dog-data.xlsx"

if (-not (Test-Path $eventsPath)) {
    throw "$eventsPath が見つかりません。先に Parse-Events.ps1 を実行してください。"
}

$events = Get-Content $eventsPath -Raw -Encoding UTF8 | ConvertFrom-Json
Write-Output "イベント件数: $($events.Count)"

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

try {
    $workbook = $excel.Workbooks.Add()

    # 既定で3シートあるので、必要な3枚だけ残して名前を付け直す
    while ($workbook.Worksheets.Count -gt 3) { $workbook.Worksheets.Item($workbook.Worksheets.Count).Delete() }
    while ($workbook.Worksheets.Count -lt 3) { $workbook.Worksheets.Add([System.Reflection.Missing]::Value, $workbook.Worksheets.Item($workbook.Worksheets.Count)) | Out-Null }

    $wsEvents = $workbook.Worksheets.Item(1)
    $wsPerformers = $workbook.Worksheets.Item(2)
    $wsVideos = $workbook.Worksheets.Item(3)
    $wsEvents.Name = "Events"
    $wsPerformers.Name = "Performers"
    $wsVideos.Name = "Videos"

    function Write-HeaderRow($ws, [string[]]$headers) {
        for ($i = 0; $i -lt $headers.Count; $i++) {
            $cell = $ws.Cells.Item(1, $i + 1)
            $cell.Value2 = $headers[$i]
            $cell.Font.Bold = $true
            $cell.Font.Name = "Arial"
            $cell.Interior.Color = 15921906  # 薄いグレー(BGR)
        }
        $ws.Rows.Item(1).Font.Size = 10
        $ws.Application.ActiveWindow.SplitRow = 1
        $ws.Application.ActiveWindow.FreezePanes = $true
    }

    function AutoFitAndFont($ws, [int]$lastCol) {
        $ws.Range($ws.Cells.Item(1, 1), $ws.Cells.Item(1, $lastCol)).EntireColumn.AutoFit() | Out-Null
        $usedRange = $ws.UsedRange
        $usedRange.Font.Name = "Arial"
        $usedRange.Font.Size = 10
    }

    # ---------- Events シート ----------
    $eventsHeaders = @("event_id", "event_date", "weekday", "title", "open_time", "start_time",
                        "price_adv", "price_door", "price_note", "date_confidence", "notes",
                        "source_url", "source_snapshot_timestamp", "source_era")
    $wsEvents.Activate()
    Write-HeaderRow $wsEvents $eventsHeaders
    # event_date/open_time/start_time は文字列のまま保持したい。列全体を先に
    # テキスト書式にしておかないとExcelが日付・時刻のシリアル値に自動変換してしまう。
    $wsEvents.Columns.Item(2).NumberFormat = "@"
    $wsEvents.Columns.Item(5).NumberFormat = "@"
    $wsEvents.Columns.Item(6).NumberFormat = "@"

    $performerRows = New-Object System.Collections.Generic.List[object]
    $eventId = 0
    $row = 2
    foreach ($ev in $events) {
        $eventId++
        $wsEvents.Cells.Item($row, 1).Value2 = [double]$eventId
        $wsEvents.Cells.Item($row, 2).Value2 = [string]$ev.event_date
        $wsEvents.Cells.Item($row, 3).Value2 = [string]$ev.weekday
        $wsEvents.Cells.Item($row, 4).Value2 = [string]$ev.title
        $wsEvents.Cells.Item($row, 5).Value2 = [string]$ev.open_time
        $wsEvents.Cells.Item($row, 6).Value2 = [string]$ev.start_time
        if ($null -ne $ev.price_adv) { $wsEvents.Cells.Item($row, 7).Value2 = [double]$ev.price_adv }
        if ($null -ne $ev.price_door) { $wsEvents.Cells.Item($row, 8).Value2 = [double]$ev.price_door }
        $wsEvents.Cells.Item($row, 9).Value2 = [string]$ev.price_note
        $wsEvents.Cells.Item($row, 10).Value2 = [string]$ev.date_confidence
        $wsEvents.Cells.Item($row, 11).Value2 = [string]$ev.notes
        $wsEvents.Cells.Item($row, 12).Value2 = [string]$ev.source_snapshot_url
        $wsEvents.Cells.Item($row, 13).Value2 = [string]$ev.source_snapshot_timestamp
        $wsEvents.Cells.Item($row, 14).Value2 = [string]$ev.source_era

        $order = 0
        foreach ($p in $ev.performers) {
            $order++
            $performerRows.Add([pscustomobject]@{ event_id = $eventId; performer_name = $p; order = $order })
        }
        $row++
    }
    AutoFitAndFont $wsEvents $eventsHeaders.Count
    Write-Output "Events シート: $($eventId) 行"

    # ---------- Performers シート(縦持ち) ----------
    $performersHeaders = @("event_id", "performer_name", "order")
    $wsPerformers.Activate()
    Write-HeaderRow $wsPerformers $performersHeaders
    $row = 2
    foreach ($pr in $performerRows) {
        $wsPerformers.Cells.Item($row, 1).Value2 = [double]$pr.event_id
        $wsPerformers.Cells.Item($row, 2).Value2 = [string]$pr.performer_name
        $wsPerformers.Cells.Item($row, 3).Value2 = [double]$pr.order
        $row++
    }
    AutoFitAndFont $wsPerformers $performersHeaders.Count
    Write-Output "Performers シート: $($performerRows.Count) 行"

    # ---------- Videos シート(今後の投稿用、記入例のみ) ----------
    $videosHeaders = @("video_id", "event_id", "video_url", "submitted_by", "submitted_at", "notes")
    $wsVideos.Activate()
    Write-HeaderRow $wsVideos $videosHeaders
    $wsVideos.Columns.Item(5).NumberFormat = "@"
    $wsVideos.Cells.Item(2, 1).Value2 = [double]1
    $wsVideos.Cells.Item(2, 2).Value2 = [double]1
    $wsVideos.Cells.Item(2, 3).Value2 = "https://www.youtube.com/watch?v=xxxxxxxxxxx"
    $wsVideos.Cells.Item(2, 4).Value2 = "(記入例)投稿者名"
    $wsVideos.Cells.Item(2, 5).Value2 = "2026-07-23"
    $wsVideos.Cells.Item(2, 6).Value2 = "例: セットリスト映像、当日のライブ映像など"
    $exampleRange = $wsVideos.Range("A2:F2")
    $exampleRange.Font.Italic = $true
    $exampleRange.Font.Color = 10061943  # グレー(BGR)
    $wsVideos.Cells.Item(4, 1).Value2 = "※ event_id は Events シートの event_id 列に対応します。1公演に複数の動画URLを追加できます(行を増やすだけ)。"
    $wsVideos.Cells.Item(4, 1).Font.Italic = $true
    $wsVideos.Cells.Item(4, 1).Font.Size = 9
    AutoFitAndFont $wsVideos $videosHeaders.Count
    Write-Output "Videos シート: 記入例1行 + 説明"

    $wsEvents.Activate()
    $wsEvents.Range("A1").Select() | Out-Null

    if (Test-Path $outPath) { Remove-Item $outPath -Force }
    $workbook.SaveAs($outPath, 51)  # 51 = xlOpenXMLWorkbook (.xlsx)
    $workbook.Close($false)
    Write-Output ""
    Write-Output "書き出し完了: $outPath"
} finally {
    $excel.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
