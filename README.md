# LINE Chore Bot

毎日の家事分担メッセージを LINE グループへ送る簡易 Bot です。

## 前提

- Node.js 18 以上
- `line-channel-access-token.txt` に `LINE_CHANNEL_ACCESS_TOKEN` を保存済み
- `LINE_GROUP_ID` は `chore-bot.mjs` に設定済み

## 設定

[chore-config.mjs](/Users/kousuketaniguchi/work/homework/chore-config.mjs) の `members` を実際の名前に変更してください。

## 実行

プレビュー

```bash
npm run preview
```

送信

```bash
npm run send
```

テスト

```bash
npm test
```

## ごみ収集ルール

相模原市南区上鶴間本町の収集曜日を前提にしています。

- 一般ごみ: 水曜・土曜
- 資源: 火曜
- 容器包装プラ: 金曜
- 乾電池: 土曜
