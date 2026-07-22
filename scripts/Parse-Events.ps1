<#
.SYNOPSIS
  data/raw/ にキャッシュされたSiX-DOGのHTMLスナップショットを解析し、
  スケジュール情報を data/events.json に正規化する。

.DESCRIPTION
  サイトは世代によってURL構造も月見出しの有無も異なるが、1日分のエントリは
  共通して「N日 (曜)タイトル / OPEN/START時刻 / adv/door料金 / 出演者」という
  微細フォーマットを持つ。よってURL構造では分岐せず、共通の日エントリパーサーを
  1つ実装し、月の特定方法だけを「<h2>YYYY/MM</h2>見出しがあるか」で分岐する。

  同じ日付が複数スナップショットに重複して現れるため、埋まっているフィールド数が
  多いレコードを優先し、同数ならキャプチャ日時が新しい方を採用する。
#>

$ErrorActionPreference = "Stop"
[System.Text.RegularExpressions.RegexOptions]$ROpt = [System.Text.RegularExpressions.RegexOptions]::Singleline

$root = Split-Path -Parent $PSScriptRoot
$rawDir = Join-Path $root "data\raw"
$manifestPath = Join-Path $root "data\raw-manifest.json"
$eventsPath = Join-Path $root "data\events.json"
$errorLogPath = Join-Path $root "data\parse-errors.log"
$docsDataDir = Join-Path $root "docs\data"

if (-not (Test-Path $manifestPath)) {
    throw "$manifestPath が見つかりません。先に Fetch-Snapshots.ps1 を実行してください。"
}

$manifest = Get-Content $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
Write-Output "マニフェスト件数: $($manifest.Count)"

# ---------- ユーティリティ ----------

function Convert-ZenkakuDigits([string]$s) {
    if (-not $s) { return $s }
    $sb = New-Object System.Text.StringBuilder
    foreach ($ch in $s.ToCharArray()) {
        $code = [int][char]$ch
        if ($code -ge 0xFF10 -and $code -le 0xFF19) {
            [void]$sb.Append([char]($code - 0xFF10 + [int][char]'0'))
        } else {
            [void]$sb.Append($ch)
        }
    }
    return $sb.ToString()
}

function ConvertTo-PlainLines([string]$htmlFragment) {
    $t = $htmlFragment
    $t = [regex]::Replace($t, '<br\s*/?>', "`n", $ROpt)
    $t = [regex]::Replace($t, '<[^>]+>', '', $ROpt)
    $t = $t -replace '&amp;', '&' -replace '&nbsp;', ' ' -replace '&quot;', '"'
    $lines = $t -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' }
    return $lines
}

$dayLineRe = [regex]'^(\d{1,2})日\s*[\(（]([^\)）]{1,4})[\)）]\s*(.*)$'
$openLineRe = [regex]'^OPEN\s*/\s*START\s*(.*)$'
$advLineRe = [regex]'^adv\s*/\s*door\s*(.*)$'

function Parse-DayBlock([string[]]$lines, [int]$year, [int]$month, [hashtable]$sourceInfo, [System.Collections.Generic.List[string]]$errorLog) {
    if ($lines.Count -eq 0) { return $null }
    $first = Convert-ZenkakuDigits $lines[0]
    $m = $dayLineRe.Match($first)
    if (-not $m.Success) { return $null }

    $day = [int]$m.Groups[1].Value
    $weekday = $m.Groups[2].Value
    $titleParts = New-Object System.Collections.Generic.List[string]
    if ($m.Groups[3].Value.Trim() -ne '') { $titleParts.Add($m.Groups[3].Value.Trim()) }

    $openTimeRaw = $null
    $advRaw = $null
    $notes = New-Object System.Collections.Generic.List[string]
    $performerLines = New-Object System.Collections.Generic.List[string]
    $mode = "title"   # title -> open -> adv -> performers

    for ($i = 1; $i -lt $lines.Count; $i++) {
        $line = Convert-ZenkakuDigits $lines[$i]

        if ($mode -eq "title" -and $openLineRe.IsMatch($line)) {
            $rest = $openLineRe.Match($line).Groups[1].Value.Trim()
            # 世代によっては "OPEN/START <時刻> adv/door <料金>" が同一行にまとまっている
            $inlineAdv = [regex]::Match($rest, 'adv\s*/\s*door\s*(.*)$')
            if ($inlineAdv.Success) {
                $openTimeRaw = $rest.Substring(0, $inlineAdv.Index).Trim()
                $advRaw = $inlineAdv.Groups[1].Value.Trim()
                $mode = "performers"
            } else {
                $openTimeRaw = $rest
                $mode = "adv"
            }
            continue
        }
        if ($mode -eq "title") {
            if ($line.StartsWith("※")) { $notes.Add($line) } else { $titleParts.Add($line) }
            continue
        }
        if ($mode -eq "adv" -and $advLineRe.IsMatch($line)) {
            $advRaw = $advLineRe.Match($line).Groups[1].Value.Trim()
            $mode = "performers"
            continue
        }
        if ($mode -eq "adv") {
            # OPEN/START の次に adv/door が来ない稀なケース。ノートとして退避。
            if ($line.StartsWith("※")) { $notes.Add($line) } else { $notes.Add($line) }
            continue
        }
        # mode = performers
        if ($line.StartsWith("※")) { $notes.Add($line); continue }
        if ($line -match '。' -and $line -notmatch '/') {
            # 「予約制のイベントになります…」のような文章はノート扱い
            $notes.Add($line)
            continue
        }
        $performerLines.Add($line)
    }

    if (-not $openTimeRaw) {
        $errorLog.Add("[$($sourceInfo.file)] day=$day : OPEN/START行が見つからずスキップ")
        return $null
    }

    # OPEN/START のパース
    $openTime = $null; $startTime = $null
    if ($openTimeRaw -match '未定') {
        # null のまま
    } elseif ($openTimeRaw -match '^(\d{1,2}:\d{2})\s*/\s*(\d{1,2}:\d{2})$') {
        $openTime = $matches[1]; $startTime = $matches[2]
    } elseif ($openTimeRaw -match '(\d{1,2}:\d{2})') {
        $openTime = $matches[1]
    }

    # adv/door のパース
    $priceAdv = $null; $priceDoor = $null; $priceNote = $null
    if ($advRaw) {
        $advRawNorm = $advRaw -replace '\\', '￥'
        $priceMatch = [regex]::Match($advRawNorm, '[￥¥]\s*([\d,]+|-+)\s*/\s*[￥¥]?\s*([\d,]+|-+)')
        if ($priceMatch.Success) {
            $a = $priceMatch.Groups[1].Value -replace ',', ''
            $d = $priceMatch.Groups[2].Value -replace ',', ''
            if ($a -match '^\d+$') { $priceAdv = [int]$a }
            if ($d -match '^\d+$') { $priceDoor = [int]$d }
            $priceNote = $advRawNorm.Substring($priceMatch.Index + $priceMatch.Length).Trim()
            if ($priceNote -eq '') { $priceNote = $null }
        } else {
            $priceNote = $advRawNorm
        }
    }

    $performers = New-Object System.Collections.Generic.List[string]
    foreach ($pl in $performerLines) {
        foreach ($tok in ($pl -split '[/／]')) {
            $tt = $tok.Trim()
            if ($tt -ne '') { $performers.Add($tt) }
        }
    }

    $title = ($titleParts -join ' ').Trim()
    if ($title -match '^-+$') { $title = $null }
    if ($title -eq '') { $title = $null }

    $dateStr = "{0:D4}-{1:D2}-{2:D2}" -f $year, $month, $day
    $parsedOk = $true
    try { [datetime]::ParseExact($dateStr, "yyyy-MM-dd", $null) | Out-Null } catch { $parsedOk = $false }
    if (-not $parsedOk) {
        $errorLog.Add("[$($sourceInfo.file)] 不正な日付 $dateStr をスキップ")
        return $null
    }

    $fieldCount = 0
    if ($title) { $fieldCount++ }
    if ($openTime) { $fieldCount++ }
    if ($startTime) { $fieldCount++ }
    if ($priceAdv) { $fieldCount++ }
    if ($priceDoor) { $fieldCount++ }
    if ($performers.Count -gt 0) { $fieldCount += $performers.Count }

    if ($fieldCount -eq 0) {
        # タイトルも時間も料金も出演者も無い = 「---------」のような未確定日。
        # イベントとして扱わずカレンダー上は空欄にする。
        return $null
    }

    return [pscustomobject]@{
        event_date                = $dateStr
        weekday                   = $weekday
        title                     = $title
        open_time                 = $openTime
        start_time                = $startTime
        price_adv                 = $priceAdv
        price_door                = $priceDoor
        price_note                = $priceNote
        performers                = @($performers)
        notes                     = if ($notes.Count -gt 0) { ($notes -join '; ') } else { $null }
        source_snapshot_url       = $sourceInfo.wayback_url
        source_snapshot_timestamp = $sourceInfo.timestamp
        source_era                = $sourceInfo.era
        field_count               = $fieldCount
    }
}

function Get-DayBlocks([string]$html) {
    # <p>...</p> のうち、次の<p>かdiv class="hr"かセクション終端までを1ブロックとして雑に切り出す
    return [regex]::Matches($html, '<p>(.*?)</p>', $ROpt) | ForEach-Object { $_.Groups[1].Value }
}

function Split-DaySubBlocks([string[]]$lines) {
    # 初期の世代(2011年頃)では <div class="hr"> による区切りが無く、
    # 1つの<p>ブロックに複数日分のエントリが連続して詰め込まれている。
    # 「N日 (曜)」で始まる行が出るたびに新しいサブブロックとして切り直す。
    $groups = New-Object System.Collections.Generic.List[object]
    $current = New-Object System.Collections.Generic.List[string]
    foreach ($line in $lines) {
        $norm = Convert-ZenkakuDigits $line
        if ($dayLineRe.IsMatch($norm) -and $current.Count -gt 0) {
            $groups.Add($current.ToArray())
            $current = New-Object System.Collections.Generic.List[string]
        }
        $current.Add($line)
    }
    if ($current.Count -gt 0) { $groups.Add($current.ToArray()) }
    # PowerShellはパイプライン出力時にネストした配列を平坦化してしまうため、
    # 単項カンマでラップして「配列のリスト」を1個のオブジェクトとして返す
    return ,$groups
}

# ---------- メイン処理 ----------

$allEvents = New-Object System.Collections.Generic.List[object]
$errorLog = New-Object System.Collections.Generic.List[string]
$scannedSchedulePages = 0

foreach ($entry in $manifest) {
    $filePath = Join-Path $rawDir $entry.file
    if (-not (Test-Path $filePath)) { continue }
    $html = Get-Content $filePath -Raw -Encoding UTF8

    if ($html -notmatch 'OPEN\s*/\s*START' -or $html -notmatch 'adv\s*/\s*door') {
        continue  # スケジュールページではない
    }
    $scannedSchedulePages++

    $sourceInfoBase = @{
        file        = $entry.file
        wayback_url = $entry.wayback_url
        timestamp   = $entry.timestamp
    }

    $h2Matches = [regex]::Matches($html, '<h2>\s*(\d{4})\s*/\s*(\d{1,2})\s*</h2>(.*?)(?=<h2>|\z)', $ROpt)

    if ($h2Matches.Count -gt 0) {
        foreach ($hm in $h2Matches) {
            $year = [int]$hm.Groups[1].Value
            $month = [int]$hm.Groups[2].Value
            $blockHtml = $hm.Groups[3].Value
            $sourceInfo = $sourceInfoBase.Clone()
            $sourceInfo.era = "accordion"
            foreach ($pInner in (Get-DayBlocks $blockHtml)) {
                $lines = ConvertTo-PlainLines $pInner
                foreach ($subLines in (Split-DaySubBlocks $lines)) {
                    $ev = Parse-DayBlock -lines $subLines -year $year -month $month -sourceInfo $sourceInfo -errorLog $errorLog
                    if ($ev) { $allEvents.Add($ev) }
                }
            }
        }
    } else {
        # 月見出しなし: キャプチャのタイムスタンプから年月を推定(その月の「現在の」スケジュールページである想定)
        $ts = $entry.timestamp
        $year = [int]$ts.Substring(0, 4)
        $month = [int]$ts.Substring(4, 2)
        $sourceInfo = $sourceInfoBase.Clone()
        $sourceInfo.era = "single-month"
        foreach ($pInner in (Get-DayBlocks $html)) {
            $lines = ConvertTo-PlainLines $pInner
            foreach ($subLines in (Split-DaySubBlocks $lines)) {
                $ev = Parse-DayBlock -lines $subLines -year $year -month $month -sourceInfo $sourceInfo -errorLog $errorLog
                if ($ev) { $allEvents.Add($ev) }
            }
        }
    }
}

Write-Output "スケジュールページと判定: $scannedSchedulePages 件"
Write-Output "抽出した生イベント件数(重複含む): $($allEvents.Count)"

# ---------- 重複排除: event_date ごとに field_count 最大 → タイムスタンプ最新 を採用 ----------

$grouped = $allEvents | Group-Object event_date
$finalEvents = New-Object System.Collections.Generic.List[object]
foreach ($g in $grouped) {
    $best = $g.Group | Sort-Object -Property @{Expression = "field_count"; Descending = $true }, @{Expression = "source_snapshot_timestamp"; Descending = $true } | Select-Object -First 1
    $finalEvents.Add($best)
}

$finalEvents = $finalEvents | Sort-Object event_date

Write-Output "重複排除後イベント件数: $($finalEvents.Count)"
if ($finalEvents.Count -gt 0) {
    Write-Output "日付範囲: $($finalEvents[0].event_date) 〜 $($finalEvents[-1].event_date)"
}
Write-Output "パースエラー/警告件数: $($errorLog.Count)"

New-Item -ItemType Directory -Force -Path (Split-Path $eventsPath) | Out-Null
New-Item -ItemType Directory -Force -Path $docsDataDir | Out-Null

$finalEvents | ConvertTo-Json -Depth 6 | Set-Content -Path $eventsPath -Encoding UTF8
Copy-Item -Path $eventsPath -Destination (Join-Path $docsDataDir "events.json") -Force

$errorLog | Set-Content -Path $errorLogPath -Encoding UTF8

Write-Output ""
Write-Output "書き出し完了: $eventsPath"
Write-Output "書き出し完了: $(Join-Path $docsDataDir 'events.json')"
Write-Output "エラーログ: $errorLogPath"
