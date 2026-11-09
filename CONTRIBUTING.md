# SKYBOUND GLOBAL 共編指南

正式版以 [GitHub 儲存庫](https://github.com/s87ngsr5f5-dotcom/skybound-global) 的 `main` 為準。發布後沿用 [GitHub Pages 遊玩網址](https://s87ngsr5f5-dotcom.github.io/skybound-global/)，[手機入口](https://s87ngsr5f5-dotcom.github.io/skybound-global/iphone.html) 也維持相同網址。

## 邀請其他人

由儲存庫擁有者進入 [Collaborators 設定](https://github.com/s87ngsr5f5-dotcom/skybound-global/settings/access)，按 **Add people** 並輸入對方的 GitHub 帳號。對方接受邀請後即可一起改。只想提交建議的貢獻者也可以 fork 公開儲存庫後開 Pull Request。遊玩連結可以直接分享。

## 修改與上線

1. 從最新的 `main` 開一條分支。在專案根目錄執行 `python -m http.server 8765 --directory dist` 預覽。電腦入口為 `http://127.0.0.1:8765/`，手機入口為 `http://127.0.0.1:8765/iphone.html`。
2. 對 `main` 提交 Pull Request。GitHub Actions 會檢查 777 速度、非零油門啟動、自動導航推力與自動降落。
3. 檢查兩個入口及受影響的飛行流程後合併。合併到 `main` 後會再跑測試，通過就更新 GitHub Pages。可在 [Actions](https://github.com/s87ngsr5f5-dotcom/skybound-global/actions/workflows/pages.yml) 查發布結果。

桌面和手機共用的 JavaScript 或 CSS 若有修改，請同步調整 `dist/index.html` 和 `dist/iphone.html` 的對應載入版本。保留既有網址和瀏覽器存檔欄位。ChatGPT Sites 的既有遊玩入口另外發布，與 GitHub Pages 的進度及金幣各自儲存在原瀏覽器。

## 交給 Gemini

在電腦版 Gemini 選「匯入程式碼」並匯入 [GitHub main 分支](https://github.com/s87ngsr5f5-dotcom/skybound-global/tree/main)，再貼入 [交接提示詞](PASTE-INTO-GEMINI.txt) 與需求。請 Gemini 提供差異檔或修改檔，再由有 GitHub 權限的人套用到分支並開 Pull Request。匯入是快照，後續更新要重新匯入。
