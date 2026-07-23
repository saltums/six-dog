# SiX-DOG Archive

名古屋のライブハウス「SiX-DOG」(現在ドメイン失効)の公演スケジュールを [Wayback Machine](https://web.archive.org/) のアーカイブから復元し、DB化・公開Webアプリとしてまとめた個人アーカイブプロジェクトです。

要件定義はこちら: `docs/`(公開アプリ) / 実装計画は `Claude` セッション内の要件定義アーティファクトを参照。

## 構成

```
scripts/
  Fetch-Snapshots.ps1     CDX APIでスナップショット一覧を取得し、data/raw/ にHTMLをキャッシュ
  Parse-Events.ps1        data/raw/ のHTMLを解析し、data/events.json を生成(docs/data/にもコピー)
  Export-NotebookLM.ps1   data/events.json から NotebookLM 投入用Markdownを生成
  Export-Xlsx.ps1         data/events.json を data/six-dog-data.xlsx (Events/Performers/Videosの3シート)に書き出す
  Import-Xlsx.ps1         レビュー・修正したdata/six-dog-data.xlsxをdata/events.jsonに取り込み直す
data/
  raw/                    取得済みHTMLスナップショット(キャッシュ、再現性のため)
  raw-manifest.json       取得したスナップショットの一覧(URL・タイムスタンプ・保存先)
  events.json             正規化済みイベントデータ(唯一のソース)
  parse-errors.log        パースできなかった行のログ
  corrections.json        パーサーを直さずに後から手動で直すための補正リスト(下記参照)
  six-dog-data.xlsx        目視レビュー用スプレッドシート(下記参照)
docs/                     GitHub Pages 公開ルート(素のHTML/CSS/JS、ビルド不要)
  index.html / styles.css / app.js   カレンダー・検索画面
  bi.html / bi.js                    出演者BIダッシュボード
  data/events.json
notebooklm/
  six-dog-schedule.md     NotebookLM にアップロードする用のMarkdown
```

## 実行方法(PowerShell、Node/Python不要)

```powershell
# 1. Wayback Machineからスナップショットを取得(初回は数分かかります)
.\scripts\Fetch-Snapshots.ps1

# 2. スケジュール情報を解析してdata/events.jsonを生成
.\scripts\Parse-Events.ps1

# 3. NotebookLM用のMarkdownを生成
.\scripts\Export-NotebookLM.ps1
```

`Fetch-Snapshots.ps1` は取得済みのHTMLを `data/raw/` にキャッシュするため、2回目以降の実行は未取得分のみダウンロードします。

## データの復元方法について

サイトは運営期間中にURL構造が複数回変わっており(スケジュールページが月ごとに別URLになる時期もある)、固定URLを追いかける方式では全期間をカバーできません。そのため `Fetch-Snapshots.ps1` はドメイン全体のユニークコンテンツHTMLを網羅的に取得し、`Parse-Events.ps1` 側で `OPEN/START` / `adv/door` という共通パターンを持つページだけをスケジュールページとして判定・解析します。

同じ日付の公演情報が複数スナップショットに重複して現れる場合は、情報が最も充実しているレコードを優先して採用しています。出演者名は大文字小文字・空白の表記ゆれ(例: `the adonis` / `THE ADONIS`)を自動で1つの表記に統合しています。

サイトは2011年頃・2013〜2016年頃・2016〜2018年頃で構造が異なりますが、いずれも `Parse-Events.ps1` が自動判別して解析します(2019年以降はサイト自体の更新が止まっているため対象外)。

## データの手動補正について(`data/corrections.json`)

自動解析だけでは直せない誤りは、パーサーのコードを書き換えずに `data/corrections.json` を編集して直せます。編集後は `.\scripts\Parse-Events.ps1` を再実行すれば反映されます(再取得は不要)。

```json
{
  "excludePerformers": ["etc", "ノイズとして混入する名前"],
  "renamePerformers": { "元の表記": "統一したい正式表記" }
}
```

- `excludePerformers` — 出演者リストから除外したい文字列(大文字小文字は区別しません)
- `renamePerformers` — 自動統合(表記ゆれ)では拾いきれない別名を、指定した表記に統一します

## スプレッドシートでのレビュー(`data/six-dog-data.xlsx`)

自動統合しきれない重複や誤りを目視で確認・修正したい場合は、スプレッドシート形式でレビューできる。

```powershell
# 1. 現在のdata/events.jsonをスプレッドシートに書き出す
.\scripts\Export-Xlsx.ps1

# 2. data/six-dog-data.xlsx を Google Drive にアップロードして
#    スプレッドシートとして開き、重複行の削除や出演者名の修正を行う
#    (Events: event_idがPK / Performers: event_idがFKの縦持ち形式)

# 3. 修正版をdata/six-dog-data.xlsxに上書き保存してから取り込み直す
.\scripts\Import-Xlsx.ps1
.\scripts\Export-NotebookLM.ps1   # NotebookLM用Markdownも更新する場合
```

`Videos` シートは今後、公演に動画URLを紐づけて複数人で投稿していくための予備領域(`video_id` PK, `event_id` FK, `video_url`, `submitted_by`, `submitted_at`, `notes`)。現時点ではまだWebアプリ側の投稿UIとは連携していない。

**注意**: `Import-Xlsx.ps1` は `data/events.json` をスプレッドシートの内容で丸ごと置き換える。後で `Fetch-Snapshots.ps1` / `Parse-Events.ps1` を再実行すると、この手動修正は自動抽出結果で上書きされる(恒久的に残したい修正は `data/corrections.json` にも書き写すこと)。

## 公開しているデータについて

日付・出演者名・料金・時間などのテキスト情報のみを公開しており、フライヤー画像やサイトデザインなど元サイトの著作物は複製していません。各公演には Wayback Machine 上の元ページへのリンクを付けています。

## GitHub Pages での公開手順

1. GitHubで新しいリポジトリを作成し、このディレクトリの内容をpush
2. リポジトリの Settings → Pages で、Source を `main` ブランチ / `/docs` フォルダに設定
3. 数分後 `https://<ユーザー名>.github.io/<リポジトリ名>/` で公開されます
