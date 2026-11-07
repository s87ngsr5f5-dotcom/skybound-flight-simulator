# SKYBOUND GLOBAL

瀏覽器飛行模擬器原型。開啟 GitHub Pages 網址，或執行 `python -m http.server 8765 --directory dist` 後開啟 http://localhost:8765 。

包含九架可選機型、臺灣區域地景與任務。40 架機隊及完整全球寫實場景仍在規劃中。來源與授權見 dist/VISUALS.txt、dist/README.txt、dist/THREE-LICENSE.txt。

本輪修正河道與道路穿地、分區顯示、畫質選項、機身曲面、立體翼型、引擎與輪轂。保留正常左右控制。

軟體 WebGL 效能仍偏低；尚未完成硬體 GPU 效能驗收。
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
