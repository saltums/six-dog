# SiX-DOG Archive

名古屋のライブハウス「SiX-DOG」(現在ドメイン失効)の公演スケジュールを [Wayback Machine](https://web.archive.org/) のアーカイブから復元し、DB化・公開Webアプリとしてまとめた個人アーカイブプロジェクトです。

要件定義はこちら: `docs/`(公開アプリ) / 実装計画は `Claude` セッション内の要件定義アーティファクトを参照。

## 構成

```
scripts/
  Fetch-Snapshots.ps1     CDX APIでスナップショット一覧を取得し、data/raw/ にHTMLをキャッシュ
  Parse-Events.ps1        data/raw/ のHTMLを解析し、data/events.json を生成(docs/data/にもコピー)
  Export-NotebookLM.ps1   data/events.json から NotebookLM 投入用Markdownを生成
data/
  raw/                    取得済みHTMLスナップショット(キャッシュ、再現性のため)
  raw-manifest.json       取得したスナップショットの一覧(URL・タイムスタンプ・保存先)
  events.json             正規化済みイベントデータ(唯一のソース)
  parse-errors.log        パースできなかった行のログ
docs/                     GitHub Pages 公開ルート(素のHTML/CSS/JS、ビルド不要)
  index.html / styles.css / app.js
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

同じ日付の公演情報が複数スナップショットに重複して現れる場合は、情報が最も充実しているレコードを優先して採用しています。

## 公開しているデータについて

日付・出演者名・料金・時間などのテキスト情報のみを公開しており、フライヤー画像やサイトデザインなど元サイトの著作物は複製していません。各公演には Wayback Machine 上の元ページへのリンクを付けています。

## GitHub Pages での公開手順

1. GitHubで新しいリポジトリを作成し、このディレクトリの内容をpush
2. リポジトリの Settings → Pages で、Source を `main` ブランチ / `/docs` フォルダに設定
3. 数分後 `https://<ユーザー名>.github.io/<リポジトリ名>/` で公開されます
