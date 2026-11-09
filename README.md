# SKYBOUND GLOBAL

目前同步版本為 0.12。共有 11 架可選機型，六架 SB 系列已移出機庫。既有訓練與區域任務改用 A220。手機版提供觸控提示、逐步地勤、跳過拖車、快速操控與引擎聲浪。自動導航可進場、接地並在跑道煞停。全機隊可從「試飛所選飛機」進入 1,000 kt TAS 高速遊戲模式，也可選寫實巡航。載客航班降落並煞停後，可讓拖車拖到機位或直接跳至機位，再接空橋下客。引擎可在非零油門時啟動。「極致」畫質有高解析、陰影和完整城市地景；多雲時可飛到雲上，夜間有月亮、星星和城市窗燈。

- [正式遊玩網址](https://s87ngsr5f5-dotcom.github.io/skybound-global/)
- [iPhone 手機相容版](https://s87ngsr5f5-dotcom.github.io/skybound-global/iphone.html)
- [ChatGPT Sites 既有遊玩入口](https://skybound-global.alondragallard.chatgpt.site/)
- [共編與發布流程](CONTRIBUTING.md)
- [給 Gemini 的交接提示詞](PASTE-INTO-GEMINI.txt)
- [飛機建模基準](AIRCRAFT-QUALITY.md)

本機預覽使用 `python -m http.server 8765 --directory dist`，再開啟 `http://127.0.0.1:8765/` 或 `http://127.0.0.1:8765/iphone.html`。不需要 npm 建置。

共同開發請從 `main` 開分支、提交 Pull Request。GitHub Actions 會測試飛行功能，合併到 `main` 後更新原本的 GitHub Pages 正式網址。ChatGPT Sites 為另一個發布入口，兩個網域的瀏覽器存檔各自獨立。

機模和地景來源見 [模型授權](dist/models/SOURCES.txt)、[地景來源](dist/VISUALS.txt)及 [Three.js 授權](dist/THREE-LICENSE.txt)。飛行物理及機型細節為遊戲近似，地景重點在臺灣區域與成田周邊。

以下為早期版本紀錄，操作說明以目前版本畫面為準。
## ASTRA 航班經營 0.5

選「立即接載客任務」預填 A320neo 桃園至高雄。確認油量後按「開始飛行」。在機位按加油、連接空橋、客艙門。登機與加油完成後，關門、收橋、推離，再開電瓶與引擎。抵達停機位、停機煞車拉起後，關引擎、接橋、開門。下機完畢後關門、收橋結算。進度與金幣只存於目前網站的瀏覽器儲存區。

方向鍵可持續輸入，操控設定可選放開後維持坡度，V 回正。選「777 巡航驗證」可在 35,000 呎分別測試無風、順風與逆風。導航顯示 TAS、GS、Mach 與目前航點的估計抵達時間。

新增可飛機型為 A220-300、767-300F、F-5E。A220 可執飛離島載客。767F 在機型任務使用側門和貨盤。F-5E 可使用岸基訓練。機型外觀、程序與飛行物理為遊戲近似。現有地景重點仍在臺灣與成田。金門地形採 SRTM N24E118，跑道資料採臺北飛航情報區 AIP，滑行道、機坪及地勤使用程序模型。

性能與尺寸參考
- [Boeing 777 設計資料](https://www.boeing.com/commercial/777/design-highlights)
- [Airbus A220-300](https://www.aircraft.airbus.com/en/aircraft/a220/a220-300)
- [Boeing 767 機場規劃資料](https://www.boeing.com/content/dam/boeing/boeingdotcom/commercial/airports/acaps/767_REV_K.pdf)
- [F-5E 參考資料](https://www.aerospaceutah.org/museum/our-collections/aircraft-collection/f-5e-tiger-ii/)
- [金門機場 AIP](https://ais.caa.gov.tw/eaip/AIRAC%20AIP%20AMDT%2005-26_2026_10_29/eAIP/RC-AD%202%20RCBS%20%E9%87%91%E9%96%80KINMEN-en-GB.html)


## 跑道起飛與巡航

自由飛行選 777-300ER 或其他有巡航設定的客貨機，從跑道待命開始。W 增加推力。離地至少約 500 呎並加速到抬輪速度以上 15 節後，收起落架、襟翼及擾流板，按「爬升／巡航 35,000 ft」。此模式沿接通時的航向加速並爬升，接近目標高度時轉入定高與 Mach 保持，不會追蹤航線或避讓地形。手動俯仰、轉向、方向舵或油門可解除。主畫面同時顯示 IAS、GS、TAS 和 Mach。

`node verify-cruise.cjs` 會先核對 777 的無風、順風與逆風巡航，再從桃園跑道靜止狀態測試六架具巡航設定的客貨機，確認滑跑距離、離地、爬升和速度。標準重量的 777 無風約 14 分鐘抵達 34,836 呎，測得 Mach 0.842、地速 486 節。載重、風和高度會影響結果。


在「訓練」選「777 起飛至巡航 · 桃園 05L」，可選無風或 60 節順逆風。風從爬升途中逐步加入，跑道起步條件相同。維持 35,000 呎與 Mach 0.84 附近 60 秒後，飛行紀錄會保存時間、地速和耗油，按 R 可重飛。課程使用正常時間倍率。


## 區域任務與機隊更新

在「訓練」選「臺北觀光 · 松山返場」或「飛機調度 · 松山至花蓮」。使用 SB-172 從冷艙出發，依序通過航點、落地並滑回指定停機位，完成後從報酬扣除燃油費再入帳。觀光任務模擬兩名旅客的重量，沒有小型機登機動畫。戰鬥機岸基訓練和區域貨運也有報酬。成田貨運只在從裝載節點起飛並完成卸貨時入帳，從後續節點開始可練習。新任務會保存結算，並支援未完成任務續飛。

新增 737 MAX 8 分叉翼尖、單軸主起落架與 178 座客艙，及 767-300ER 四輪主起落架轉向架和 217 座 2-3-2 客艙。模型為原創程序化近似。兩架都通過桃園至高雄基準任務及跑道至巡航測試。尺寸參照 [波音 737 MAX 機場規劃資料](https://www.boeing.com/content/dam/boeing/v2/airports/acaps/737MAX_RevK.pdf) 和 [波音 767 機場規劃資料](https://www.boeing.com/content/dam/boeing/v2/airports/acaps/767_REV_K.pdf)。


## 任務中途存檔

觀光、調度、岸基戰鬥訓練、區域貨運、成田貨運及 777 起飛至巡航可保存多個本機任務存檔。飛行中每 15 秒自動保存，回到主選單或關閉頁面也會嘗試保存。按「繼續任務」恢復後先暫停，按 P 開始。成田貨運會還原貨盤、貨門、天氣、時間倍率及已錄下的回放片段。現有定期載客存檔保存在原本的欄位。可直接開始新任務，並在主選單選擇要繼續的存檔。進度保存在同一網址的同一瀏覽器，清除網站資料會移除存檔。


## 自有客機維修

機庫工坊可買入 737 MAX 8、767-300ER、777-300ER 與 SA-380。執飛定期載客後，自有客機按飛行時間和接地情況累積磨耗。機況低於 60% 時，需要先維修才能接下一趟定期航班。工坊會顯示費用，維修後恢復至 100%。有未完成航班時須先完成或結束該航班。租機的地面處置仍按航班結算，自有客機則在工坊支付修復費。


## 臺灣森林

臺灣本島以 ESA WorldCover 2021 v200 的樹木覆蓋分類（class 10）決定林地分布。來源為 N24E120、N21E120 兩個圖磚，將原始 10 公尺分類彙整為約 125–140 公尺的覆蓋比例。林地邊界來自衛星資料，樹種、單株位置和大小由遊戲生成。資料範圍外使用地形推估。重新生成資料可使用 `tools/build-forest-cover.py`，輸入官方 GeoTIFF 所在資料夾和輸出路徑。

© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium. Adapted by SKYBOUND GLOBAL. [ESA WorldCover 2021 v200](https://doi.org/10.5281/zenodo.7254221), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).


## 客機模型精修

雙發客機採用貼合機身的駕駛艙玻璃、圓角舷窗、艙門接縫、分層引擎短艙及起落架支柱。777-300ER 加入後掠翼尖、六輪主起落架和帶飛行數據的雙發座艙。原創遊戲模型參考 [波音 777 設計特點](https://www.boeing.com/commercial/777/design-highlights) 和 [777 機場規劃資料](https://www.boeing.com/resources/boeingdotcom/commercial/airports/acaps/777-200LR-300ER-F_Rev_G.pdf)。


飛行中按 C 進入駕駛艙，按 N 切換左座、右座和儀表近看。單座機和教練機提供正前方與儀表近看。在場景上按住滑鼠右鍵拖曳環視，滾輪調整視野，按 Home 回到預設方向與倍率。鏡頭會隨飛機姿態轉動，環視不會改變飛行操控。


## 機場、道路及城市地景

選「出發機場航廈與空橋」或「出發機場跑道標誌」，可巡覽所選機場。九座可用機場加入加大的模擬機坪、航廈與登機門、空橋、跑道號碼、接地線和滑行等待標誌。客運靠位後可接通空橋；場景使用目前支援的主跑道，航廈、其他機場設施及空橋配置為遊戲建模。

臺灣國道與選定省道快速公路採用 [內政部國土測繪中心國省道路中線](https://data.gov.tw/dataset/73232) 115 年 4 月 9 日資料，依政府資料開放授權條款第 1 版使用。道路寬度和橋面高度為視覺近似，隧道內不顯示路面。臺灣機場周圍及數個主要城市的代表性建物以 [Geofabrik 臺灣 OpenStreetMap 摘錄](https://download.geofabrik.de/asia/taiwan.html) 產生。新資料依建物足跡取近似量體，部分高度為估算。建物資料 © OpenStreetMap contributors，依 [ODbL](https://www.openstreetmap.org/copyright) 使用及發布。資料處理腳本在 `tools/`。
