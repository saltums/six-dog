<#
.SYNOPSIS
  data/events.json を、NotebookLM にアップロードして要約・検索させるための
  読みやすいMarkdownファイルに変換する。

.DESCRIPTION
  NotebookLM には自動投入するAPIが無いため、生成したMarkdownをユーザーが
  手動でNotebookLMにアップロードする想定。年ごとに見出しを区切り、
  公演日・タイトル・出演者・時間・料金・出典を1公演ずつ書き出す。
#>

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$eventsPath = Join-Path $root "data\events.json"
$outPath = Join-Path $root "notebooklm\six-dog-schedule.md"

if (-not (Test-Path $eventsPath)) {
    throw "$eventsPath が見つかりません。先に Parse-Events.ps1 を実行してください。"
}

$events = Get-Content $eventsPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($events.Count -eq 0) {
    throw "events.json にデータがありません。"
}

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("# SiX-DOG 公演履歴アーカイブ")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("名古屋のライブハウス「SiX-DOG」の公演スケジュールを Wayback Machine のアーカイブから復元したものです。")
[void]$sb.AppendLine("公演日 $($events[0].event_date) 〜 $($events[-1].event_date) / 全 $($events.Count) 件。")
[void]$sb.AppendLine("")

$currentYear = $null
$currentMonth = $null

foreach ($ev in $events) {
    $year = $ev.event_date.Substring(0, 4)
    $month = $ev.event_date.Substring(5, 2)

    if ($year -ne $currentYear) {
        [void]$sb.AppendLine("")
        [void]$sb.AppendLine("## $year 年")
        $currentYear = $year
        $currentMonth = $null
    }
    if ($month -ne $currentMonth) {
        [void]$sb.AppendLine("")
        [void]$sb.AppendLine("### $([int]$month) 月")
        $currentMonth = $month
    }

    $title = if ($ev.title) { $ev.title } else { "(タイトル不明)" }
    $weekday = if ($ev.weekday) { "($($ev.weekday))" } else { "" }
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine("**$($ev.event_date)$weekday — $title**")

    $timeStr = if ($ev.open_time -or $ev.start_time) {
        "OPEN $($ev.open_time) / START $($ev.start_time)"
    } else { "時間未定" }
    [void]$sb.AppendLine("- 時間: $timeStr")

    $advStr = if ($null -ne $ev.price_adv) { "¥$($ev.price_adv)" } else { "----" }
    $doorStr = if ($null -ne $ev.price_door) { "¥$($ev.price_door)" } else { "----" }
    $priceLine = "adv $advStr / door $doorStr"
    if ($ev.price_note) { $priceLine += " $($ev.price_note)" }
    [void]$sb.AppendLine("- 料金: $priceLine")

    if ($ev.performers -and $ev.performers.Count -gt 0) {
        [void]$sb.AppendLine("- 出演: $($ev.performers -join ' / ')")
    }
    if ($ev.notes) {
        [void]$sb.AppendLine("- 備考: $($ev.notes)")
    }
    [void]$sb.AppendLine("- 出典: [$($ev.source_snapshot_timestamp)]($($ev.source_snapshot_url))")
}

Set-Content -Path $outPath -Value $sb.ToString() -Encoding UTF8
Write-Output "書き出し完了: $outPath"
