SKYBOUND GLOBAL｜松山飛行訓練 · 第一階段

離線啟動
解壓後雙擊 dist/index.html，用 Chrome 或 Edge 開啟。需要 WebGL，所有遊戲程式與高程都包含在檔案中。
本機伺服器可選用 python -m http.server 8765 --directory dist，再打開 http://localhost:8765。
靜態網頁不需要建置，dist 即為可執行版本。

操作
W/S 加減油門、上下方向鍵控制俯仰、左右方向鍵控制坡度（地面時用來轉向）。
Q/E 方向舵、Z/X 配平、F 襟翼、空白鍵煞車、C 切換視角、P 暫停、R 重飛。
起飛時加油門，空速約 51 節後短按上鍵。升空後可用配平微調。
依右上角 VFR 地圖飛訓練航線，先爬升至約 1,000 英尺。
進場前減速、逐段放襟翼，保持跑道中心線，接地後收油煞車。側風時依地面航跡修正。
所有航線和提示供遊戲使用。實際松山 AIP 禁止固定翼機場起落航線操作。

資料與授權
民航局 AIP AIRAC AMDT 03-25（2025-05-15），RCSS AD 2.12，使用跑道門檻、真方位、尺寸與標高等數值，未分發航圖。
https://ais.caa.gov.tw/eaip/AIRAC%20AIP%20AMDT%2003-25_2025_05_15/eAIP/RC-AD%202%20RCSS%20%E8%87%BA%E5%8C%97-%E6%9D%BE%E5%B1%B1TAIPEI-SONGSHAN-en-GB.html
RCSS RWY 10 真方位 092.22°，長 2605 m、寬 60 m，10/28 門檻標高 13/14 ft。
在場景中以 4.11 m 平整跑道及機場附近，從跑道區平滑過渡至高程網格。未重建跑道縱坡。
Terrain Tiles on AWS（2026-11-07），Mapzen / Tilezen，Skadi N24E121 與 N25E121。以 WGS84 取樣並內嵌 120 m 網格，範圍為松山跑道中心周邊 36 × 36 km。高程以來源的海拔值直接接合，未進行獨立的垂直基準轉換或測量。
https://registry.opendata.aws/terrain-tiles/
https://github.com/tilezen/joerd/blob/master/docs/attribution.md
Three.js r160.1 採 MIT 授權，完整授權見 THREE-LICENSE.txt。
SB-172 機模、地表材質、建物、跑道場面、地標輪廓與介面由程式生成。機場滑行道、停機坪與臺北 101 為示意模型。

實作範圍
單架 SB-172、RCSS RWY 10、雙視角、基本儀表、訓練航點、晴天與固定 10 節側風。
物理以 120 Hz 更新三軸速度與三軸姿態，含簡化升阻、側滑、失速、輪地接觸與煞車。地面模型採簡化單接觸高度。參數未用實機性能表校準。
座艙視角使用簡化框架和共用數位 HUD。互動座艙、進階機隊、分塊串流與松山至花蓮屬後續階段。


驗收紀錄
Chrome 1280×800，Intel Core i5-1145G7，無頭軟體 WebGL。
主選單、W 油門、C 視角、P 暫停、R 重飛、返回主選單通過。
用測試程式代打操縱輸入，完成無風及 10 節側風起落航線並煞停。從按下起飛起約 473/474 模擬秒；接地下降率約 122/127 ft/min。側風修正後接地偏離中心線約 0.35 m。
30、60、144 FPS 的固定輸入重播在 24 模擬秒的位置與空速一致。
關閉網路後以本機檔案開啟並進入跑道場景。軟體 WebGL 跑道待機取樣約 4 FPS，硬體加速幀率未實測。
Node 24 可執行 node verify-flight.cjs 重跑物理驗收。
若要重建高程，將來源的兩個 .hgt.gz 放入 terrain-input，再執行 python build-elevation.py。正常遊玩不需要下載原始高程。

