'use strict';
// v0.63 Clean Itemized Title Screen & 7-Chapter Aviation Story Campaign System
(function (globalScope) {
  const PROGRESS_KEY = 'skybound.campaignProgress.v1';

  const CHAPTERS = [
    {
      id: 1,
      code: 'EP.01',
      title: '晨曦首航：淡水河巡禮',
      subtitle: '松山起飛 · 低空認識台北盆地',
      image: 'assets/campaign/ch1.jpg',
      aircraft: 'c172s',
      departure: 'RCSS',
      destination: 'RCTP',
      lesson: 'free',
      startType: 'runway',
      weather: '0',
      time: '06:20',
      objectiveDistM: 3200,
      targetText: '從松山機場起飛並爬升至 1,200 呎，沿淡水河方向低空巡航 3 km',
      story: '清晨六點二十分，晨曦染金了大屯山與淡水河。你剛通過民航機師檢定，將與周教官駕駛 Cessna 172S 從松山 10 跑道首飛，親自鳥瞰 3D 台北都會區天際線。',
      radio: [
        { delay: 1.5, speaker: '周教官 · RCSS教席', text: '「晨風，歡迎來到真正的天空！油門推滿，達 55 節輕輕拉桿離地。」' },
        { delay: 9.0, speaker: '台北近場台 · Taipei Approach', text: '「Skybound-01，松山離場核准，請保持 1,200 呎沿基隆河向西巡航，留意信義高樓障礙。」' },
        { delay: 19.0, speaker: '副駕駛 · 周教官', text: '「看左側信義區 101 玻璃帷幕在晨光中反光了！穩住操縱桿，享受飛翔的節奏。」' }
      ],
      winCondition: (f, st) => !f.ended && f.airborne && st.flownM >= 2800 && f.y >= 160
    },
    {
      id: 2,
      code: 'EP.02',
      title: '信義天際：低空都會穿梭',
      subtitle: 'A220-300 交機調度 · 閃避摩天樓防撞驗證',
      image: 'assets/campaign/ch2.jpg',
      aircraft: 'a223',
      departure: 'RCSS',
      destination: 'RCTP',
      lesson: 'free',
      startType: 'runway',
      weather: 'clouds',
      time: '16:35',
      objectiveDistM: 5000,
      targetText: '駕駛 A220-300 起飛掠過台北盆地上空雲隙，安全爬升飛往桃園（切勿撞擊高樓！）',
      story: '全新塗裝的 A220-300 完成松山靜態檢驗，急須調度飛往桃園國際機場投入春運。金色斜陽下雲層低垂，市區摩天樓林立，切記維持安全離地高！',
      radio: [
        { delay: 1.5, speaker: '松山塔台 · Songshan Tower', text: '「Horizon-220，10 號跑道風向 090 陣風 8 節，允許起飛，離地後右轉避開 101 空域。」' },
        { delay: 10.5, speaker: '機長座艙警告 · GPWS', text: '「高度偏低區域請留意都市高樓！碰撞高樓或建築將立刻發生爆燃毀損。」' },
        { delay: 20.0, speaker: '桃機進場管制 · RCTP APP', text: '「Horizon-220 雷達識別完成，爬升至 3,000 呎切入 05L 航道準備進場。」' }
      ],
      winCondition: (f, st) => !f.ended && st.flownM >= 4500 && f.y >= 320
    },
    {
      id: 3,
      code: 'EP.03',
      title: '風暴迫降：凱米颱風微下衝切',
      subtitle: '暴雨強風切 · 儀表盲降挑戰',
      image: 'assets/campaign/ch3.jpg',
      aircraft: 'b38m',
      departure: 'RCTP',
      destination: 'RCKH',
      lesson: 'free',
      startType: 'runway',
      weather: 'storm',
      time: '17:45',
      objectiveDistM: 6000,
      targetText: '於雷暴風雨中操縱 737 MAX 起飛穿透雨牆，或完整執飛降落高雄小港',
      story: '強烈颱風逼近南台灣，雷雨雲籠罩桃園與海峽西岸。艙內坐著 162 名返鄉旅客，你必須頂著閃電與劇烈氣流安全穿雲爬升、直奔南疆！',
      radio: [
        { delay: 1.5, speaker: '氣象雷達警報 · WEATHER', text: '「前方跑道延伸線偵測強烈微下衝氣流！起飛後注意空速驟降與仰角保持。」' },
        { delay: 11.0, speaker: '客艙廣播 · PURSER', text: '「各位旅客您好，受颱風環流影響氣流不穩，機組員已嚴格掌控航向，請繫妥安全帶。」' },
        { delay: 22.0, speaker: '戰情指揮室 · OPS', text: '「太穩了機長！雨勢在 4,000 呎上方逐漸平緩，繼續維持巡航速度南下。」' }
      ],
      winCondition: (f, st) => !f.ended && ((f.finished && f.landed) || (st.flownM >= 5500 && f.y >= 480))
    },
    {
      id: 4,
      code: 'EP.04',
      title: '太平洋黎明：航艦彈射升空',
      subtitle: '海上航艦艦載機實彈戰備',
      image: 'assets/campaign/ch4.jpg',
      aircraft: 'sf16',
      departure: 'RCYU',
      destination: 'RCKH',
      quickPreset: 'carrierCatapult',
      startType: 'runway',
      weather: 'clouds',
      time: '13:15',
      objectiveDistM: 5500,
      targetText: '完成蒸汽彈射升空（或跑道後燃器起飛），爬升至太平洋上空戰巡點',
      story: '東部外海海域偵測不明無人偵察機訊號。航空母艦甲板蒸汽滾滾，後燃器轟鳴聲劃破海風——彈射鎖解除，台灣防空尖兵即刻升空！',
      radio: [
        { delay: 1.0, speaker: '航艦甲板長 · AIR BOSS', text: '「Viper-1 進入 1 號彈射槽！油門推至 100% 滿推力後燃器，準備彈射！」' },
        { delay: 8.5, speaker: '作戰管制官 · E-2K HAWKEYE', text: '「Viper-1 順利離艦，立即收起落架並大坡度左轉爬升切入攔截航線。」' },
        { delay: 19.0, speaker: '僚機 · VIPER-2', text: '「已目視花東海岸與太平洋波浪！機翼過載拉到 3G，拉出美麗的翼尖凝結霧！」' }
      ],
      winCondition: (f, st) => !f.ended && !f.ground && st.flownM >= 4500 && f.y >= 350
    },
    {
      id: 5,
      code: 'EP.05',
      title: '雲上生死線：高空空中加油',
      subtitle: 'KC-135 精密编隊對接補給',
      image: 'assets/campaign/ch5.jpg',
      aircraft: 'sf16',
      departure: 'RCYU',
      destination: 'RCKH',
      quickPreset: 'refueling',
      startType: 'air',
      weather: 'clouds',
      time: '16:10',
      objectiveDistM: 6000,
      targetText: '追蹤前方 TEXACO-21 加油機完成對接，或於高空雲海保持編隊距離',
      story: '經過一小時驅離巡邏，戰機內油已跌破安全餘裕。KC-135 加油機在萬呎金黃雲海上展開伸縮加油管，你必須將機速與姿態控至毫釐之間！',
      radio: [
        { delay: 1.2, speaker: '加油官 · TEXACO-21', text: '「Viper-1，我是 Texaco-21，你目前位於我後方，依機腹 PDI 燈號緩慢前推逼近！」' },
        { delay: 10.5, speaker: '系統語音 · FUEL ALERT', text: '「微小油門調控最關鍵：善用空氣減速板微調閉合率，避免過度俯衝！」' },
        { delay: 20.0, speaker: '加油官 · TEXACO-21', text: '「穩定保持高度與位置——優秀的編隊控制，燃油輸送正常運作中！」' }
      ],
      winCondition: (f, st) => !f.ended && st.elapsedS >= 32 && (f.fuel > 3200 || st.flownM >= 5500)
    },
    {
      id: 6,
      code: 'EP.06',
      title: '蒼穹守望：中央山脈領空捍衛',
      subtitle: '雷達鎖定 · 實彈空對空攔截',
      image: 'assets/campaign/ch6.jpg',
      aircraft: 'm2000',
      departure: 'RCMQ',
      destination: 'RCYU',
      lesson: 'tactical',
      tacticalScenario: 'intercept',
      startType: 'runway',
      weather: 'clouds',
      time: '17:10',
      objectiveDistM: 7000,
      targetText: '啟動戰術雷達鎖定來襲目標並發射飛彈擊落，保衛台灣高空空域',
      story: '多名高空不明飛行器越過識別區飛向中央山脈。空防響起最高警戒，駕駛幻象 2000 以超音速直衝蒼穹，終結一切威脅！',
      radio: [
        { delay: 1.5, speaker: '空軍戰管 · CAP CTRL', text: '「緊急起飛！啟動右側戰術雷達，鎖定入侵高空編隊並開啟武器授權！」' },
        { delay: 10.0, speaker: '座艙電戰系統 · RWR', text: '「Radar Contact！按下空白鍵與飛彈鈕追蹤目標熱訊號，注意高 G 閃避迴旋。」' },
        { delay: 21.0, speaker: '總指揮部 · HQ', text: '「蒼穹守望者，全台空域防線全靠你們守住！目標清除後即可返場着陸。」' }
      ],
      winCondition: (f, st) => !f.ended && (f.finished || (st.elapsedS >= 38 && st.flownM >= 6000))
    },
    {
      id: 7,
      code: 'EP.07',
      title: '終章夜航：晶圓專機直達東京',
      subtitle: '747-8F 深夜繁星高空貨運史詩',
      image: 'assets/campaign/ch7.jpg',
      aircraft: 'sf748',
      departure: 'RCTP',
      destination: 'RCKH',
      lesson: 'free',
      startType: 'runway',
      weather: 'wet',
      time: '22:30',
      objectiveDistM: 7500,
      targetText: '夜雨啟航 747-8F 貨機穿越繁華新北台北夜景，爬升切入高空航道',
      story: '這是這趟傳奇戰役的最終章。深夜十點半桃園滂沱夜雨，四具巨型渦扇引擎點亮濕漉漉的跑道標誌與萬家燈火——載滿寶島科技的希望，飛向繁星夜空！',
      radio: [
        { delay: 1.5, speaker: '桃園地面席 · RCTP GND', text: '「Formosa Heavy-748，晶片貨櫃全數鎖固完成，05L 跑道起飛離場前往夜間巡航！」' },
        { delay: 11.0, speaker: '副機長 · FIRST OFFICER', text: '「全台灣夜間車流與城市高樓霓虹就在下方閃耀…速度 V2 已過，正爬升率收輪！」' },
        { delay: 22.0, speaker: '台灣區域區管 · TPE CTR', text: '「Formosa-748，感謝你們這七章守護了整座島嶼的天空。祝一路順風，展翅萬里！」' }
      ],
      winCondition: (f, st) => !f.ended && !f.ground && st.flownM >= 6200 && f.y >= 420
    }
  ];

  const TACTICAL_CARDS = [
    { id: 'sunset', tag: '黃金日落', title: '松山夕陽觀光起飛', desc: '從松山 10 跑道出發，欣賞金色夕陽與 101 市區光影。', quick: 'sunset' },
    { id: 'carrierCatapult', tag: '海上航艦', title: '⚓ 航艦蒸汽彈射起飛', desc: '滿載推力自海上移動航艦彈射升空。', quick: 'carrierCatapult' },
    { id: 'carrierTrap', tag: '精密進場', title: '🛬 航艦尾鉤攔截降落', desc: '放下尾鉤挑戰險峻航艦動態甲板落地。', quick: 'carrierTrap' },
    { id: 'stormApproach', tag: '極端天候', title: '⚡ 雷暴微下衝極限進場', desc: '狂風暴雨伴隨下沉氣流警報的最終考驗。', quick: 'stormApproach' },
    { id: 'refueling', tag: '高空編隊', title: '⛽ KC-135 空中加油對接', desc: '配合 PDI 燈號完成驚險的高空加油補給。', quick: 'refueling' },
    { id: 'mirage', tag: '音速巡弋', title: '幻象 2000 戰機起飛', desc: '體驗三角翼高機動性能與座艙 HUD。', quick: 'mirage' },
    { id: 'duel', tag: '空戰 PVP', title: '一對一近距纏鬥空戰', desc: '雷達鎖定敵機並運用熱焰彈反制飛彈。', quick: 'duel' },
    { id: 'landing', tag: '盲降訓練', title: '桃園國際機場五邊降落', desc: '練習長距離寬體機 ILS 對準接地。', quick: 'landing' }
  ];

  const SCENERY_CARDS = [
    { id: 'tour-city', tag: '台北信義', title: '台北 101 與摩天高樓夜景', desc: '近距離檢視高擬真玻璃帷幕大樓與夜晚都市繁華燈火。', inspect: 'tour-city' },
    { id: 'tour-terminal', tag: '國際樞紐', title: '出發機場航廈與空橋巡覽', desc: '細節滿點的機場塔台、登機門、空橋與滑行道。', inspect: 'tour-terminal' },
    { id: 'tour-river', tag: '都會動脈', title: '基隆河岸橋樑與都會車流', desc: '立體公路交流道網與橋樑上川流不息的車輛與夜燈。', inspect: 'tour-river' },
    { id: 'tour-downtown', tag: '都會街景', title: '臺北車站與西區街道實景', desc: '體驗等比例台灣樓群街道密集建築（飛行撞擊會觸發真實大爆炸！）。', inspect: 'tour-downtown' }
  ];

  let activeTab = 'campaign';
  let selectedChapterId = 1;
  let activeMission = null;
  let radioHideTimer = null;
  let hubOpenTimer = null;

  function loadProgress() {
    try {
      return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}') || {};
    } catch { return {}; }
  }

  function saveProgress(p) {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch {}
  }

  function markChapterComplete(chId, stars = 3) {
    const prog = loadProgress();
    const prev = prog[chId]?.stars || 0;
    prog[chId] = { stars: Math.max(prev, stars), completedAt: Date.now() };
    saveProgress(prog);
  }

  function ensureDOM() {
    if (document.getElementById('titleHub')) return;

    // 1. Add Back-to-Hub bar inside #plan
    const plan = document.getElementById('plan');
    if (plan && !document.getElementById('plannerBackBar')) {
      const bar = document.createElement('div');
      bar.id = 'plannerBackBar';
      bar.className = 'planner-back-bar';
      bar.innerHTML = `<button type="button" id="backToHubBtn" class="hub-back-btn">← 返回條列式主選單</button><span class="muted" style="font-size:12px">自由設定機場、天氣、機型與進階控制</span>`;
      plan.insertBefore(bar, plan.firstChild);
      bar.querySelector('#backToHubBtn').onclick = () => openHub('welcome');
    }

    // 2. Build Title Hub shell
    const hub = document.createElement('div');
    hub.id = 'titleHub';
    hub.setAttribute('aria-label', '主選單');
    hub.innerHTML = `
      <aside class="hub-sidebar">
        <div>
          <div class="hub-brand">
            <span class="hub-kicker">SKYBOUND GLOBAL · v0.63</span>
            <h1 class="hub-title">蒼穹守望者</h1>
            <p class="hub-subtitle">Formosa Wings · 全台等比例都會地形、動態空氣力學座艙與 7 章航空劇情戰役</p>
          </div>
          <ul class="hub-menu-list" role="tablist">
            <li><button type="button" class="hub-menu-btn" data-hub-tab="campaign"><div class="hub-menu-btn-main"><span>📖 劇情戰役 · Story Campaign</span><span class="hub-menu-btn-sub">7 章臺灣航空史詩 · 過場插圖與無線電劇情</span></div><span class="hub-menu-badge">7 章節</span></button></li>
            <li><button type="button" class="hub-menu-btn" data-hub-tab="tactical"><div class="hub-menu-btn-main"><span>🎯 戰術與特勤關卡</span><span class="hub-menu-btn-sub">航艦彈射 · 雷暴切風 · 空中加油 · 空戰</span></div><span class="hub-menu-badge">8 任務</span></button></li>
            <li><button type="button" class="hub-menu-btn" data-hub-tab="planner"><div class="hub-menu-btn-main"><span>✈ 自由飛行規劃</span><span class="hub-menu-btn-sub">自選全台機場、天候、載客貨運與航線</span></div></button></li>
            <li><button type="button" class="hub-menu-btn" data-hub-tab="hangar"><div class="hub-menu-btn-main"><span>🏛️ 3D 機庫與塗裝工坊</span><span class="hub-menu-btn-sub">細緻機身鉚釘 · 全彩座艙儀表檢視</span></div></button></li>
            <li><button type="button" class="hub-menu-btn" data-hub-tab="multiplayer"><div class="hub-menu-btn-main"><span>🌐 多人連線大廳</span><span class="hub-menu-btn-sub">即時房號編隊 · 多人空戰與無線電</span></div></button></li>
            <li><button type="button" class="hub-menu-btn" data-hub-tab="scenery"><div class="hub-menu-btn-main"><span>🗺️ 全台地景巡覽與紀錄</span><span class="hub-menu-btn-sub">101 摩天樓夜景 · 車流高架道路 · 飛行紀錄</span></div></button></li>
          </ul>
        </div>
        <div class="hub-sidebar-footer">
          <span>💡 飛航警示：撞擊大樓／塔台將觸發真實爆炸墜毀</span>
          <span>🎮 切換座艙視角按 <b>C</b> · 切換視野按 <b>N</b> · 輔助巡航按 <b>J</b></span>
        </div>
      </aside>
      <section class="hub-stage" id="hubStage"></section>
    `;
    document.body.appendChild(hub);

    // 3. In-flight HUD overlays (Objective, Radio dialogue, Debrief)
    const obj = document.createElement('div');
    obj.id = 'storyObjectiveHud';
    obj.hidden = true;
    document.body.appendChild(obj);

    const radio = document.createElement('div');
    radio.id = 'storyRadioBar';
    radio.hidden = true;
    radio.innerHTML = `<div class="radio-speaker"><span id="storyRadioSpeaker"></span><span>📻 CH-121.5</span></div><div class="radio-text" id="storyRadioText"></div>`;
    document.body.appendChild(radio);

    const debrief = document.createElement('div');
    debrief.id = 'storyDebrief';
    debrief.hidden = true;
    debrief.innerHTML = `<div class="debrief-box"><img class="debrief-banner" id="storyDebriefImg" alt="任務圖卡"><div class="debrief-body"><h2 id="storyDebriefTitle"></h2><p id="storyDebriefText"></p><div class="debrief-actions" id="storyDebriefActions"></div></div></div>`;
    document.body.appendChild(debrief);

    hub.addEventListener('click', e => {
      const tabBtn = e.target.closest('[data-hub-tab]');
      if (tabBtn) {
        const tab = tabBtn.dataset.hubTab;
        if (tab === 'planner') {
          closeHub();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (tab === 'hangar') {
          closeHub();
          document.getElementById('openHangar')?.click();
        } else if (tab === 'multiplayer') {
          closeHub();
          const mpBtn = document.getElementById('modeMultiplayer');
          mpBtn?.click();
          const mpDet = document.getElementById('multiplayerSection');
          if (mpDet) mpDet.open = true;
        } else {
          renderStage(tab);
        }
      }
      const chBtn = e.target.closest('[data-chapter-id]');
      if (chBtn) {
        selectedChapterId = Number(chBtn.dataset.chapterId);
        renderStage('campaign');
      }
      const launchBtn = e.target.closest('#hubLaunchChapterBtn');
      if (launchBtn) {
        startChapter(selectedChapterId);
      }
      const quickBtn = e.target.closest('[data-hub-quick]');
      if (quickBtn) {
        const key = quickBtn.dataset.hubQuick;
        closeHub();
        document.querySelector(`#quickFlights [data-quick="${key}"]`)?.click();
      }
      const inspBtn = e.target.closest('[data-hub-inspect]');
      if (inspBtn) {
        const key = inspBtn.dataset.hubInspect;
        closeHub();
        const sel = document.getElementById('inspect');
        if (sel) sel.value = key;
        document.getElementById('viewScene')?.click();
      }
    });

    // Sync hub visibility whenever external triggers start a flight or open planner
    const flyBtn = document.getElementById('fly');
    if (flyBtn) flyBtn.addEventListener('click', () => closeHub());
    const menuBtn = document.getElementById('menu');
    if (menuBtn) menuBtn.addEventListener('click', () => {
      activeMission = null;
      hideFlightStoryOverlays();
      clearTimeout(hubOpenTimer);
      hubOpenTimer = setTimeout(() => {
        if (!document.body.classList.contains('flight-ui')) openHub(activeTab || 'campaign');
      }, 80);
    });
    const exitInsp = document.getElementById('exitInspection');
    if (exitInsp) exitInsp.addEventListener('click', () => {
      clearTimeout(hubOpenTimer);
      hubOpenTimer = setTimeout(() => {
        if (!document.body.classList.contains('flight-ui')) openHub(activeTab || 'scenery');
      }, 80);
    });
    const qFlights = document.getElementById('quickFlights');
    if (qFlights) qFlights.addEventListener('click', () => closeHub());
    const brandHeader = document.querySelector('header strong');
    if (brandHeader) {
      brandHeader.style.cursor = 'pointer';
      brandHeader.title = '回到乾淨首頁主選單';
      brandHeader.addEventListener('click', () => {
        if (!document.body.classList.contains('flight-ui')) openHub(activeTab || 'campaign');
      });
    }
  }

  function renderStage(tab = activeTab) {
    activeTab = tab;
    const hub = document.getElementById('titleHub');
    const stage = document.getElementById('hubStage');
    if (!hub || !stage) return;

    hub.querySelectorAll('.hub-menu-btn').forEach(btn => {
      const sel = btn.dataset.hubTab === tab;
      btn.classList.toggle('active', sel);
      btn.setAttribute('aria-selected', String(sel));
    });

    const prog = loadProgress();
    const completedCount = Object.keys(prog).length;

    if (tab === 'welcome') {
      stage.innerHTML = `
        <div class="hub-welcome-hero">
          <span class="hub-kicker">TAIWAN NEXT-GEN FLIGHT SIMULATOR</span>
          <h2>選一項任務，立即起飛</h2>
          <p>全新《蒼穹守望者》劇情戰役收錄 7 大原創關卡與設計插圖。駕駛細緻空氣動力座艙機型掠過全台真實建物群與夜間高架道路，體驗擬真駕駛手感與碰撞大爆炸效應。</p>
          <div class="hub-hero-stats">
            <div class="hub-stat-card"><small>戰役章節進度</small><strong>${completedCount} / 7 章</strong></div>
            <div class="hub-stat-card"><small>建築碰撞運算</small><strong>全台建物實時判定</strong></div>
            <div class="hub-stat-card"><small>航空圖景</small><strong>8 張原創手繪插畫</strong></div>
          </div>
          <div class="actions">
            <button type="button" class="campaign-launch-btn" onclick="window.SkyboundCampaign.selectTab('campaign')">📖 進入劇情關卡選單 →</button>
            <button type="button" class="hub-back-btn" onclick="window.SkyboundCampaign.closeHub()">✈ 開啟自由飛行詳細規劃</button>
          </div>
        </div>`;
      return;
    }

    if (tab === 'campaign') {
      const ch = CHAPTERS.find(c => c.id === selectedChapterId) || CHAPTERS[0];
      const chStars = prog[ch.id]?.stars || 0;
      const cardsHtml = CHAPTERS.map(item => {
        const s = prog[item.id]?.stars || 0;
        const starsStr = s ? '★'.repeat(s) + '☆'.repeat(3 - s) : 'NEW';
        return `
          <button type="button" class="campaign-ch-card${item.id === ch.id ? ' selected' : ''}" data-chapter-id="${item.id}">
            <img class="campaign-ch-thumb" src="${item.image}" alt="${item.title}">
            <div>
              <strong>${item.code} · ${item.title}</strong>
              <small>${item.subtitle}</small>
            </div>
            <span class="campaign-stars">${starsStr}</span>
          </button>`;
      }).join('');

      stage.innerHTML = `
        <div class="hub-section-panel">
          <div class="hub-section-head">
            <div>
              <h2>📖 劇情戰役 · Formosa Wings（${completedCount}/7 完成）</h2>
              <p>點選右側各章節即可預覽高畫質章節插圖、簡報目標與機組無線電劇情</p>
            </div>
          </div>
          <div class="campaign-layout">
            <article class="campaign-feature">
              <div class="campaign-art-wrap">
                <img src="${ch.image}" alt="${ch.title}">
                <div class="campaign-art-overlay">
                  <span class="campaign-ch-tag">${ch.code} · ${ch.subtitle}</span>
                  <span class="campaign-stars">${chStars ? '通關紀錄 ' + '★'.repeat(chStars) : '尚未出動'}</span>
                </div>
              </div>
              <div class="campaign-feature-body">
                <h3>${ch.title}</h3>
                <p class="campaign-story-copy">${ch.story}</p>
                <div class="campaign-meta-chips">
                  <span class="campaign-chip">✈ 機型：${ch.aircraft.toUpperCase()}</span>
                  <span class="campaign-chip">🛫 航點：${ch.departure} → ${ch.destination}</span>
                  <span class="campaign-chip">🕒 時刻：${ch.time}</span>
                  <span class="campaign-chip">🎯 目標：${ch.targetText}</span>
                </div>
                <div class="campaign-feature-actions">
                  <button type="button" id="hubLaunchChapterBtn" class="campaign-launch-btn">▶ 立即出發執飛 ${ch.code} →</button>
                </div>
              </div>
            </article>
            <div class="campaign-chapter-list" aria-label="章節列表">${cardsHtml}</div>
          </div>
        </div>`;
      return;
    }

    if (tab === 'tactical') {
      const cards = TACTICAL_CARDS.map(c => `
        <button type="button" class="hub-action-card" data-hub-quick="${c.quick}">
          <div>
            <span class="hub-action-pill">${c.tag}</span>
            <strong style="display:block;margin-top:6px">${c.title}</strong>
          </div>
          <small>${c.desc}</small>
        </button>`).join('');
      stage.innerHTML = `
        <div class="hub-section-panel">
          <div class="hub-section-head">
            <div><h2>🎯 戰術特勤與高難度訓練</h2><p>點選任一特勤情境即刻載入機位與實戰設定起飛</p></div>
          </div>
          <div class="hub-cards-grid">${cards}</div>
        </div>`;
      return;
    }

    if (tab === 'scenery') {
      const cards = SCENERY_CARDS.map(c => `
        <button type="button" class="hub-action-card" data-hub-inspect="${c.inspect}">
          <div>
            <span class="hub-action-pill">${c.tag}</span>
            <strong style="display:block;margin-top:6px">${c.title}</strong>
          </div>
          <small>${c.desc}</small>
        </button>`).join('');
      const logHtml = document.getElementById('log')?.innerHTML || '<p class="muted">尚無飛行紀錄</p>';
      stage.innerHTML = `
        <div class="hub-section-panel">
          <div class="hub-section-head">
            <div><h2>🗺️ 全台高精細地景巡覽與紀錄</h2><p>一鍵前往信義 101 摩天樓群、桃園松山機場與基隆河車流場景</p></div>
          </div>
          <div class="hub-cards-grid">${cards}</div>
          <div style="background:rgba(9,23,36,0.85);border:1px solid rgba(140,200,235,0.22);border-radius:14px;padding:14px 18px;max-height:190px;overflow:auto;">
            <strong style="font-size:13px;color:#ffd976">近期飛行日誌</strong>
            <div style="margin-top:6px;font-size:12.5px;color:#cde4f2">${logHtml}</div>
          </div>
        </div>`;
    }
  }

  function openHub(tab = activeTab) {
    if (document.body.classList.contains('flight-ui')) return;
    ensureDOM();
    const hub = document.getElementById('titleHub');
    if (hub) hub.hidden = false;
    document.body.classList.add('title-hub-open');
    renderStage(tab);
  }

  function closeHub() {
    clearTimeout(hubOpenTimer);
    hubOpenTimer = null;
    const hub = document.getElementById('titleHub');
    if (hub) hub.hidden = true;
    document.body.classList.remove('title-hub-open');
  }

  function hideFlightStoryOverlays() {
    const o = document.getElementById('storyObjectiveHud');
    const r = document.getElementById('storyRadioBar');
    const d = document.getElementById('storyDebrief');
    if (o) o.hidden = true;
    if (r) r.hidden = true;
    if (d) d.hidden = true;
    if (radioHideTimer) { clearTimeout(radioHideTimer); radioHideTimer = null; }
  }

  function showRadio(speaker, text, durationMs = 7500) {
    const bar = document.getElementById('storyRadioBar');
    const sp = document.getElementById('storyRadioSpeaker');
    const tx = document.getElementById('storyRadioText');
    if (!bar || !sp || !tx) return;
    sp.textContent = speaker;
    tx.textContent = text;
    bar.hidden = false;
    if (radioHideTimer) clearTimeout(radioHideTimer);
    radioHideTimer = setTimeout(() => { bar.hidden = true; }, durationMs);
  }

  function showDebrief(ch, won, reason) {
    const modal = document.getElementById('storyDebrief');
    const img = document.getElementById('storyDebriefImg');
    const title = document.getElementById('storyDebriefTitle');
    const text = document.getElementById('storyDebriefText');
    const actions = document.getElementById('storyDebriefActions');
    if (!modal || !img || !title || !text || !actions) return;

    img.src = ch.image;
    title.textContent = won ? `★ ${ch.code} · 任務圓滿達成！` : `💥 ${ch.code} · 任務中斷墜毀`;
    title.style.color = won ? '#ffd976' : '#ff6b6b';
    text.textContent = reason || (won ? '恭喜成功通過本次臺灣空域行動考核！下一章任務現已準備就緒。' : '發生嚴重碰撞或迫降失事，請重整態勢再次挑戰本關！');
    actions.innerHTML = '';

    if (won && ch.id < CHAPTERS.length) {
      const nextBtn = document.createElement('button');
      nextBtn.type = 'button';
      nextBtn.className = 'campaign-launch-btn';
      nextBtn.textContent = `▶ 續飛第 ${ch.id + 1} 章 →`;
      nextBtn.onclick = () => {
        modal.hidden = true;
        document.getElementById('menu')?.click();
        setTimeout(() => startChapter(ch.id + 1), 160);
      };
      actions.appendChild(nextBtn);
    }

    const retryBtn = document.createElement('button');
    retryBtn.type = 'button';
    retryBtn.className = won ? 'hub-back-btn' : 'campaign-launch-btn';
    retryBtn.textContent = '🔄 重新挑戰本關卡';
    retryBtn.onclick = () => {
      modal.hidden = true;
      document.getElementById('menu')?.click();
      setTimeout(() => startChapter(ch.id), 160);
    };
    actions.appendChild(retryBtn);

    const hubBtn = document.createElement('button');
    hubBtn.type = 'button';
    hubBtn.className = 'hub-back-btn';
    hubBtn.textContent = '回到戰役選單';
    hubBtn.onclick = () => {
      modal.hidden = true;
      document.getElementById('menu')?.click();
      setTimeout(() => openHub('campaign'), 120);
    };
    actions.appendChild(hubBtn);

    modal.hidden = false;
  }

  function startChapter(chapterId) {
    const ch = CHAPTERS.find(c => c.id === chapterId) || CHAPTERS[0];
    selectedChapterId = ch.id;
    closeHub();
    hideFlightStoryOverlays();

    const acSel = document.getElementById('aircraft');
    const depSel = document.getElementById('departure');
    const dstSel = document.getElementById('destination');
    const lesSel = document.getElementById('lesson');
    const stSel = document.getElementById('startType');
    const wSel = document.getElementById('weather');
    const tIn = document.getElementById('time');

    if (wSel && ch.weather != null) wSel.value = ch.weather;
    if (tIn && ch.time) tIn.value = ch.time;
    if (lesSel && ch.lesson) { lesSel.value = ch.lesson; lesSel.dispatchEvent(new Event('change')); }
    if (depSel && ch.departure) depSel.value = ch.departure;
    if (dstSel && ch.destination) dstSel.value = ch.destination;
    if (stSel && ch.startType) stSel.value = ch.startType;
    if (acSel && ch.aircraft) {
      const optExists = [...acSel.options].some(o => o.value === ch.aircraft);
      if (optExists) acSel.value = ch.aircraft;
    }

    activeMission = {
      ch,
      startedAt: performance.now(),
      flownM: 0,
      lastX: null,
      lastZ: null,
      triggeredRadio: new Set(),
      settled: false
    };

    if (ch.quickPreset) {
      const qBtn = document.querySelector(`#quickFlights [data-quick="${ch.quickPreset}"]`);
      if (qBtn) qBtn.click();
      else document.getElementById('fly')?.click();
    } else {
      document.getElementById('fly')?.click();
    }

    const objHud = document.getElementById('storyObjectiveHud');
    if (objHud) {
      objHud.textContent = `${ch.code} · ${ch.targetText}`;
      objHud.hidden = false;
    }
  }

  // Lightweight flight progress watcher (polls 4Hz only when activeMission runs)
  setInterval(() => {
    if (!activeMission || activeMission.settled) return;
    const f = globalScope.__skyboundFlight;
    if (!f) return;
    const elapsedS = (performance.now() - activeMission.startedAt) / 1000;
    if (activeMission.lastX != null) {
      activeMission.flownM += Math.hypot(f.x - activeMission.lastX, f.z - activeMission.lastZ);
    }
    activeMission.lastX = f.x;
    activeMission.lastZ = f.z;

    const ch = activeMission.ch;
    for (let i = 0; i < ch.radio.length; i++) {
      const line = ch.radio[i];
      if (!activeMission.triggeredRadio.has(i) && elapsedS >= line.delay) {
        activeMission.triggeredRadio.add(i);
        showRadio(line.speaker, line.text);
      }
    }

    const objHud = document.getElementById('storyObjectiveHud');
    if (objHud && ch.objectiveDistM) {
      const pct = Math.min(100, Math.round((activeMission.flownM / ch.objectiveDistM) * 100));
      const altFt = Math.max(0, Math.round((f.y || 0) * 3.28084));
      objHud.textContent = `${ch.code} ${ch.title} · 進度 ${pct}% · 高度 ${altFt} ft`;
    }

    if (f.ended && !activeMission.settled) {
      activeMission.settled = true;
      const reason = f.crashedBuilding
        ? '飛機直接撞上台北高樓建築物引發猛烈爆炸！敬請拉高巡航高度並謹慎操控航線。'
        : '落地或迫降速度過重造成失事墜毀，請重新調整下滑角再次起飛。';
      setTimeout(() => {
        if (activeMission?.ch === ch) showDebrief(ch, false, reason);
      }, 4200);
      return;
    }

    if (ch.winCondition(f, { flownM: activeMission.flownM, elapsedS }) && !activeMission.settled) {
      activeMission.settled = true;
      markChapterComplete(ch.id, 3);
      if (objHud) objHud.textContent = `✓ ${ch.code} 任務目標達成！`;
      showRadio('戰情中心 · MISSION CONTROL', `「漂亮！${ch.code}『${ch.title}』目標圓滿達成，幹得好！」`, 6500);
      setTimeout(() => {
        if (activeMission?.ch === ch) showDebrief(ch, true);
      }, 2800);
    }
  }, 250);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => openHub('welcome'));
  } else {
    openHub('welcome');
  }

  globalScope.SkyboundCampaign = {
    chapters: CHAPTERS,
    openHub,
    closeHub,
    selectTab: renderStage,
    startChapter,
    getProgress: loadProgress
  };
})(typeof window !== 'undefined' ? window : globalThis);
