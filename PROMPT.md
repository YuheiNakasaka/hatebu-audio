# 設計フェーズ
## 初期プロンプト
私がはてなブックマークした記事やPDFの内容を取得して内容を少し長めに要約してまとめて、それらをPodcastのような会話形式で音声ファイル化する仕組みを作りたいです。用途は自分が通勤中などに聴くためです。サーバーを用意したりせず自分のローカルPCで実行できるだけでも良いです。データベースが必要であればSQLiteを使ってください。技術スタックとしてはTypeScriptが良いです。

私のはてなブックマーク一覧が取得できるURLは以下です。
- HTTP URL: https://b.hatena.ne.jp/razokulover/bookmark
- RSS URL: https://b.hatena.ne.jp/razokulover/bookmark.rss

まずはどのようなアーキテクチャでシステムを開発すべきか詳細に考えてDESIGN.mdを作成してください。

## AIからの質問
1. 要約と会話形式への変換には、OpenAI APIの利用を想定していますが、これは問題ないでしょうか？（APIキーとコスト発生が必要）
2. 音声合成にはどのようなサービスを使いたいですか？
  OpenAI TTS API
  Google Cloud Text-to-Speech
  Amazon Polly
  ローカルで動作する音声合成ライブラリ
3. 会話形式のPodcastでは、何人の話者を想定していますか？（例：2人のキャラクターによる対話）
4. 生成された音声ファイルはどのような形式で保存したいですか？（MP3, WAV, AAC等）
5. 一度に処理するブックマーク数の上限や、どの期間のブックマークを対象にするかなどの条件はありますか？

## AIへの回答
1. 問題ないです。ClaudeのAPIやGoogleのAPIを使っても良いです。
2. 精度は高い方が良いですが価格は安い方が良いです
3. 1人のキャラクターによる記事紹介と解説と一言コメントみたいな感じが良いです
4. MP3で保存してください
5. まずは10件くらいを想定しています
