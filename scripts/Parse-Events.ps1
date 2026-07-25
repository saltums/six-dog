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
$correctionsPath = Join-Path $root "data\corrections.json"

if (-not (Test-Path $manifestPath)) {
    throw "$manifestPath が見つかりません。先に Fetch-Snapshots.ps1 を実行してください。"
}

$manifest = Get-Content $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
Write-Output "マニフェスト件数: $($manifest.Count)"

# data/corrections.json: パーサーを直さなくても後から手動で直せる補正リスト
# (演者名の除外・別名の統一)。無くても動くようフォールバックを用意する。
$excludePerformers = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
$renamePerformers = @{}
if (Test-Path $correctionsPath) {
    $corrections = Get-Content $correctionsPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($corrections.excludePerformers) {
        foreach ($n in $corrections.excludePerformers) { [void]$excludePerformers.Add($n.Trim()) }
    }
    if ($corrections.renamePerformers) {
        $corrections.renamePerformers.PSObject.Properties | Where-Object { $_.Name -ne '_comment' } | ForEach-Object {
            $renamePerformers[$_.Name] = $_.Value
        }
    }
    Write-Output "補正ファイル読み込み: 除外 $($excludePerformers.Count) 件 / 別名統一 $($renamePerformers.Count) 件"
}

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
    # 2016年以降の世代はp内末尾にスライドショー画像(キャプション付き)が入っており、
    # 出演者名と紛れるため丸ごと除去する(常にブロック末尾に出現する前提)
    $t = [regex]::Replace($t, '<span class="bd-slide.*', '', $ROpt)
    $t = [regex]::Replace($t, '<br\s*/?>', "`n", $ROpt)
    $t = [regex]::Replace($t, '<[^>]+>', '', $ROpt)
    $t = $t -replace '&amp;', '&' -replace '&nbsp;', ' ' -replace '&quot;', '"'
    $lines = $t -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' }
    return $lines
}

$dayLineRe = [regex]'^(\d{1,2})日\s*[\(（]([^\)）]{1,4})[\)）]\s*(.*)$'
$openLineRe = [regex]'^OPEN\s*/\s*START\s*(.*)$'
# 2016年以降の世代は "adv/door" ではなく "前売/当日" 表記になる
$advLineRe = [regex]'^(?:adv\s*/\s*door|前売\s*/\s*当日)\s*(.*)$'

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
            # 世代によっては "OPEN/START <時刻> adv/door(or 前売/当日) <料金>" が同一行にまとまっている
            $inlineAdv = [regex]::Match($rest, '(?:adv\s*/\s*door|前売\s*/\s*当日)\s*(.*)$')
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
        if ($line -match 'Drink代' -or $line -match '参加大学' -or $line -match '募集中' -or $line -match '発売中' -or $line -match 'コラボイベント') {
            # "Drink代のみ￥500" "参加大学：..." のような案内文はノート扱い(出演者ではない)
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
        # "/"や"／"だけでなく、箇条書きの"●"で区切られている出演者リストにも対応
        foreach ($tok in ($pl -split '[/／●]')) {
            $tt = $tok.Trim()
            # "バンドA etc..." "バンドBetc...." のように"/"の前に無く末尾にくっつく
            # "etc"(大小文字問わず、ドット任意)や "and more...." を除去する。
            # 除去した結果空になったトークンは捨てる。
            $tt = [regex]::Replace($tt, '(?i)\s*(etc\.*|and more\.*)\s*$', '')
            $tt = $tt.Trim()
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

    # 月見出しが無いページのうち、自己参照サイドバーで年月を確定できたものは
    # "single-month-confirmed"(信頼できる)、それでも分からずキャプチャ日時から
    # 推測しただけのものは "single-month"(実際とズレている可能性がある)として
    # 世代を分けている。
    $dateConfidence = if ($sourceInfo.era -eq 'single-month') { 'estimated' } else { 'confirmed' }

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
        date_confidence           = $dateConfidence
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

# サイトには <h3>Schedule</h3> / <h3>Month</h3> の下に
# <a href="pgNNN.html">YYYY.MM</a> という月間ナビゲーションのサイドバーがあり、
# ここに「自分自身へのリンク」が含まれる。月見出しを持たないページでも、
# このサイドバーから自分の本当の年月を確定できる(キャプチャ日時からの
# 推測より信頼できる — 実データで「2015年1月にキャプチャされたページの
# 中身は実は2014年10月分だった」というズレが見つかったため)。
$selfRefRe = [regex]'<a href="(pg\d+\.html)">\s*(\d{4})\s*\.\s*(\d{1,2})\s*</a>'
function Get-SelfReferencedMonth([string]$html, [string]$originalUrl) {
    $selfPage = [regex]::Match($originalUrl, 'pg\d+\.html')
    if (-not $selfPage.Success) { return $null }
    $selfName = $selfPage.Value
    foreach ($m in $selfRefRe.Matches($html)) {
        if ($m.Groups[1].Value -eq $selfName) {
            return [pscustomobject]@{ year = [int]$m.Groups[2].Value; month = [int]$m.Groups[3].Value }
        }
    }
    return $null
}

# ---------- メイン処理 ----------

$allEvents = New-Object System.Collections.Generic.List[object]
$errorLog = New-Object System.Collections.Generic.List[string]
$scannedSchedulePages = 0

foreach ($entry in $manifest) {
    $filePath = Join-Path $rawDir $entry.file
    if (-not (Test-Path $filePath)) { continue }
    $html = Get-Content $filePath -Raw -Encoding UTF8

    $hasAdvDoor = $html -match 'adv\s*/\s*door' -or $html -match '前売\s*/\s*当日'
    if ($html -notmatch 'OPEN\s*/\s*START' -or -not $hasAdvDoor) {
        continue  # スケジュールページではない
    }
    $scannedSchedulePages++

    $sourceInfoBase = @{
        file        = $entry.file
        wayback_url = $entry.wayback_url
        timestamp   = $entry.timestamp
    }

    $h2Matches = [regex]::Matches($html, '<h2>\s*(\d{4})\s*/\s*(\d{1,2})\s*</h2>(.*?)(?=<h2>|\z)', $ROpt)
    # 2016年以降: 月ごとの見出しではなく「MM/DD(曜) 【タイトル】」という日ごとの<h2>になる
    $dayLevelH2Matches = [regex]::Matches($html, '<h2>\s*(\d{1,2})/(\d{1,2})\s*[\(（]([^\)）]{1,4})[\)）]\s*(?:<br\s*/?>)?\s*(?:【([^】]*)】)?\s*</h2>(.*?)(?=<h2>|\z)', $ROpt)

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
    } elseif ($dayLevelH2Matches.Count -gt 0) {
        # ページ全体で年は共通。自己参照サイドバー(最も信頼できる)→
        # <h3>2016.11 SiX-DOG Schedule</h3>のような表記→キャプチャ日時の順で代用する。
        $selfRef = Get-SelfReferencedMonth $html $entry.original_url
        $pageYearMatch = [regex]::Match($html, '(\d{4})\s*\.\s*\d{1,2}\s*SiX-DOG\s*Schedule')
        $pageYear = if ($selfRef) { $selfRef.year }
                    elseif ($pageYearMatch.Success) { [int]$pageYearMatch.Groups[1].Value }
                    else { [int]$entry.timestamp.Substring(0, 4) }
        $sourceInfo = $sourceInfoBase.Clone()
        $sourceInfo.era = "day-heading"
        foreach ($hm in $dayLevelH2Matches) {
            # <h2>タグは "MM/DD(曜)" の順(月が先)
            $month = [int]$hm.Groups[1].Value
            $day = [int]$hm.Groups[2].Value
            $weekday = $hm.Groups[3].Value
            $titleFromHeading = $hm.Groups[4].Value.Trim()
            $blockHtml = $hm.Groups[5].Value
            foreach ($pInner in (Get-DayBlocks $blockHtml)) {
                $lines = ConvertTo-PlainLines $pInner
                if ($lines.Count -eq 0) { continue }
                # 日付・曜日・タイトルは<h2>側にあるため、既存のParse-DayBlockが読める
                # 「N日 (曜)タイトル」形式の先頭行を合成してから渡す(パースロジックを再利用するため)
                $syntheticHead = "${day}日 ($weekday)$titleFromHeading"
                $subLines = @($syntheticHead) + $lines
                $ev = Parse-DayBlock -lines $subLines -year $pageYear -month $month -sourceInfo $sourceInfo -errorLog $errorLog
                if ($ev) { $allEvents.Add($ev) }
            }
        }
    } else {
        # 月見出しなし: まず自己参照サイドバー(<a href="pgNNN.html">YYYY.MM</a>のうち
        # 自分自身へのリンク)で本当の年月を確定させる。見つからない場合のみ、
        # キャプチャのタイムスタンプから推測する(信頼度は低いため date_confidence で明示)。
        $selfRef = Get-SelfReferencedMonth $html $entry.original_url
        $sourceInfo = $sourceInfoBase.Clone()
        if ($selfRef) {
            $year = $selfRef.year
            $month = $selfRef.month
            $sourceInfo.era = "single-month-confirmed"
        } else {
            $ts = $entry.timestamp
            $year = [int]$ts.Substring(0, 4)
            $month = [int]$ts.Substring(4, 2)
            $sourceInfo.era = "single-month"
        }
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

# ---------- 重複排除(1): event_date ごとに field_count 最大 → タイムスタンプ最新 を採用 ----------
# 同じ日付に複数の候補がある場合は、最も新しくキャプチャされたものを優先する
# (「未定」だった時間・出演者が確定情報に更新されていくため、後から取得された
# スナップショットほど正確という前提。field_countは同時刻キャプチャが複数ある
# 場合のタイブレークとしてのみ使う)。ここを最初にやることで、後段の「使い回し
# コンテンツ」除去が、たまたま同じ日付に居合わせた別の本物のイベントを誤って
# 消してしまう事故を防ぐ(下記参照)。

$grouped = $allEvents | Group-Object event_date
$finalEvents = New-Object System.Collections.Generic.List[object]
foreach ($g in $grouped) {
    $best = $g.Group | Sort-Object -Property @{Expression = "source_snapshot_timestamp"; Descending = $true }, @{Expression = "field_count"; Descending = $true } | Select-Object -First 1
    $finalEvents.Add($best)
}

# ---------- 重複排除(2): 使い回しコンテンツによる誤日付を除去(全世代共通) ----------
# ページの更新が止まっているのに同じ内容のまま何度も再クロールされることがある。
# single-month世代(月見出しが無くキャプチャのタイムスタンプから月を推測)ではその
# たびに違う月と誤解釈され、accordion世代(明示的な月見出しあり)でも「今後6ヶ月分」の
# 表示に古い未更新の月がそのまま含まれ続けることで、同じ公演が複数の月に渡って
# 重複表示される(例:「ThreeOutレコ発『君の望む理想郷』」が2014年4月〜2015年6月の
# 毎月19日、計7件に化ける)。日付内の「日」と内容(曜日・タイトル・時間・料金・出演者)が
# 完全一致し、月/年だけが異なる候補が複数あれば同一公演の使い回し表示とみなし、
# 最も古いキャプチャによる推定日付のものだけを残す。
#
# 重複排除(1)の"後"にこれを行うのがポイント: 先にevent_dateごとの本物の勝者を決めて
# あるので、使い回し候補の中に「たまたま同じ日付に本当に別のイベントがあった」ケースが
# 混ざっていても、その日付の枠は既に本物のイベントに確定済みであり、使い回し候補は
# その日付では最初から負けている(=このグループに含まれない)。よって、たまたま
# 別イベントと同日になった使い回し候補を誤って"正式代表"に選んでしまうことがない。
function Get-ContentFingerprint($ev) {
    return (@($ev.weekday, $ev.title, $ev.open_time, $ev.start_time, $ev.price_adv, $ev.price_door, ($ev.performers -join '|')) -join '::')
}

$staleGroups = @{}
foreach ($ev in $finalEvents) {
    if (-not $ev.title) { continue }
    $dayOfMonth = $ev.event_date.Substring(8, 2)
    $key = "$dayOfMonth::" + (Get-ContentFingerprint $ev)
    if (-not $staleGroups.ContainsKey($key)) { $staleGroups[$key] = New-Object System.Collections.Generic.List[object] }
    $staleGroups[$key].Add($ev)
}
$dropSet = New-Object 'System.Collections.Generic.HashSet[object]'
$staleDropCount = 0
foreach ($key in $staleGroups.Keys) {
    $group = $staleGroups[$key]
    $distinctDates = @($group | Select-Object -ExpandProperty event_date -Unique)
    if ($distinctDates.Count -gt 1) {
        $sorted = $group | Sort-Object source_snapshot_timestamp
        $keepDate = $sorted[0].event_date
        foreach ($e in $group) {
            if ($e.event_date -ne $keepDate) {
                [void]$dropSet.Add($e)
                $staleDropCount++
            } else {
                # 生き残った代表も、複数月にまたがる使い回しから選んだ「最古のキャプチャに
                # よる推定」でしかないため、世代によらず月不明扱いにする
                $e.date_confidence = 'estimated'
            }
        }
    }
}
if ($staleDropCount -gt 0) {
    Write-Output "使い回しコンテンツによる誤日付を除去: $staleDropCount 件"
    $finalEvents = @($finalEvents | Where-Object { -not $dropSet.Contains($_) })
}

$finalEvents = $finalEvents | Sort-Object event_date

# ---------- 出演者名の正規化(大文字小文字・空白違いによる別名扱いを統合) ----------
# 例: "the adonis" と "THE ADONIS" が別バンド扱いになりランキングが分裂する問題を防ぐ。
# 表記ゆれのキー(trim・全角空白→半角・連続空白圧縮・小文字化)ごとに、最も出現回数の多い
# 表記を正式名として採用し、全イベントの出演者名をその表記に統一する。
function Get-NormalizedPerformerKey([string]$name) {
    $t = $name.Trim()
    $t = $t -replace '　', ' '
    $t = $t -replace '\s+', ' '
    return $t.ToLowerInvariant()
}

$variantCounts = @{}
foreach ($ev in $finalEvents) {
    foreach ($p in $ev.performers) {
        $key = Get-NormalizedPerformerKey $p
        if (-not $variantCounts.ContainsKey($key)) { $variantCounts[$key] = @{} }
        if (-not $variantCounts[$key].ContainsKey($p)) { $variantCounts[$key][$p] = 0 }
        $variantCounts[$key][$p]++
    }
}
$canonicalName = @{}
$mergedVariantCount = 0
foreach ($key in $variantCounts.Keys) {
    $variants = $variantCounts[$key]
    if ($variants.Keys.Count -gt 1) {
        $mergedVariantCount++
        $best = $variants.GetEnumerator() | Sort-Object -Property @{Expression = "Value"; Descending = $true }, @{Expression = "Name"; Descending = $false } | Select-Object -First 1
        $canonicalName[$key] = $best.Name
    } else {
        $canonicalName[$key] = ($variants.Keys | Select-Object -First 1)
    }
}
if ($mergedVariantCount -gt 0) {
    Write-Output "出演者名の表記ゆれを統合: $mergedVariantCount 件"
}
foreach ($ev in $finalEvents) {
    if ($ev.performers -and $ev.performers.Count -gt 0) {
        $ev.performers = @($ev.performers | ForEach-Object { $canonicalName[(Get-NormalizedPerformerKey $_)] } | Select-Object -Unique)
    }
}

# ---------- data/corrections.json の補正を適用 ----------
$renameByKey = @{}
foreach ($k in $renamePerformers.Keys) { $renameByKey[(Get-NormalizedPerformerKey $k)] = $renamePerformers[$k] }

$excludedCount = 0
foreach ($ev in $finalEvents) {
    if ($ev.performers -and $ev.performers.Count -gt 0) {
        $ev.performers = @($ev.performers | ForEach-Object {
            $p = $_
            $renameKey = Get-NormalizedPerformerKey $p
            if ($renameByKey.ContainsKey($renameKey)) { $p = $renameByKey[$renameKey] }
            $p
        } | Where-Object {
            if ($excludePerformers.Contains($_.Trim())) { $script:excludedCount++; $false } else { $true }
        } | Select-Object -Unique)
    }
}
if ($excludedCount -gt 0) {
    Write-Output "補正ファイルにより除外した出演者エントリ: $excludedCount 件"
}

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
