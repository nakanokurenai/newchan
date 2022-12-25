newchan
===

Slack の新着チャンネルを通知します。

ある時刻以降に作られたチャンネルをまとめて投稿します。

[GitLab Scheduled Pipeline](https://docs.gitlab.com/ee/ci/pipelines/schedules.html) を用いて GitLab CI で定期的に動作します。

使ってみよう
---
1. Slack App の用意
    + [manifest](./app.yaml) を用いて app を作る
        * ただし手動で設定画面からいじって手動更新しているマニフェストファイルなので、更新が追いついていないかもしれない
    + bot のトークンを取得する
1. 環境変数の設定
    + `NEWCHAN_STATE_FILE` - 状態ファイル (後述) のパス。空では動作しない
    + `SLACK_BOT_TOKEN` - 上で得た Slack bot トークン
    + `SLACK_CHANNEL_NAME` - 投稿先の Slack channel (名前)
        * あくまでチャンネル名で、ID ではない
1. 依存関係をインストールしたのち `npm start` で実行

状態ファイルについて
---
- 新着チャンネルを通知するためには、どのチャンネルが新着かわからなければいけない
- プレーンテキストでUNIXエポックを書き込む状態ファイルを用意することで対応している
- 初期データとしては `date +%s` を与えるのがオススメ

GitLab CI について
---
- 状態ファイルを GitLab にコミットするために、SSH鍵を提供する必要がある
    + ホストキーを固定で [.gitlab-ci.yml](./.gitlab-ci.yml) に指定しているので、必要なら適宜アップデートする
    + デプロイキーとして追加し、環境変数に指定する
- GitLab CI で設定しなければならない環境変数
    + `SLACK_BOT_TOKEN` - [manifest](./app.yaml) で設定された bot のトークン
    + `SSH_KEY_BASE64` - SSH鍵をb64にしたもの
- スケジュール設定は UI から行う必要がある
