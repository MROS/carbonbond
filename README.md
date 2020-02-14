![Build Status](https://travis-ci.org/carbon-bond/carbonbond.svg?branch=master)

# 碳鍵
碳鍵是個次世代的論壇。它在文章之間的交互關係、筆戰過程中劍拔弩張的感受、板塊統治集團的鬥爭功能上進行了史無前例的大幅強化。

諸君，準備好了嗎？

> 提高你的鍵能，把那些笨蛋嘴成渣吧！

## 建置
- 設定檔
    + 預設使用 `config/carbonbond.[MODE].toml`，其中 `MODE` 為環境變數，可能的選項為 `release`、`dev` 及 `test`
    + 若前述檔案不存在，則使用 `config/carbonbond.toml`
    + 私密訊息，如 API KEY 等等，請放置於 `config/secret` 資料夾，並於設定檔中指定欲使用哪一個私密檔案 
    + 更詳盡的說明請參閱 `config/carbonbond.toml`
- 後端：使用 Rust 語言開發。
    + 參考 [官方網站](https://www.rust-lang.org/tools/install)
    + 使用 `cargo run` 可啟動伺服器
    + 使用 `cargo run -- --config-file FILE` 指定設定檔
    + 使用 `cargo run --bin db-tool` 可管理資料庫
- 前端：使用 typescript + React 開發。
    + `yarn` 安裝套件
    + `yarn watch` 編譯前端，並且監聽檔案改動
    + `yarn lint` 檢查風格


## 附錄：論當今論壇

當今可以拿出來說說的綜合性論壇，就只有批踢踢、巴哈、狄卡三者了。

- 批踢踢：架構老朽，入門不易，管理層又不智地長期關閉註冊功能，在可見的未來就會凋零至死。
- 巴哈：在遊戲、動漫以及個人創作上有它的獨到之處，但單憑場外休憩區，巴哈還談不上夠綜合。
- 狄卡：後起之秀，文章品質跟用戶素質不足，做爲一個論壇的功能也還很薄弱。但它一直在進步，是目前最能夠吃下批踢踢屍體的候選。

但最令人感到不安的也是狄卡的崛起。不謙虛地說，碳鍵的架構遠比狄卡來的優秀，然而當狄卡吸乾批踢踢屍體，魔功大成之時，就誰也無法阻擋了。

並不是一個東西設計得好，它就必然會成爲贏家，必須同時考慮時機與氣運，例如 line 在臺灣的成功，就是一個垃圾戰勝精品的例子，並且難以逆轉，從那時候開始，我們就必須一直忍受垃圾。