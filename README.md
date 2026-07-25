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

同じ日付の公演情報が複数スナップショットに重複して現れる場合は、**最も新しくキャプチャされたもの**を優先して採用しています(「未定」だった時間・出演者は後から確定情報に更新される前提)。出演者名は大文字小文字・空白の表記ゆれ(例: `the adonis` / `THE ADONIS`)を自動で1つの表記に統合しています。

サイトは2011年頃・2013〜2016年頃・2016〜2018年頃で構造が異なりますが、いずれも `Parse-Events.ps1` が自動判別して解析します(2019年以降はサイト自体の更新が止まっているため対象外)。

**月の特定方法について**: 月見出しの無いページ(2014〜2015年頃に多い、1ページ=1ヶ月分の形式)は、サイト自身が持つ「Schedule」/「Month」サイドバー(`<a href="pgNNN.html">YYYY.MM</a>` という月間ナビゲーションで、自分自身へのリンクも含む)から本当の年月を確定しています。これはキャプチャされた日時から推測するより信頼できます(例: `pg187.html` は2015年1月〜10月にかけて複数回キャプチャされていますが、サイドバー上は一貫して「2014.10」を指しており、これが正しい月です)。サイドバーが見つからないページのみ、キャプチャ日時からの推測にフォールバックし、`date_confidence: "estimated"` として明示しています。

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

## 公開サイトからの編集機能

カレンダー画面の公演詳細から「✎ この公演情報を編集」で、タイトル・時間・料金・出演者・備考をその場で修正できる。**ログイン・トークン不要、誰でもすぐに保存できる**(「荒らしはいない」という前提で運用する方針)。

- バックエンドは動画投稿と同じ Supabase プロジェクト。テーブル `event_overrides`(`event_date` がPK、他は編集可能なフィールド)に、Row Level Security で「閲覧・投稿・更新は誰でも可、削除は不可」を設定
- 保存は即座に反映される(GitHubのコミット・Pages再ビルド待ちは不要)
- `Parse-Events.ps1` を再実行しても `event_overrides` の内容には影響しない(自動マージはされないため、恒久的に取り込みたい修正は内容を確認して `data/corrections.json` や次回の `Import-Xlsx.ps1` 用スプレッドシートに反映すること)

## アーティスト名の統合(`docs/artists.html`)

「A」「A(アコースティック)」のような表記ゆれを、**公演ごとの表示は元の表記のまま残しつつ**、BIダッシュボードのランキングやカレンダー検索でだけ1つの名前にまとめて集計できる管理画面。ナビの「アーティスト管理」から開く。

- 一覧から複数の表記にチェックを入れ、統合先の名前を入力して「統合する」を押すとグループ化される(保存にはこのリポジトリへの**書き込み権限を持つGitHub Personal Access Token**が必要。ランキング集計に影響する操作のため、このサイトで唯一トークンが必要な機能として残している)
- グループの各メンバーは「✕ 解除」でいつでも統合を解除できる
- 統合先の名前(`docs/data/artist-aliases.json`、表記→統合先のフラットな対応表)は`data/corrections.json`の`renamePerformers`と違い、**元データの文字列自体は書き換えない**。公演詳細やNotebookLM出力には引き続き元の表記(例:「A(アコースティック)」)が表示される

## 動画URLの投稿(`docs/videos.js`)

カレンダー詳細モーダルの出演者チップをクリックすると、その公演でのその出演者に紐づく動画URL(YouTubeなど)を閲覧・投稿できるパネルが開く。ここだけは**ログイン・トークン不要で誰でもリアルタイムに投稿・編集できる**(他の編集機能とは仕組みが異なる)。

- バックエンドは [Supabase](https://supabase.com)(Postgres + PostgREST)。`docs/videos.js` の `CONFIG` に Project URL と **anon public key** を直接埋め込んでいる(anon keyはクライアント側に公開する前提の鍵)
- テーブル `videos`(列: `id`, `event_date`, `performer_name`, `video_url`, `video_title`, `submitted_by`, `submitted_at`, `notes`)に対して Row Level Security で「閲覧・投稿・更新は誰でも可、削除は不可」を設定している。ポリシーの変更はSupabaseダッシュボードのSQL Editorから行う
- 埋め込み再生はせず、投稿時にYouTubeのoEmbed APIから動画タイトルを取得して `video_title` に保存し、一覧ではそのタイトルをリンク文字列として表示する(件数が増えても埋め込みプレイヤーで重くならないための判断)。タイトルが取得できない場合やYouTube以外のURLはURLそのものをリンク文字列として表示する
- 認証が無いため、悪意ある投稿・書き換えのリスクは受け入れた上での運用(個人のファン向けアーカイブとしての判断)。投稿の削除が必要な場合はSupabaseダッシュボードのTable Editorから直接行う(anon keyには削除権限が無いため、サイト上からは削除できない)

## 公開しているデータについて

日付・出演者名・料金・時間などのテキスト情報のみを公開しており、フライヤー画像やサイトデザインなど元サイトの著作物は複製していません。各公演には Wayback Machine 上の元ページへのリンクを付けています。

## GitHub Pages での公開手順

1. GitHubで新しいリポジトリを作成し、このディレクトリの内容をpush
2. リポジトリの Settings → Pages で、Source を `main` ブランチ / `/docs` フォルダに設定
3. 数分後 `https://<ユーザー名>.github.io/<リポジトリ名>/` で公開されます
