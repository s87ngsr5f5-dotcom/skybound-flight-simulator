'use strict';
// v0.65 Unified Single Home Hub (Home / Story / Online Multiplayer / Challenges / Tactical / Free Flight / Scenery / Settings)
(function (globalScope) {
  const PROGRESS_KEY = 'skybound.campaignProgress.v1';
  const CAREER_META_KEY = 'skybound.campaignCareer.v1';
  const SIM_CAREER_KEY = 'skybound.career.v1';

  const RANKS = [
    { minXp: 0, title: '實習副駕駛 F/O', badge: '🪶' },
    { minXp: 350, title: '民航副機長 S/O', badge: '✈' },
    { minXp: 900, title: '資深正機長 CAPT', badge: '⭐' },
    { minXp: 1800, title: '特勤戰術官 INSTR', badge: '🦅' },
    { minXp: 3200, title: '王牌飛行員 ACE', badge: '🔥' },
    { minXp: 5200, title: '蒼穹傳奇 LEGEND', badge: '👑' }
  ];

  const MEDALS = [
    { id: 'first_wings', icon: '🛫', name: '晨曦首航', desc: '完成任意 1 個劇情或挑戰任務' },
    { id: 'skyline_ace', icon: '🏙️', name: '台北低空王', desc: '通過 EP.02 信義天際摩天樓挑戰' },
    { id: 'storm_breaker', icon: '⛈️', name: '颱風破雲者', desc: '突破 EP.03 凱米颱風強烈風切' },
    { id: 'carrier_hawk', icon: '⚓', name: '航艦彈射手', desc: '完成 EP.04 海上航艦彈射升空' },
    { id: 'fuel_master', icon: '⛽', name: '雲上接管者', desc: '完成 EP.05 KC-135 高空編隊補給' },
    { id: 'sky_guardian', icon: '🎯', name: '防空攔截王牌', desc: '完成 EP.06 中央山脈領空捍衛' },
    { id: 'campaign_hero', icon: '🏆', name: '蒼穹七章傳奇', desc: '通關全部 7 章《蒼穹守望者》戰役' },
    { id: 'perfectionist', icon: '🌟', name: '三星大師', desc: '在任一章節拿到 ★★★ 滿星評價' },
    { id: 'daily_pilot', icon: '📅', name: '每日值勤官', desc: '完成一次「今日緊急派遣」任務' },
    { id: 'speed_demon', icon: '⚡', name: '低空極速狂人', desc: '完成一次「低空峽谷極速衝刺」' }
  ];

  const CHAPTERS = [
    {
      id: 1,
      code: 'EP.01',
      title: '晨曦首航：淡水河巡禮',
      subtitle: '松山起飛 · 三階段低空認識台北盆地',
      image: 'assets/campaign/ch1.jpg',
      aircraft: 'c172s',
      departure: 'RCSS',
      destination: 'RCTP',
      lesson: 'free',
      startType: 'runway',
      weather: '0',
      time: '06:20',
      objectiveDistM: 3200,
      parTimeS: 95,
      rewardMoney: 5000,
      rewardXp: 180,
      maxSafeG: 3.5,
      targetText: '① 跑道離地爬升 ② 維持 600+ ft 掠過基隆河 ③ 累積巡航 3.2 km',
      story: '清晨六點二十分，晨曦染金了大屯山與淡水河。你剛通過民航機師檢定，將與周教官駕駛 Cessna 172S 從松山 10 跑道首飛，依序完成離地、低空走廊巡航與平飛穩定考驗。',
      radio: [
        { delay: 1.5, speaker: '周教官 · RCSS教席', text: '「晨風，歡迎來到真正的天空！油門推滿，達 55 節輕輕拉桿離地。」' }
      ],
      stages: [
        {
          label: '階段 1/3 · 加速離地爬升至 400 ft',
          check: f => !f.ended && !f.ground && f.y >= 122,
          radio: { speaker: '台北近場台 · Taipei Approach', text: '「Skybound-01 已離地！請繼續爬升並沿淡水河向西進入第二階段巡航。」' }
        },
        {
          label: '階段 2/3 · 保持 500+ ft 巡航累積 1.8 km',
          check: (f, st) => !f.ended && f.y >= 152 && st.flownM >= 1800,
          radio: { speaker: '副駕駛 · 周教官', text: '「看左側信義區 101 玻璃帷幕在晨光中反光了！穩住姿態完成最後一段航程！」' }
        },
        {
          label: '階段 3/3 · 穩定完成 3.2 km 盆地巡禮',
          check: (f, st) => !f.ended && f.y >= 160 && st.flownM >= 3200
        }
      ],
      winCondition: (f, st) => !f.ended && f.airborne && st.flownM >= 3200 && f.y >= 160
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
      parTimeS: 105,
      rewardMoney: 8000,
      rewardXp: 240,
      maxSafeG: 3.4,
      targetText: '① 松山離場爬升 ② 安全閃避信義高樓區 (> 900 ft) ③ 巡航飛往桃園 5 km',
      story: '全新塗裝的 A220-300 完成松山靜態檢驗，急須調度飛往桃園國際機場投入春運。金色斜陽下雲層低垂，市區摩天樓林立，切記拉高安全離地高，一旦擦撞大樓將立即爆毀！',
      radio: [
        { delay: 1.5, speaker: '松山塔台 · Songshan Tower', text: '「Horizon-220，10 號跑道允許起飛，離地後避開 101 高樓群！」' }
      ],
      stages: [
        {
          label: '階段 1/3 · 起飛離地收輪爬升 (> 500 ft)',
          check: f => !f.ended && !f.ground && f.y >= 155,
          radio: { speaker: '機長座艙警告 · GPWS', text: '「高度安全確認！前方進入都會高樓空域，請爬升至 1,000 ft 以上保持淨空。」' }
        },
        {
          label: '階段 2/3 · 爬升越過摩天樓群 (> 1,000 ft · 2.8 km)',
          check: (f, st) => !f.ended && f.y >= 305 && st.flownM >= 2800,
          radio: { speaker: '桃機進場管制 · RCTP APP', text: '「Horizon-220 雷達識別完成！繼續向西推進完成 5 km 調度航段。」' }
        },
        {
          label: '階段 3/3 · 穩定維持高空走廊達 5.0 km',
          check: (f, st) => !f.ended && f.y >= 320 && st.flownM >= 5000
        }
      ],
      winCondition: (f, st) => !f.ended && st.flownM >= 5000 && f.y >= 320
    },
    {
      id: 3,
      code: 'EP.03',
      title: '風暴迫降：凱米颱風微下衝切',
      subtitle: '暴雨強風切 · 三階段穿雲突圍考驗',
      image: 'assets/campaign/ch3.jpg',
      aircraft: 'b38m',
      departure: 'RCTP',
      destination: 'RCKH',
      lesson: 'free',
      startType: 'runway',
      weather: 'storm',
      time: '17:45',
      objectiveDistM: 6000,
      parTimeS: 120,
      rewardMoney: 12000,
      rewardXp: 320,
      maxSafeG: 3.6,
      targetText: '① 頂風起飛抗側風 ② 穿雲爬升突破 1,500 ft ③ 穩定南下航道 6 km（或落地高雄）',
      story: '強烈颱風逼近南台灣，雷雨雲籠罩桃園與海峽西岸。艙內坐著 162 名返鄉旅客，你必須頂著閃電與劇烈氣流穩住 737 MAX 仰角與空速，安全穿雲爬升、突破暴風層！',
      radio: [
        { delay: 1.5, speaker: '氣象雷達警報 · WEATHER', text: '「前方跑道延伸線偵測強烈微下衝氣流！起飛後注意空速與仰角保持！」' }
      ],
      stages: [
        {
          label: '階段 1/3 · 暴風雨起飛離地 (> 550 ft)',
          check: f => !f.ended && !f.ground && f.y >= 170,
          radio: { speaker: '客艙廣播 · PURSER', text: '「各位旅客您好，受颱風環流影響氣流不穩，機長正全力拉升穿透雲層。」' }
        },
        {
          label: '階段 2/3 · 頂住風切爬升至 1,500 ft 以上',
          check: (f, st) => !f.ended && f.y >= 460 && st.flownM >= 3200,
          radio: { speaker: '戰情指揮室 · OPS', text: '「漂亮！已穿過最劇烈的亂流區！繼續維持航向完成 6 km 突圍。」' }
        },
        {
          label: '階段 3/3 · 完成 6.0 km 暴風突圍或安全落地',
          check: (f, st) => !f.ended && ((f.finished && f.landed) || (st.flownM >= 6000 && f.y >= 480))
        }
      ],
      winCondition: (f, st) => !f.ended && ((f.finished && f.landed) || (st.flownM >= 6000 && f.y >= 480))
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
      parTimeS: 95,
      rewardMoney: 15000,
      rewardXp: 380,
      maxSafeG: 7.8,
      targetText: '① 後燃器全開彈射離艦 ② 高速爬升達 1,200 ft ③ 切入東部海岸戰巡 5.5 km',
      story: '東部外海海域偵測不明無人偵察機訊號。航空母艦甲板蒸汽滾滾，後燃器轟鳴聲劃破海風——彈射鎖解除，台灣防空尖兵即刻升空攔截！',
      radio: [
        { delay: 1.0, speaker: '航艦甲板長 · AIR BOSS', text: '「Viper-1 進入 1 號彈射槽！油門推至 100% 滿推力後燃器，準備彈射！」' }
      ],
      stages: [
        {
          label: '階段 1/3 · 離艦升空收起落架 (> 300 ft)',
          check: f => !f.ended && !f.ground && f.y >= 95,
          radio: { speaker: '作戰管制官 · E-2K HAWKEYE', text: '「Viper-1 順利離艦！立即爬升至 1,200 ft 以上切入花東外海攔截航線！」' }
        },
        {
          label: '階段 2/3 · 高速爬升至 1,200+ ft 戰巡高度',
          check: (f, st) => !f.ended && f.y >= 365 && st.flownM >= 2600,
          radio: { speaker: '僚機 · VIPER-2', text: '「已目視花東海岸線！加速推進至 5.5 km 戰術巡邏點！」' }
        },
        {
          label: '階段 3/3 · 抵達 5.5 km 東海防空戰巡點',
          check: (f, st) => !f.ended && !f.ground && st.flownM >= 5500 && f.y >= 365
        }
      ],
      winCondition: (f, st) => !f.ended && !f.ground && st.flownM >= 5500 && f.y >= 365
    },
    {
      id: 5,
      code: 'EP.05',
      title: '雲上生死線：高空空中加油',
      subtitle: 'KC-135 精密編隊對接補給',
      image: 'assets/campaign/ch5.jpg',
      aircraft: 'sf16',
      departure: 'RCYU',
      destination: 'RCKH',
      quickPreset: 'refueling',
      startType: 'air',
      weather: 'clouds',
      time: '16:10',
      objectiveDistM: 6000,
      parTimeS: 100,
      rewardMoney: 18000,
      rewardXp: 440,
      maxSafeG: 6.5,
      targetText: '① 靠近 KC-135 編隊空域 ② 穩定保持速度姿態 20 秒 ③ 完成 6 km 補給編隊',
      story: '經過一小時驅離巡邏，戰機內油已跌破安全餘裕。KC-135 加油機在萬呎金黃雲海上展開伸縮加油管，你必須將機速與姿態控至毫釐之間！',
      radio: [
        { delay: 1.2, speaker: '加油官 · TEXACO-21', text: '「Viper-1，我是 Texaco-21，依機腹 PDI 燈號緩慢前推逼近對接區！」' }
      ],
      stages: [
        {
          label: '階段 1/3 · 進入加油機編隊區 (穩定飛行 10 秒)',
          check: (f, st) => !f.ended && !f.ground && st.elapsedS >= 10,
          radio: { speaker: '系統語音 · FUEL ALERT', text: '「油門微調表現穩定！繼續保持高度與姿態進行高空輸油編隊！」' }
        },
        {
          label: '階段 2/3 · 維持編隊輸油進度 (累積 24 秒 / 3.5 km)',
          check: (f, st) => !f.ended && st.elapsedS >= 24 && (f.fuel > 3200 || st.flownM >= 3500),
          radio: { speaker: '加油官 · TEXACO-21', text: '「輸油作業即將完成，太穩的操縱手感了！準備脫離編隊！」' }
        },
        {
          label: '階段 3/3 · 安全脫離並飛越 6.0 km 補給空域',
          check: (f, st) => !f.ended && st.elapsedS >= 34 && (f.fuel > 3400 || st.flownM >= 6000)
        }
      ],
      winCondition: (f, st) => !f.ended && st.elapsedS >= 34 && (f.fuel > 3400 || st.flownM >= 6000)
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
      parTimeS: 125,
      rewardMoney: 22000,
      rewardXp: 520,
      maxSafeG: 8.5,
      targetText: '① 緊急升空啟用雷達 ② 高空高速巡弋中央山脈 ③ 清除威脅或壓制空域 7 km',
      story: '多名高空不明飛行器越過識別區飛向中央山脈。空防響起最高警戒，駕駛幻象 2000 以超音速直衝蒼穹，用飛彈與機砲守住台灣最高空域防線！',
      radio: [
        { delay: 1.5, speaker: '空軍戰管 · CAP CTRL', text: '「緊急起飛！打開右側戰術雷達鎖定來襲目標，準備武器授權！」' }
      ],
      stages: [
        {
          label: '階段 1/3 · 緊急升空爬升 (> 800 ft)',
          check: f => !f.ended && !f.ground && f.y >= 245,
          radio: { speaker: '座艙電戰系統 · RWR', text: '「Radar Contact！按下空白鍵或飛彈鈕鎖定發射，注意山脈地形高度！」' }
        },
        {
          label: '階段 2/3 · 高空攔截掃蕩 (累積 4.0 km / 22 秒)',
          check: (f, st) => !f.ended && (f.finished || (st.elapsedS >= 22 && st.flownM >= 4000)),
          radio: { speaker: '總指揮部 · HQ', text: '「蒼穹守望者，敵訊號正逐步潰散！完成空域掃蕩巡弋即可返場！」' }
        },
        {
          label: '階段 3/3 · 徹底淨空中央山脈防線 (7.0 km)',
          check: (f, st) => !f.ended && (f.finished || (st.elapsedS >= 38 && st.flownM >= 7000))
        }
      ],
      winCondition: (f, st) => !f.ended && (f.finished || (st.elapsedS >= 38 && st.flownM >= 7000))
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
      parTimeS: 130,
      rewardMoney: 30000,
      rewardXp: 700,
      maxSafeG: 3.2,
      targetText: '① 夜雨重載起飛 ② 平穩爬升至 1,500 ft 鳥瞰夜景 ③ 切入高空國際航道 7.5 km',
      story: '這是這趟傳奇戰役的最終章。深夜十點半桃園滂沱夜雨，四具巨型渦扇引擎點亮濕漉漉的跑道與萬家燈火——載滿寶島科技的希望，飛向繁星夜空！',
      radio: [
        { delay: 1.5, speaker: '桃園地面席 · RCTP GND', text: '「Formosa Heavy-748，晶片貨櫃鎖固完成，05L 跑道允許重載起飛！」' }
      ],
      stages: [
        {
          label: '階段 1/3 · 重載離地正爬升 (> 500 ft)',
          check: f => !f.ended && !f.ground && f.y >= 155,
          radio: { speaker: '副機長 · FIRST OFFICER', text: '「正爬升率收輪！下方台灣都會夜燈與車流真壯觀，繼續爬升至 1,500 ft！」' }
        },
        {
          label: '階段 2/3 · 爬升穿越新北台北夜空 (> 1,500 ft · 4.2 km)',
          check: (f, st) => !f.ended && f.y >= 460 && st.flownM >= 4200,
          radio: { speaker: '台灣區域區管 · TPE CTR', text: '「Formosa-748，感謝你們這七章守護了整座島嶼的天空。最後一段加速切入巡航！」' }
        },
        {
          label: '階段 3/3 · 切入高空繁星巡航航道 (7.5 km)',
          check: (f, st) => !f.ended && !f.ground && st.flownM >= 7500 && f.y >= 460
        }
      ],
      winCondition: (f, st) => !f.ended && !f.ground && st.flownM >= 7500 && f.y >= 460
    }
  ];

  const TACTICAL_CARDS = [
    { id: 'sunset', tag: '黃金日落', image: 'assets/campaign/ch1.jpg', title: '松山夕陽觀光起飛', desc: '從松山 10 跑道出發，欣賞金色夕陽與 101 市區光影。', quick: 'sunset' },
    { id: 'carrierCatapult', tag: '海上航艦', image: 'assets/campaign/ch4.jpg', title: '⚓ 航艦蒸汽彈射起飛', desc: '滿載推力自海上移動航艦彈射升空。', quick: 'carrierCatapult' },
    { id: 'carrierTrap', tag: '精密進場', image: 'assets/campaign/ch4.jpg', title: '🛬 航艦尾鉤攔截降落', desc: '放下尾鉤挑戰險峻航艦動態甲板落地。', quick: 'carrierTrap' },
    { id: 'stormApproach', tag: '極端天候', image: 'assets/campaign/ch3.jpg', title: '⚡ 雷暴微下衝極限進場', desc: '狂風暴雨伴隨下沉氣流警報的最終考驗。', quick: 'stormApproach' },
    { id: 'refueling', tag: '高空編隊', image: 'assets/campaign/ch5.jpg', title: '⛽ KC-135 空中加油對接', desc: '配合 PDI 燈號完成驚險的高空加油補給。', quick: 'refueling' },
    { id: 'mirage', tag: '音速巡弋', image: 'assets/campaign/ch6.jpg', title: '幻象 2000 戰機起飛', desc: '體驗三角翼高機動性能與座艙 HUD。', quick: 'mirage' },
    { id: 'duel', tag: '空戰 PVP', image: 'assets/campaign/ch6.jpg', title: '一對一近距纏鬥空戰', desc: '雷達鎖定敵機並運用熱焰彈反制飛彈。', quick: 'duel' },
    { id: 'landing', tag: '盲降訓練', image: 'assets/campaign/ch7.jpg', title: '桃園國際機場五邊降落', desc: '練習長距離寬體機 ILS 對準接地。', quick: 'landing' }
  ];

  const SCENERY_CARDS = [
    { id: 'tour-city', tag: '台北信義', image: 'assets/campaign/ch2.jpg', title: '台北 101 與摩天高樓夜景', desc: '近距離檢視高擬真玻璃帷幕大樓與夜晚都市繁華燈火。', inspect: 'tour-city' },
    { id: 'tour-terminal', tag: '國際樞紐', image: 'assets/campaign/ch7.jpg', title: '出發機場航廈與空橋巡覽', desc: '細節滿點的機場塔台、登機門、空橋與滑行道。', inspect: 'tour-terminal' },
    { id: 'tour-river', tag: '都會動脈', image: 'assets/campaign/ch1.jpg', title: '基隆河岸橋樑與都會車流', desc: '立體公路交流道網與橋樑上川流不息的車輛與夜燈。', inspect: 'tour-river' },
    { id: 'tour-downtown', tag: '都會街景', image: 'assets/campaign/ch2.jpg', title: '臺北車站與西區街道實景', desc: '體驗等比例台灣樓群街道密集建築（碰撞會觸發真實大爆炸！）。', inspect: 'tour-downtown' }
  ];

  let activeTab = 'welcome';
  let selectedChapterId = 1;
  let activeMission = null;
  let radioHideTimer = null;
  let hubOpenTimer = null;

  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function loadProgress() {
    try {
      return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}') || {};
    } catch { return {}; }
  }

  function saveProgress(p) {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch {}
  }

  function loadCareerMeta() {
    try {
      const raw = JSON.parse(localStorage.getItem(CAREER_META_KEY) || '{}') || {};
      return {
        xp: Math.max(0, Number(raw.xp) || 0),
        missionsCompleted: Math.max(0, Number(raw.missionsCompleted) || 0),
        streak: Math.max(0, Number(raw.streak) || 0),
        bestStreak: Math.max(0, Number(raw.bestStreak) || 0),
        speedRunBestS: Number(raw.speedRunBestS) > 0 ? Number(raw.speedRunBestS) : null,
        dailyDoneDate: raw.dailyDoneDate || '',
        dailyStreak: Math.max(0, Number(raw.dailyStreak) || 0),
        medals: Array.isArray(raw.medals) ? raw.medals : []
      };
    } catch {
      return { xp: 0, missionsCompleted: 0, streak: 0, bestStreak: 0, speedRunBestS: null, dailyDoneDate: '', dailyStreak: 0, medals: [] };
    }
  }

  function saveCareerMeta(m) {
    try { localStorage.setItem(CAREER_META_KEY, JSON.stringify(m)); } catch {}
  }

  function getSimMoney() {
    try {
      const c = JSON.parse(localStorage.getItem(SIM_CAREER_KEY) || 'null');
      if (c && typeof c.money === 'number') return Math.max(0, c.money);
      return Math.max(0, Number(localStorage.getItem('skybound.money')) || 0);
    } catch { return 0; }
  }

  function awardSimMoney(amount) {
    if (!amount || amount <= 0) return;
    try {
      const c = JSON.parse(localStorage.getItem(SIM_CAREER_KEY) || 'null') || { money: 0, active: null, receipts: {} };
      c.money = Math.max(0, Number(c.money) || 0) + Math.round(amount);
      localStorage.setItem(SIM_CAREER_KEY, JSON.stringify(c));
    } catch {}
  }

  function getRankInfo(xp) {
    let cur = RANKS[0];
    let next = RANKS[1] || null;
    for (let i = 0; i < RANKS.length; i++) {
      if (xp >= RANKS[i].minXp) {
        cur = RANKS[i];
        next = RANKS[i + 1] || null;
      }
    }
    const pct = next ? Math.min(100, Math.round(((xp - cur.minXp) / (next.minXp - cur.minXp)) * 100)) : 100;
    return { current: cur, next, pct };
  }

  function grantMedal(meta, medalId, newlyUnlocked) {
    if (!meta.medals.includes(medalId)) {
      meta.medals.push(medalId);
      const found = MEDALS.find(m => m.id === medalId);
      if (found) newlyUnlocked.push(found);
    }
  }

  function markChapterComplete(chId, stars = 3) {
    const prog = loadProgress();
    const prev = prog[chId]?.stars || 0;
    prog[chId] = { stars: Math.max(prev, stars), completedAt: Date.now() };
    saveProgress(prog);
  }

  function evaluateMissionStars(ch, st) {
    const won = true;
    const maxG = ch.maxSafeG || 4.0;
    const smooth = (st.maxG || 1) <= maxG && (st.warnings || 0) <= 1;
    const fast = st.elapsedS <= (ch.parTimeS || 120);
    const stars = 1 + (smooth ? 1 : 0) + (fast ? 1 : 0);
    return {
      stars,
      criteria: [
        { ok: won, label: '完成全部 3 階段飛行目標' },
        { ok: smooth, label: `平穩操縱（最大過載 ${(st.maxG || 1).toFixed(1)}G ≤ ${maxG}G · 警示 ${st.warnings || 0} 次）` },
        { ok: fast, label: `黃金時限內達成（${Math.round(st.elapsedS)}s / 目標 ${ch.parTimeS || 120}s）` }
      ]
    };
  }

  function buildDailyMission() {
    const date = todayStr();
    const seed = hashString('skybound-daily-' + date);
    const pool = [
      { aircraft: 'a223', acLabel: 'A220-300', dep: 'RCSS', dst: 'RCTP', weather: 'clouds', time: '06:40', theme: '晨間接駁突穿雲層' },
      { aircraft: 'sf16', acLabel: 'F-16V', dep: 'RCYU', dst: 'RCKH', weather: '0', time: '16:45', theme: '東部防空快速巡弋' },
      { aircraft: 'b38m', acLabel: '737 MAX 8', dep: 'RCTP', dst: 'RCKH', weather: 'storm', time: '18:10', theme: '暴風雨緊急疏運航線' },
      { aircraft: 'm2000', acLabel: 'Mirage 2000', dep: 'RCMQ', dst: 'RCSS', weather: 'clouds', time: '17:20', theme: '西部走廊高空巡檢' },
      { aircraft: 'sf748', acLabel: '747-8F', dep: 'RCTP', dst: 'RCKH', weather: 'wet', time: '21:50', theme: '深夜急件重載貨運' },
      { aircraft: 'c172s', acLabel: 'Cessna 172S', dep: 'RCSS', dst: 'RCYU', weather: '0', time: '07:15', theme: '低空觀光測繪任務' }
    ];
    const pick = pool[seed % pool.length];
    return {
      id: 101,
      isChallenge: true,
      challengeType: 'daily',
      code: 'DAILY',
      title: `今日緊急派遣 · ${pick.theme}`,
      subtitle: `${date} 每日任務 · 雙倍金幣 & XP`,
      image: `assets/campaign/ch${(seed % 7) + 1}.jpg`,
      aircraft: pick.aircraft,
      departure: pick.dep,
      destination: pick.dst,
      lesson: 'free',
      startType: 'runway',
      weather: pick.weather,
      time: pick.time,
      objectiveDistM: 4500,
      parTimeS: 105,
      rewardMoney: 16000,
      rewardXp: 420,
      maxSafeG: 5.5,
      targetText: `駕駛 ${pick.acLabel} 自 ${pick.dep} 起飛，爬升至 1,000+ ft 並完成 4.5 km 派遣航段`,
      radio: [
        { delay: 1.2, speaker: '派遣中心 · DAILY DISPATCH', text: `「今日任務（${date}）雙倍酬勞啟動！請駕駛 ${pick.acLabel} 自 ${pick.dep} 起飛！」` }
      ],
      stages: [
        {
          label: '階段 1/3 · 安全起飛離地 (> 400 ft)',
          check: f => !f.ended && !f.ground && f.y >= 122,
          radio: { speaker: '航管中心 · ATC', text: '「已離地！請穩定爬升至 1,000 ft 以上並持續推進航程。」' }
        },
        {
          label: '階段 2/3 · 爬升進入任務航層 (> 1,000 ft · 2.4 km)',
          check: (f, st) => !f.ended && f.y >= 305 && st.flownM >= 2400,
          radio: { speaker: '副駕駛 · COPILOT', text: '「航段過半，狀態絕佳！維持速度完成最後 2.1 km 即可領取雙倍報酬！」' }
        },
        {
          label: '階段 3/3 · 完成 4.5 km 今日緊急派遣',
          check: (f, st) => !f.ended && f.y >= 305 && st.flownM >= 4500
        }
      ],
      winCondition: (f, st) => !f.ended && f.y >= 305 && st.flownM >= 4500
    };
  }

  function buildChallengeMission(type) {
    if (type === 'daily') return buildDailyMission();
    if (type === 'speedrun') {
      return {
        id: 102,
        isChallenge: true,
        challengeType: 'speedrun',
        code: 'SPEED',
        title: '⚡ 低空峽谷極速衝刺',
        subtitle: '限高 2,800 ft 以下 · 刷新個人最快秒數紀錄',
        image: 'assets/campaign/ch4.jpg',
        aircraft: 'sf16',
        departure: 'RCYU',
        destination: 'RCKH',
        lesson: 'free',
        startType: 'runway',
        weather: '0',
        time: '16:50',
        objectiveDistM: 6000,
        parTimeS: 68,
        rewardMoney: 14000,
        rewardXp: 360,
        maxSafeG: 8.5,
        targetText: '全程壓低在 2,800 ft 以下極速衝刺 6.0 km！',
        radio: [
          { delay: 1.0, speaker: '競速計時官 · RACE CTRL', text: '「計時開始！F-16 全推力起飛，壓低高度 2,800 ft 以下全速衝完 6 公里！」' }
        ],
        stages: [
          {
            label: '階段 1/3 · 起飛加速突破 220 kt',
            check: f => !f.ended && !f.ground && Math.hypot(f.vx || 0, f.vz || 0) * 1.94384 >= 220,
            radio: { speaker: '競速計時官 · RACE CTRL', text: '「速度突破 220 kt！保持低空貼地飛行，切勿拉高超過 2,800 ft！」' }
          },
          {
            label: '階段 2/3 · 低空過半 3.2 km (高度 ≤ 2,800 ft)',
            check: (f, st) => !f.ended && f.y <= 855 && st.flownM >= 3200,
            radio: { speaker: '僚機 · WINGMAN', text: '「剩最後 2.8 公里！後燃器全開衝刺終點！」' }
          },
          {
            label: '階段 3/3 · 壓低 2,800 ft 以下衝線 6.0 km',
            check: (f, st) => !f.ended && !f.ground && f.y <= 855 && st.flownM >= 6000
          }
        ],
        winCondition: (f, st) => !f.ended && !f.ground && f.y <= 855 && st.flownM >= 6000
      };
    }
    if (type === 'storm_gauntlet') {
      return {
        id: 103,
        isChallenge: true,
        challengeType: 'storm_gauntlet',
        code: 'STORM',
        title: '🌪️ 暴風盲降連勝挑戰',
        subtitle: '強風暴雨考驗 · 安全破雲或落地累積連勝加成',
        image: 'assets/campaign/ch3.jpg',
        aircraft: 'b38m',
        departure: 'RCTP',
        destination: 'RCKH',
        lesson: 'free',
        startType: 'runway',
        weather: 'storm',
        time: '18:20',
        objectiveDistM: 5200,
        parTimeS: 115,
        rewardMoney: 13000,
        rewardXp: 350,
        maxSafeG: 3.5,
        targetText: '在暴雨閃電中穩定爬升穿雲 5.2 km 或安全落地（每連勝 +25% 獎勵）',
        radio: [
          { delay: 1.2, speaker: '防災中心 · STORM OPS', text: '「暴風連勝考驗啟動！雷雨胞風切極強，穩住 737 MAX 空速與仰角！」' }
        ],
        stages: [
          {
            label: '階段 1/3 · 頂風離地穩定姿態 (> 450 ft)',
            check: f => !f.ended && !f.ground && f.y >= 138,
            radio: { speaker: '副駕駛 · COPILOT', text: '「氣流劇烈震盪，請持續拉升至 1,400 ft 以上穿出厚雲層！」' }
          },
          {
            label: '階段 2/3 · 穿雲突破 1,400 ft (2.8 km)',
            check: (f, st) => !f.ended && f.y >= 425 && st.flownM >= 2800,
            radio: { speaker: '防災中心 · STORM OPS', text: '「順利破雲！保持穩定飛行完成 5.2 km 即可延長連勝紀錄！」' }
          },
          {
            label: '階段 3/3 · 完成 5.2 km 暴風突圍或安全落地',
            check: (f, st) => !f.ended && ((f.finished && f.landed) || (f.y >= 425 && st.flownM >= 5200))
          }
        ],
        winCondition: (f, st) => !f.ended && ((f.finished && f.landed) || (f.y >= 425 && st.flownM >= 5200))
      };
    }

    const acList = [
      { id: 'c172s', name: 'Cessna 172S', g: 3.5 },
      { id: 'a223', name: 'A220-300', g: 3.4 },
      { id: 'b38m', name: '737 MAX 8', g: 3.6 },
      { id: 'sf16', name: 'F-16V', g: 8.0 },
      { id: 'm2000', name: 'Mirage 2000', g: 8.5 },
      { id: 'sf748', name: '747-8F', g: 3.2 }
    ];
    const routes = [
      ['RCSS', 'RCTP', '台北—桃園'],
      ['RCYU', 'RCKH', '花蓮—高雄'],
      ['RCTP', 'RCKH', '桃園—高雄'],
      ['RCMQ', 'RCSS', '台中—台北'],
      ['RCKH', 'RCYU', '高雄—花蓮']
    ];
    const weathers = [
      { v: '0', label: '萬里晴空' },
      { v: 'clouds', label: '低雲層' },
      { v: 'storm', label: '雷雨強風' },
      { v: 'wet', label: '夜雨濕滑' }
    ];
    const times = ['06:10', '13:30', '17:45', '21:40'];
    const ac = acList[Math.floor(Math.random() * acList.length)];
    const rt = routes[Math.floor(Math.random() * routes.length)];
    const wt = weathers[Math.floor(Math.random() * weathers.length)];
    const tm = times[Math.floor(Math.random() * times.length)];
    const chImg = `assets/campaign/ch${Math.floor(Math.random() * 7) + 1}.jpg`;
    return {
      id: 104,
      isChallenge: true,
      challengeType: 'mystery',
      code: 'MYSTERY',
      title: `🎲 盲盒特勤 · ${rt[2]}（${wt.label}）`,
      subtitle: `隨機機型 ${ac.name} · 1.5× 驚喜獎勵`,
      image: chImg,
      aircraft: ac.id,
      departure: rt[0],
      destination: rt[1],
      lesson: 'free',
      startType: 'runway',
      weather: wt.v,
      time: tm,
      objectiveDistM: 4800,
      parTimeS: 110,
      rewardMoney: 15000,
      rewardXp: 380,
      maxSafeG: ac.g,
      targetText: `駕駛隨機抽出的 ${ac.name} 在「${wt.label}」條件下完成 4.8 km 航段`,
      radio: [
        { delay: 1.2, speaker: '隨機派遣中心 · MYSTERY OPS', text: `「盲盒任務抽中 ${ac.name}，航線 ${rt[2]}（${wt.label}）！祝飛行順利！」` }
      ],
      stages: [
        {
          label: '階段 1/3 · 起飛離地爬升 (> 450 ft)',
          check: f => !f.ended && !f.ground && f.y >= 138,
          radio: { speaker: '副駕駛 · COPILOT', text: '「機組狀態良好！請爬升至 1,000 ft 以上完成中段巡航。」' }
        },
        {
          label: '階段 2/3 · 中段航程 2.5 km (> 1,000 ft)',
          check: (f, st) => !f.ended && f.y >= 305 && st.flownM >= 2500,
          radio: { speaker: '區域管台 · CTR', text: '「表現優秀！最後 2.3 公里衝線即可領取 1.5× 盲盒大獎！」' }
        },
        {
          label: '階段 3/3 · 抵達 4.8 km 盲盒目標',
          check: (f, st) => !f.ended && f.y >= 305 && st.flownM >= 4800
        }
      ],
      winCondition: (f, st) => !f.ended && f.y >= 305 && st.flownM >= 4800
    };
  }

  function cloneOptionsHtml(sourceId) {
    const sel = document.getElementById(sourceId);
    if (!sel) return '';
    return [...sel.options].map(o => `<option value="${o.value}"${o.value === sel.value ? ' selected' : ''}>${o.textContent}</option>`).join('');
  }

  function ensureDOM() {
    if (document.getElementById('titleHub')) return;

    const plan = document.getElementById('plan');
    if (plan && !document.getElementById('plannerBackBar')) {
      const bar = document.createElement('div');
      bar.id = 'plannerBackBar';
      bar.className = 'planner-back-bar';
      bar.innerHTML = `<button type="button" id="backToHubBtn" class="hub-back-btn">← 返回統一主選單</button><span class="muted" style="font-size:12px">進階航線與載客貨運詳細規劃</span>`;
      plan.insertBefore(bar, plan.firstChild);
      bar.querySelector('#backToHubBtn').onclick = () => openHub('welcome');
    }

    const hub = document.createElement('div');
    hub.id = 'titleHub';
    hub.setAttribute('aria-label', '主選單');
    hub.innerHTML = `
      <aside class="hub-sidebar">
        <div>
          <div class="hub-brand">
            <span class="hub-kicker">SKYBOUND GLOBAL · v0.65</span>
            <h1 class="hub-title">蒼穹守望者</h1>
            <p class="hub-subtitle">Formosa Wings · 故事模式 · 線上連線 · 每日挑戰</p>
          </div>
          <div id="hubCareerCard" class="hub-career-card"></div>
          <ul class="hub-menu-list" role="tablist">
            <li><button type="button" class="hub-menu-btn" data-hub-tab="welcome"><div class="hub-menu-btn-main"><span>🏠 主首頁 · Home</span><span class="hub-menu-btn-sub">故事模式 · 線上模式 · 快速出動</span></div></button></li>
            <li><button type="button" class="hub-menu-btn" data-hub-tab="campaign"><div class="hub-menu-btn-main"><span>📖 故事模式 · Story Mode</span><span class="hub-menu-btn-sub">7 章臺灣航空劇情 · 插圖與三星評級</span></div><span class="hub-menu-badge">7 章</span></button></li>
            <li><button type="button" class="hub-menu-btn" data-hub-tab="multiplayer"><div class="hub-menu-btn-main"><span>🌐 線上模式 · Online</span><span class="hub-menu-btn-sub">即時房號編隊 · 多人空戰與無線電</span></div><span class="hub-menu-badge" id="hubMpSideBadge">大廳</span></button></li>
            <li><button type="button" class="hub-menu-btn" data-hub-tab="challenges"><div class="hub-menu-btn-main"><span>🏆 每日與無限挑戰</span><span class="hub-menu-btn-sub">雙倍派遣 · 低空競速 · 暴風連勝 · 盲盒</span></div><span class="hub-menu-badge">耐玩</span></button></li>
            <li><button type="button" class="hub-menu-btn" data-hub-tab="tactical"><div class="hub-menu-btn-main"><span>🎯 戰術特勤訓練</span><span class="hub-menu-btn-sub">航艦彈射 · 空中加油 · 雷暴進場</span></div></button></li>
            <li><button type="button" class="hub-menu-btn" data-hub-tab="freeflight"><div class="hub-menu-btn-main"><span>✈ 自由飛行</span><span class="hub-menu-btn-sub">機型 · 機場 · 天候 · 3D 機庫與塗裝</span></div></button></li>
            <li><button type="button" class="hub-menu-btn" data-hub-tab="scenery"><div class="hub-menu-btn-main"><span>🗺️ 地景巡覽與勳章</span><span class="hub-menu-btn-sub">101 夜景 · 車流高架 · 成就勳章牆</span></div></button></li>
            <li><button type="button" class="hub-menu-btn" data-hub-tab="settings"><div class="hub-menu-btn-main"><span>⚙ 遊戲設定</span><span class="hub-menu-btn-sub">畫質 · 操控靈敏度 · 音效 · 操作模式</span></div></button></li>
          </ul>
        </div>
        <div class="hub-sidebar-footer">
          <span>💡 撞擊建築物與塔台將觸發真實爆炸墜毀</span>
          <span>🎮 座艙視角 <b>C</b> · 視野 <b>N</b> · 輔助 <b>J</b></span>
        </div>
      </aside>
      <section class="hub-stage" id="hubStage"></section>
    `;
    document.body.appendChild(hub);

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
    debrief.innerHTML = `<div class="debrief-box"><img class="debrief-banner" id="storyDebriefImg" alt="任務圖卡"><div class="debrief-body"><h2 id="storyDebriefTitle"></h2><div id="storyDebriefStars" class="debrief-stars"></div><p id="storyDebriefText"></p><ul id="storyDebriefBreakdown" class="debrief-breakdown"></ul><div id="storyDebriefRewards" class="debrief-rewards"></div><div class="debrief-actions" id="storyDebriefActions"></div></div></div>`;
    document.body.appendChild(debrief);

    hub.addEventListener('click', e => {
      const tabBtn = e.target.closest('[data-hub-tab]');
      if (tabBtn) {
        renderStage(tabBtn.dataset.hubTab);
        return;
      }
      const chBtn = e.target.closest('[data-chapter-id]');
      if (chBtn) {
        selectedChapterId = Number(chBtn.dataset.chapterId);
        renderStage('campaign');
        return;
      }
      if (e.target.closest('#hubLaunchChapterBtn')) {
        startChapter(selectedChapterId);
        return;
      }
      const chalBtn = e.target.closest('[data-challenge-type]');
      if (chalBtn) {
        startChallenge(chalBtn.dataset.challengeType);
        return;
      }
      const quickBtn = e.target.closest('[data-hub-quick]');
      if (quickBtn) {
        const key = quickBtn.dataset.hubQuick;
        closeHub();
        document.querySelector(`#quickFlights [data-quick="${key}"]`)?.click();
        return;
      }
      const inspBtn = e.target.closest('[data-hub-inspect]');
      if (inspBtn) {
        const key = inspBtn.dataset.hubInspect;
        closeHub();
        const sel = document.getElementById('inspect');
        if (sel) sel.value = key;
        document.getElementById('viewScene')?.click();
        return;
      }
      const jumpTab = e.target.closest('[data-jump-tab]');
      if (jumpTab) {
        renderStage(jumpTab.dataset.jumpTab);
        return;
      }
      if (e.target.closest('#hubOpenHangarBtn')) {
        closeHub();
        document.getElementById('openHangar')?.click();
        return;
      }
      if (e.target.closest('#hubOpenAdvancedPlanBtn')) {
        closeHub();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      if (e.target.closest('#hubFreeFlyBtn')) {
        const map = [
          ['hubFfAircraft', 'aircraft'],
          ['hubFfDeparture', 'departure'],
          ['hubFfDestination', 'destination'],
          ['hubFfStartType', 'startType'],
          ['hubFfWeather', 'weather'],
          ['hubFfTime', 'time']
        ];
        for (const [hid, tid] of map) {
          const hEl = document.getElementById(hid);
          const tEl = document.getElementById(tid);
          if (hEl && tEl) tEl.value = hEl.value;
        }
        const les = document.getElementById('lesson');
        if (les) { les.value = 'free'; les.dispatchEvent(new Event('change')); }
        closeHub();
        document.getElementById('fly')?.click();
        return;
      }
      const mpChip = e.target.closest('[data-hub-room]');
      if (mpChip) {
        const r = mpChip.dataset.hubRoom;
        const inp = document.getElementById('hubMpRoom');
        if (inp) inp.value = r;
        const realInp = document.getElementById('mpRoomInput');
        if (realInp) realInp.value = r;
        hub.querySelectorAll('[data-hub-room]').forEach(b => b.classList.toggle('active', b.dataset.hubRoom === r));
        return;
      }
      if (e.target.closest('#hubMpJoinBtn') || e.target.closest('#hubMpLaunchBtn')) {
        const launchAfter = Boolean(e.target.closest('#hubMpLaunchBtn'));
        const hubRoom = document.getElementById('hubMpRoom')?.value?.trim() || '8888';
        const hubCall = document.getElementById('hubMpCallsign')?.value?.trim() || '';
        const realRoom = document.getElementById('mpRoomInput');
        const realCall = document.getElementById('mpCallsignInput');
        if (realRoom) realRoom.value = hubRoom;
        if (realCall && hubCall) realCall.value = hubCall;
        document.getElementById('mpJoinBtn')?.click();
        if (launchAfter) {
          closeHub();
          document.getElementById('fly')?.click();
        } else {
          setTimeout(() => renderStage('multiplayer'), 180);
        }
        return;
      }
      if (e.target.closest('#hubMpCustomBtn')) {
        document.getElementById('mpCustomRoomBtn')?.click();
        setTimeout(() => renderStage('multiplayer'), 180);
        return;
      }
      if (e.target.closest('#hubMpCopyBtn')) {
        document.getElementById('mpCopyUrlBtn')?.click();
        const fb = document.getElementById('hubMpFeedback');
        if (fb) fb.textContent = '已複製專屬房間邀請連結！';
        return;
      }
      if (e.target.closest('#hubMpLeaveBtn')) {
        document.getElementById('mpLeaveBtn')?.click();
        setTimeout(() => renderStage('multiplayer'), 180);
        return;
      }
      if (e.target.closest('#hubResetControlsBtn')) {
        document.getElementById('resetControls')?.click();
        setTimeout(() => renderStage('settings'), 60);
      }
    });

    const flyBtn = document.getElementById('fly');
    if (flyBtn) flyBtn.addEventListener('click', () => closeHub());
    const menuBtn = document.getElementById('menu');
    if (menuBtn) menuBtn.addEventListener('click', () => {
      activeMission = null;
      hideFlightStoryOverlays();
      clearTimeout(hubOpenTimer);
      hubOpenTimer = setTimeout(() => {
        if (!document.body.classList.contains('flight-ui')) openHub(activeTab || 'welcome');
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
      brandHeader.title = '回到首頁主選單';
      brandHeader.addEventListener('click', () => {
        if (!document.body.classList.contains('flight-ui')) openHub('welcome');
      });
    }
  }

  function renderCareerCard(prog, meta) {
    const card = document.getElementById('hubCareerCard');
    if (!card) return;
    const totalStars = CHAPTERS.reduce((s, c) => s + (prog[c.id]?.stars || 0), 0);
    const rank = getRankInfo(meta.xp);
    const money = getSimMoney();
    card.innerHTML = `
      <div class="hub-career-top">
        <span>${rank.current.badge} <strong>${rank.current.title}</strong></span>
        <span class="hub-career-money">$${money.toLocaleString()}</span>
      </div>
      <div class="hub-xp-bar"><div class="hub-xp-fill" style="width:${rank.pct}%"></div></div>
      <div class="hub-career-sub">
        <span>XP ${meta.xp}${rank.next ? ' / ' + rank.next.minXp : ' MAX'}</span>
        <span>★ ${totalStars}/21 · 🏅 ${meta.medals.length}/${MEDALS.length}</span>
      </div>
    `;
  }

  function bindSettingsControls() {
    const syncSelect = (hubId, targetId) => {
      const h = document.getElementById(hubId);
      const t = document.getElementById(targetId);
      if (!h || !t) return;
      h.value = t.value;
      h.onchange = () => {
        t.value = h.value;
        t.dispatchEvent(new Event('change', { bubbles: true }));
        if (typeof t.onchange === 'function') t.onchange();
      };
    };
    const syncRange = (hubId, outId, targetId, formatFn) => {
      const h = document.getElementById(hubId);
      const o = document.getElementById(outId);
      const t = document.getElementById(targetId);
      if (!h || !t) return;
      h.value = t.value;
      if (o) o.textContent = formatFn(h.value);
      h.oninput = () => {
        if (o) o.textContent = formatFn(h.value);
        t.value = h.value;
        t.dispatchEvent(new Event('input', { bubbles: true }));
        t.dispatchEvent(new Event('change', { bubbles: true }));
      };
    };
    const syncCheck = (hubId, targetId) => {
      const h = document.getElementById(hubId);
      const t = document.getElementById(targetId);
      if (!h || !t) return;
      h.checked = t.checked;
      h.onchange = () => {
        t.checked = h.checked;
        t.dispatchEvent(new Event('change', { bubbles: true }));
      };
    };

    syncSelect('hubSetQuality', 'quality');
    syncSelect('hubSetDevice', 'deviceMode');
    syncRange('hubSetVolume', 'hubSetVolumeVal', 'flightVolume', v => `${Math.round(Number(v))}%`);
    syncRange('hubSetSens', 'hubSetSensVal', 'sensitivity', v => `${Math.round(Number(v) * 100)}%`);
    syncRange('hubSetDeadzone', 'hubSetDeadVal', 'deadzone', v => `${Math.round(Number(v) * 100)}%`);
    syncCheck('hubSetInvert', 'invert');
    syncCheck('hubSetKeepBank', 'keepBank');
    syncCheck('hubSetMouse', 'mouse');
    syncCheck('hubSetRt', 'rtLighting');
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
    const meta = loadCareerMeta();
    renderCareerCard(prog, meta);
    const completedCount = Object.keys(prog).length;
    const totalStars = CHAPTERS.reduce((s, c) => s + (prog[c.id]?.stars || 0), 0);
    const rank = getRankInfo(meta.xp);
    const money = getSimMoney();
    const mpStatusEl = document.getElementById('mpStatusText');
    const mpBadgeSide = document.getElementById('hubMpSideBadge');
    if (mpBadgeSide && mpStatusEl) mpBadgeSide.textContent = mpStatusEl.textContent || '大廳';

    if (tab === 'welcome') {
      const nextChId = Math.min(7, Math.max(1, completedCount + 1));
      const nextCh = CHAPTERS.find(c => c.id === nextChId) || CHAPTERS[0];
      const dailyDone = meta.dailyDoneDate === todayStr();
      stage.innerHTML = `
        <div class="hub-home-wrap">
          <div class="hub-hero-showcase">
            <img class="hub-hero-bg" src="${nextCh.image}" alt="${nextCh.title}">
            <div class="hub-hero-overlay">
              <span class="hub-kicker">SKYBOUND GLOBAL · TAIWAN AVIATION</span>
              <h2>選好模式，立即升空</h2>
              <p>${rank.current.badge} ${rank.current.title} · 戰役 ${completedCount}/7 章（★ ${totalStars}/21）· 資金 $${money.toLocaleString()}</p>
            </div>
          </div>

          <div class="hub-primary-modes">
            <button type="button" class="hub-art-mode-card featured" data-jump-tab="campaign">
              <img src="assets/campaign/ch1.jpg" alt="故事模式">
              <div class="hub-art-mode-body">
                <span class="hub-mode-pill gold">📖 故事模式 · 7 大章節</span>
                <h3>蒼穹守望者 · 劇情戰役</h3>
                <p>三階段任務目標、無線電劇情對話與三星評等，賺取機庫購機賞金（下一關：${nextCh.code}）</p>
              </div>
            </button>
            <button type="button" class="hub-art-mode-card featured" data-jump-tab="multiplayer">
              <img src="assets/campaign/ch6.jpg" alt="線上模式">
              <div class="hub-art-mode-body">
                <span class="hub-mode-pill cyan">🌐 線上模式 · ${mpStatusEl ? mpStatusEl.textContent : '多人大廳'}</span>
                <h3>全台即時連線 · 編隊空戰</h3>
                <p>加入公共大廳 8888 或自建專屬房號，與好友同空域編隊巡航、無線電通話與實彈對決</p>
              </div>
            </button>
          </div>

          <div class="hub-secondary-modes">
            <button type="button" class="hub-mini-art-card" data-jump-tab="challenges">
              <img src="assets/campaign/ch4.jpg" alt="每日任務與挑戰">
              <div>
                <span class="hub-action-pill">${dailyDone ? '✓ 今日已完成' : '🔥 2× 今日雙倍'}</span>
                <strong>🏆 每日與無限挑戰</strong>
                <small>極速衝刺 · 暴風連勝 · 盲盒</small>
              </div>
            </button>
            <button type="button" class="hub-mini-art-card" data-jump-tab="tactical">
              <img src="assets/campaign/ch3.jpg" alt="戰術特勤">
              <div>
                <span class="hub-action-pill">8 種特勤</span>
                <strong>🎯 戰術特勤訓練</strong>
                <small>航艦彈射 · KC-135 加油</small>
              </div>
            </button>
            <button type="button" class="hub-mini-art-card" data-jump-tab="freeflight">
              <img src="assets/campaign/ch2.jpg" alt="自由飛行">
              <div>
                <span class="hub-action-pill">自訂航線</span>
                <strong>✈ 自由飛行與 3D 機庫</strong>
                <small>自選機場 · 天候 · 機型塗裝</small>
              </div>
            </button>
            <button type="button" class="hub-mini-art-card" data-jump-tab="settings">
              <img src="assets/campaign/ch7.jpg" alt="設定">
              <div>
                <span class="hub-action-pill">畫質 / 手感</span>
                <strong>⚙ 畫質與操控設定</strong>
                <small>解析度 · 靈敏度 · 反鋸齒</small>
              </div>
            </button>
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
              <h2>📖 故事模式 · Formosa Wings（${completedCount}/7 章 · ★ ${totalStars}/21）</h2>
              <p>每章包含三階段任務目標、即時無線電劇情與三星評等，通關直接入帳機庫金幣</p>
            </div>
          </div>
          <div class="campaign-layout">
            <article class="campaign-feature">
              <div class="campaign-art-wrap">
                <img src="${ch.image}" alt="${ch.title}">
                <div class="campaign-art-overlay">
                  <span class="campaign-ch-tag">${ch.code} · ${ch.subtitle}</span>
                  <span class="campaign-stars">${chStars ? '最高紀錄 ' + '★'.repeat(chStars) + '☆'.repeat(3 - chStars) : '尚未出動'}</span>
                </div>
              </div>
              <div class="campaign-feature-body">
                <h3>${ch.title}</h3>
                <p class="campaign-story-copy">${ch.story}</p>
                <div class="campaign-meta-chips">
                  <span class="campaign-chip">✈ 機型：${ch.aircraft.toUpperCase()}</span>
                  <span class="campaign-chip">🛫 航點：${ch.departure} → ${ch.destination}</span>
                  <span class="campaign-chip">⏱ 黃金時間：${ch.parTimeS}s</span>
                  <span class="campaign-chip">💰 報酬：+$${ch.rewardMoney.toLocaleString()} · +${ch.rewardXp} XP</span>
                  <span class="campaign-chip">🎯 ${ch.targetText}</span>
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

    if (tab === 'multiplayer') {
      const curRoom = document.getElementById('mpRoomInput')?.value || '8888';
      const curCall = document.getElementById('mpCallsignInput')?.value || '';
      const curStatus = document.getElementById('mpStatusText')?.textContent || '未連線';
      const curFeedback = document.getElementById('mpFeedbackMsg')?.textContent || '';
      const presetRooms = [
        ['8888', '8888 公共大廳'],
        ['DOGFIGHT', 'DOGFIGHT 空戰'],
        ['CARRIER', 'CARRIER 航艦'],
        ['REFUEL', 'REFUEL 加油'],
        ['RCSS-01', 'RCSS-01 松山'],
        ['RCTP-HEAVY', 'RCTP-HEAVY 桃園']
      ].map(([r, label]) => `<button type="button" class="mp-chip${curRoom === r ? ' active' : ''}" data-hub-room="${r}">${label}</button>`).join('');

      stage.innerHTML = `
        <div class="hub-section-panel">
          <div class="hub-online-banner">
            <img src="assets/campaign/ch6.jpg" alt="線上多人連線">
            <div class="hub-online-banner-body">
              <span class="hub-mode-pill cyan">🌐 ONLINE MULTIPLAYER · ${curStatus}</span>
              <h2>線上模式 · 多人即時連線大廳</h2>
              <p>加入公共頻道或開立專屬房號，與其他玩家在全台 3D 實景空域編隊、空戰與無線電通報</p>
            </div>
          </div>
          <div class="hub-panel-card">
            <div style="margin-bottom:10px">
              <small style="color:#9ec4dc;display:block;margin-bottom:6px">🔥 快速選擇分流房間：</small>
              <div class="mp-room-chips">${presetRooms}</div>
            </div>
            <div class="hub-form-grid">
              <label>房間號 (Room ID)<input type="text" id="hubMpRoom" value="${curRoom}" placeholder="例如 8888 或 TAIPEI"></label>
              <label>機長呼號 (Callsign)<input type="text" id="hubMpCallsign" value="${curCall}" placeholder="例如 CAL001 或 VIPER"></label>
            </div>
            <div class="actions" style="margin-top:12px">
              <button type="button" id="hubMpLaunchBtn" class="campaign-launch-btn">🚀 連線房間並立即起飛 →</button>
              <button type="button" id="hubMpJoinBtn" class="hub-back-btn">僅加入房間</button>
              <button type="button" id="hubMpCustomBtn" class="hub-back-btn">✨ 自建隨機房號</button>
              <button type="button" id="hubMpCopyBtn" class="hub-back-btn">🔗 複製邀請連結</button>
              ${curStatus !== '未連線' ? '<button type="button" id="hubMpLeaveBtn" class="hub-back-btn">退出房間</button>' : ''}
            </div>
            <p id="hubMpFeedback" style="font-size:12.5px;color:#7affbe;margin:8px 0 0;min-height:18px">${curFeedback}</p>
          </div>
        </div>`;
      return;
    }

    if (tab === 'challenges') {
      const daily = buildDailyMission();
      const dailyDone = meta.dailyDoneDate === todayStr();
      const speedRec = meta.speedRunBestS ? `${meta.speedRunBestS.toFixed(1)} 秒` : '尚無紀錄';
      stage.innerHTML = `
        <div class="hub-section-panel">
          <div class="hub-section-head">
            <div>
              <h2>🏆 每日任務與無限耐玩模式</h2>
              <p>每天輪替雙倍獎勵派遣、突破秒數極限的低空競速、連勝暴風盲降與隨機盲盒特勤</p>
            </div>
          </div>
          <div class="hub-art-cards-grid">
            <button type="button" class="hub-art-action-card" data-challenge-type="daily">
              <img src="${daily.image}" alt="${daily.title}">
              <div>
                <span class="hub-action-pill">${dailyDone ? '✓ 今日已完成' : '🔥 2× 雙倍獎勵'}</span>
                <strong>${daily.title}</strong>
                <small>${daily.targetText}（連續打卡 ${meta.dailyStreak} 天）</small>
              </div>
            </button>
            <button type="button" class="hub-art-action-card" data-challenge-type="speedrun">
              <img src="assets/campaign/ch4.jpg" alt="低空峽谷極速衝刺">
              <div>
                <span class="hub-action-pill">⏱ 最佳紀錄：${speedRec}</span>
                <strong>⚡ 低空峽谷極速衝刺</strong>
                <small>駕駛 F-16V 壓在 2,800 ft 以下極速衝完 6.0 km，挑戰刷新最快秒數！</small>
              </div>
            </button>
            <button type="button" class="hub-art-action-card" data-challenge-type="storm_gauntlet">
              <img src="assets/campaign/ch3.jpg" alt="暴風盲降連勝挑戰">
              <div>
                <span class="hub-action-pill">🔥 連勝：${meta.streak}（最高 ${meta.bestStreak}）</span>
                <strong>🌪️ 暴風盲降連勝挑戰</strong>
                <small>737 MAX 頂著雷雨風切突破 5.2 km 或落地，每多 1 連勝獎金 +25%！</small>
              </div>
            </button>
            <button type="button" class="hub-art-action-card" data-challenge-type="mystery">
              <img src="assets/campaign/ch7.jpg" alt="隨機盲盒特勤">
              <div>
                <span class="hub-action-pill">🎲 1.5× 驚喜獎金</span>
                <strong>🎲 隨機盲盒特勤派遣</strong>
                <small>每次點擊隨機抽出機型、全台航線、天氣與時刻，每次都是新任務！</small>
              </div>
            </button>
          </div>
        </div>`;
      return;
    }

    if (tab === 'tactical') {
      const cards = TACTICAL_CARDS.map(c => `
        <button type="button" class="hub-art-action-card" data-hub-quick="${c.quick}">
          <img src="${c.image}" alt="${c.title}">
          <div>
            <span class="hub-action-pill">${c.tag}</span>
            <strong>${c.title}</strong>
            <small>${c.desc}</small>
          </div>
        </button>`).join('');
      stage.innerHTML = `
        <div class="hub-section-panel">
          <div class="hub-section-head">
            <div><h2>🎯 戰術特勤與高難度訓練</h2><p>點選任一特勤情境即刻載入機位與實戰設定起飛</p></div>
          </div>
          <div class="hub-art-cards-grid">${cards}</div>
        </div>`;
      return;
    }

    if (tab === 'freeflight') {
      stage.innerHTML = `
        <div class="hub-section-panel">
          <div class="hub-online-banner">
            <img src="assets/campaign/ch2.jpg" alt="自由飛行與 3D 機庫">
            <div class="hub-online-banner-body">
              <span class="hub-mode-pill gold">✈ FREE FLIGHT & 3D HANGAR</span>
              <h2>自由飛行與 3D 機庫</h2>
              <p>直接在統一選單內配置機型、起降機場、天候與時刻，或進入 3D 機庫買機賞機</p>
            </div>
          </div>
          <div class="hub-panel-card">
            <div class="hub-form-grid">
              <label>執飛機型<select id="hubFfAircraft">${cloneOptionsHtml('aircraft')}</select></label>
              <label>起始狀態<select id="hubFfStartType">${cloneOptionsHtml('startType')}</select></label>
              <label>出發機場<select id="hubFfDeparture">${cloneOptionsHtml('departure')}</select></label>
              <label>目的機場<select id="hubFfDestination">${cloneOptionsHtml('destination')}</select></label>
              <label>天候環境<select id="hubFfWeather">${cloneOptionsHtml('weather')}</select></label>
              <label>當地時刻<input type="time" id="hubFfTime" value="${document.getElementById('time')?.value || '13:00'}"></label>
            </div>
            <div class="actions" style="margin-top:14px">
              <button type="button" id="hubFreeFlyBtn" class="campaign-launch-btn">✈ 立即起飛 →</button>
              <button type="button" id="hubOpenHangarBtn" class="hub-back-btn">🏛️ 開啟 3D 機庫與塗裝工坊</button>
              <button type="button" id="hubOpenAdvancedPlanBtn" class="hub-back-btn">📋 進階載客／貨運／航點編輯</button>
            </div>
          </div>
        </div>`;
      return;
    }

    if (tab === 'scenery') {
      const cards = SCENERY_CARDS.map(c => `
        <button type="button" class="hub-art-action-card" data-hub-inspect="${c.inspect}">
          <img src="${c.image}" alt="${c.title}">
          <div>
            <span class="hub-action-pill">${c.tag}</span>
            <strong>${c.title}</strong>
            <small>${c.desc}</small>
          </div>
        </button>`).join('');
      const medalsHtml = MEDALS.map(m => {
        const unlocked = meta.medals.includes(m.id);
        return `<div class="medal-badge${unlocked ? ' unlocked' : ''}" title="${m.desc}"><span>${m.icon}</span><div><strong>${m.name}</strong><small>${unlocked ? '已獲得' : m.desc}</small></div></div>`;
      }).join('');
      const logHtml = document.getElementById('log')?.innerHTML || '<p class="muted">尚無飛行紀錄</p>';
      stage.innerHTML = `
        <div class="hub-section-panel">
          <div class="hub-section-head">
            <div><h2>🗺️ 全台高精細地景巡覽與勳章牆</h2><p>一鍵前往信義 101 摩天樓群、桃園松山機場，並查看已收集的航空成就勳章</p></div>
          </div>
          <div class="hub-art-cards-grid">${cards}</div>
          <div class="medals-panel">
            <strong style="font-size:13px;color:#ffd976">🏅 航空成就勳章（${meta.medals.length}/${MEDALS.length}）</strong>
            <div class="medals-grid">${medalsHtml}</div>
          </div>
          <div style="background:rgba(9,23,36,0.85);border:1px solid rgba(140,200,235,0.22);border-radius:14px;padding:12px 16px;max-height:150px;overflow:auto;">
            <strong style="font-size:13px;color:#ffd976">近期飛行日誌</strong>
            <div style="margin-top:6px;font-size:12px;color:#cde4f2">${logHtml}</div>
          </div>
        </div>`;
      return;
    }

    if (tab === 'settings') {
      const hasRt = Boolean(document.getElementById('rtLighting'));
      stage.innerHTML = `
        <div class="hub-section-panel">
          <div class="hub-section-head">
            <div><h2>⚙ 遊戲設定 · 畫質與操控</h2><p>所有設定會即時生效並自動儲存在目前瀏覽器，電腦版與手機版皆可調整</p></div>
          </div>
          <div class="hub-settings-grid">
            <div class="hub-panel-card">
              <h3>🎨 畫面品質與裝置模式</h3>
              <div class="hub-settings-list">
                <label>渲染畫質（建議「均衡」或「高」）<select id="hubSetQuality">${cloneOptionsHtml('quality')}</select></label>
                <label>操作介面模式<select id="hubSetDevice">${cloneOptionsHtml('deviceMode')}</select></label>
                ${hasRt ? '<label class="hub-check-row"><input type="checkbox" id="hubSetRt"> <span>啟用光追光影與體積光效果</span></label>' : ''}
                <label>主音量 <b id="hubSetVolumeVal">85%</b><input type="range" id="hubSetVolume" min="0" max="100" step="1"></label>
              </div>
            </div>
            <div class="hub-panel-card">
              <h3>🕹️ 飛行操控與靈敏度</h3>
              <div class="hub-settings-list">
                <label>操控靈敏度 <b id="hubSetSensVal">55%</b><input type="range" id="hubSetSens" min="0.2" max="1" step="0.05"></label>
                <label>搖桿／手把死區 <b id="hubSetDeadVal">12%</b><input type="range" id="hubSetDeadzone" min="0" max="0.35" step="0.01"></label>
                <label class="hub-check-row"><input type="checkbox" id="hubSetInvert"> <span>反轉上下／俯仰軸向</span></label>
                <label class="hub-check-row"><input type="checkbox" id="hubSetKeepBank"> <span>放開操控後維持目前傾斜角</span></label>
                <label class="hub-check-row"><input type="checkbox" id="hubSetMouse"> <span>電腦版按住畫面拖曳操控</span></label>
              </div>
              <div class="actions" style="margin-top:12px">
                <button type="button" id="hubResetControlsBtn" class="hub-back-btn">↺ 恢復平順預設值</button>
              </div>
            </div>
          </div>
        </div>`;
      bindSettingsControls();
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

  function showRadio(speaker, text, durationMs = 7000) {
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

  function settleWinRewards(ch, st) {
    const meta = loadCareerMeta();
    const evalRes = evaluateMissionStars(ch, st);
    const newlyUnlocked = [];
    let moneyEarned = ch.rewardMoney || 6000;
    let xpEarned = ch.rewardXp || 200;

    if (!ch.isChallenge) {
      const prevStars = loadProgress()[ch.id]?.stars || 0;
      if (prevStars === 0) {
        moneyEarned = Math.round(moneyEarned * 1.5);
        xpEarned = Math.round(xpEarned * 1.4);
      }
      markChapterComplete(ch.id, evalRes.stars);
      if (evalRes.stars === 3) grantMedal(meta, 'perfectionist', newlyUnlocked);
      const chapterMedals = { 2: 'skyline_ace', 3: 'storm_breaker', 4: 'carrier_hawk', 5: 'fuel_master', 6: 'sky_guardian' };
      if (chapterMedals[ch.id]) grantMedal(meta, chapterMedals[ch.id], newlyUnlocked);
      const progAfter = loadProgress();
      if (CHAPTERS.every(c => (progAfter[c.id]?.stars || 0) >= 1)) {
        grantMedal(meta, 'campaign_hero', newlyUnlocked);
      }
    } else {
      if (ch.challengeType === 'daily') {
        const today = todayStr();
        if (meta.dailyDoneDate !== today) {
          moneyEarned *= 2;
          xpEarned *= 2;
          meta.dailyDoneDate = today;
          meta.dailyStreak += 1;
        }
        grantMedal(meta, 'daily_pilot', newlyUnlocked);
      } else if (ch.challengeType === 'speedrun') {
        if (!meta.speedRunBestS || st.elapsedS < meta.speedRunBestS) {
          meta.speedRunBestS = Number(st.elapsedS.toFixed(1));
        }
        grantMedal(meta, 'speed_demon', newlyUnlocked);
      } else if (ch.challengeType === 'storm_gauntlet') {
        meta.streak += 1;
        meta.bestStreak = Math.max(meta.bestStreak, meta.streak);
        const mult = 1 + Math.min(2, (meta.streak - 1) * 0.25);
        moneyEarned = Math.round(moneyEarned * mult);
        xpEarned = Math.round(xpEarned * mult);
      } else if (ch.challengeType === 'mystery') {
        moneyEarned = Math.round(moneyEarned * 1.5);
        xpEarned = Math.round(xpEarned * 1.5);
      }
    }

    const oldRank = getRankInfo(meta.xp).current.title;
    meta.xp += xpEarned;
    meta.missionsCompleted += 1;
    grantMedal(meta, 'first_wings', newlyUnlocked);
    saveCareerMeta(meta);
    awardSimMoney(moneyEarned);
    const newRank = getRankInfo(meta.xp).current.title;

    return {
      ...evalRes,
      moneyEarned,
      xpEarned,
      rankUp: newRank !== oldRank ? newRank : null,
      newlyUnlocked,
      meta
    };
  }

  function showDebrief(ch, won, reason, rewardInfo) {
    const modal = document.getElementById('storyDebrief');
    const img = document.getElementById('storyDebriefImg');
    const title = document.getElementById('storyDebriefTitle');
    const starsEl = document.getElementById('storyDebriefStars');
    const text = document.getElementById('storyDebriefText');
    const breakdownEl = document.getElementById('storyDebriefBreakdown');
    const rewardsEl = document.getElementById('storyDebriefRewards');
    const actions = document.getElementById('storyDebriefActions');
    if (!modal || !img || !title || !text || !actions) return;

    img.src = ch.image;
    title.textContent = won ? `★ ${ch.code} · 任務圓滿達成！` : `💥 ${ch.code} · 任務中斷墜毀`;
    title.style.color = won ? '#ffd976' : '#ff6b6b';

    if (starsEl) {
      starsEl.innerHTML = won && rewardInfo
        ? '★'.repeat(rewardInfo.stars) + '<span style="opacity:.35">' + '★'.repeat(3 - rewardInfo.stars) + '</span>'
        : '';
    }

    text.textContent = reason || (won ? `成功通過 ${ch.title}！獎勵已匯入機庫帳戶。` : '發生碰撞或迫降失事，請重整態勢再次挑戰本關！');

    if (breakdownEl) {
      breakdownEl.innerHTML = won && rewardInfo
        ? rewardInfo.criteria.map(c => `<li class="${c.ok ? 'ok' : ''}">${c.ok ? '✓' : '○'} ${c.label}</li>`).join('')
        : '';
    }

    if (rewardsEl) {
      if (won && rewardInfo) {
        const medalChips = rewardInfo.newlyUnlocked.map(m => `<span class="reward-chip medal">🏅 新勳章：${m.name}</span>`).join('');
        const rankChip = rewardInfo.rankUp ? `<span class="reward-chip rank">🎖 晉升軍階：${rewardInfo.rankUp}</span>` : '';
        rewardsEl.innerHTML = `
          <span class="reward-chip">💰 +$${rewardInfo.moneyEarned.toLocaleString()}</span>
          <span class="reward-chip">⭐ +${rewardInfo.xpEarned} XP</span>
          ${rankChip}${medalChips}`;
      } else {
        rewardsEl.innerHTML = '';
      }
    }

    actions.innerHTML = '';

    if (won && !ch.isChallenge && ch.id < CHAPTERS.length) {
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
    retryBtn.textContent = ch.challengeType === 'mystery' ? '🎲 再抽下一抽盲盒' : '🔄 重新挑戰本關卡';
    retryBtn.onclick = () => {
      modal.hidden = true;
      document.getElementById('menu')?.click();
      setTimeout(() => ch.isChallenge ? startChallenge(ch.challengeType) : startChapter(ch.id), 160);
    };
    actions.appendChild(retryBtn);

    const hubBtn = document.createElement('button');
    hubBtn.type = 'button';
    hubBtn.className = 'hub-back-btn';
    hubBtn.textContent = ch.isChallenge ? '回到挑戰模式' : '回到主選單';
    hubBtn.onclick = () => {
      modal.hidden = true;
      document.getElementById('menu')?.click();
      setTimeout(() => openHub(ch.isChallenge ? 'challenges' : 'campaign'), 120);
    };
    actions.appendChild(hubBtn);

    modal.hidden = false;
  }

  function launchMission(ch) {
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
      maxG: 1,
      warnings: 0,
      warnCooldownUntil: 0,
      stageIdx: 0,
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
      const firstLabel = ch.stages?.[0]?.label || ch.targetText;
      objHud.textContent = `${ch.code} · ${firstLabel}`;
      objHud.hidden = false;
    }
  }

  function startChapter(chapterId) {
    const ch = CHAPTERS.find(c => c.id === chapterId) || CHAPTERS[0];
    selectedChapterId = ch.id;
    launchMission(ch);
  }

  function startChallenge(type) {
    const ch = buildChallengeMission(type);
    launchMission(ch);
  }

  setInterval(() => {
    if (!activeMission || activeMission.settled) return;
    const f = globalScope.__skyboundFlight;
    if (!f) return;
    const now = performance.now();
    const elapsedS = (now - activeMission.startedAt) / 1000;
    if (activeMission.lastX != null) {
      activeMission.flownM += Math.hypot(f.x - activeMission.lastX, f.z - activeMission.lastZ);
    }
    activeMission.lastX = f.x;
    activeMission.lastZ = f.z;
    if (typeof f.g === 'number') activeMission.maxG = Math.max(activeMission.maxG, Math.abs(f.g));

    const ch = activeMission.ch;
    for (let i = 0; i < (ch.radio?.length || 0); i++) {
      const line = ch.radio[i];
      if (!activeMission.triggeredRadio.has(i) && elapsedS >= line.delay) {
        activeMission.triggeredRadio.add(i);
        showRadio(line.speaker, line.text);
      }
    }

    if (ch.challengeType === 'speedrun' && !f.ground && f.y > 855 && now > activeMission.warnCooldownUntil) {
      activeMission.warnings += 1;
      activeMission.warnCooldownUntil = now + 4000;
      showRadio('競速警報 · ALT LIMIT', '「高度超過 2,800 ft 上限！請壓低機鼻回到低空衝刺區！」', 4000);
    }

    const st = {
      flownM: activeMission.flownM,
      elapsedS,
      maxG: activeMission.maxG,
      warnings: activeMission.warnings
    };

    const stages = ch.stages || [];
    while (activeMission.stageIdx < stages.length && stages[activeMission.stageIdx].check(f, st)) {
      const completedStage = stages[activeMission.stageIdx];
      activeMission.stageIdx += 1;
      if (completedStage.radio) {
        showRadio(completedStage.radio.speaker, completedStage.radio.text, 6500);
      }
    }

    const objHud = document.getElementById('storyObjectiveHud');
    if (objHud && ch.objectiveDistM) {
      const pct = Math.min(100, Math.round((activeMission.flownM / ch.objectiveDistM) * 100));
      const altFt = Math.max(0, Math.round((f.y || 0) * 3.28084));
      const curStage = stages[Math.min(activeMission.stageIdx, Math.max(0, stages.length - 1))];
      const stagePrefix = curStage ? curStage.label : ch.title;
      objHud.textContent = `${ch.code} · ${stagePrefix} (${pct}% · ${altFt} ft)`;
    }

    if (f.ended && !activeMission.settled) {
      activeMission.settled = true;
      if (ch.challengeType === 'storm_gauntlet') {
        const meta = loadCareerMeta();
        meta.streak = 0;
        saveCareerMeta(meta);
      }
      const reason = f.crashedBuilding
        ? '飛機直接撞上台北高樓建築物引發猛烈爆炸！請拉高巡航高度並謹慎操控航線。'
        : '落地或迫降速度過重造成失事墜毀，請重新調整下滑角再次起飛。';
      setTimeout(() => {
        if (activeMission?.ch === ch) showDebrief(ch, false, reason, null);
      }, 4200);
      return;
    }

    const allStagesDone = stages.length > 0 ? activeMission.stageIdx >= stages.length : true;
    if ((allStagesDone || ch.winCondition(f, st)) && !activeMission.settled) {
      activeMission.settled = true;
      const rewardInfo = settleWinRewards(ch, st);
      if (objHud) objHud.textContent = `✓ ${ch.code} 任務達成！(${'★'.repeat(rewardInfo.stars)})`;
      showRadio('戰情中心 · MISSION CONTROL', `「漂亮！${ch.code}『${ch.title}』獲得 ${rewardInfo.stars}★，賞金 +$${rewardInfo.moneyEarned.toLocaleString()}！」`, 6500);
      setTimeout(() => {
        if (activeMission?.ch === ch) showDebrief(ch, true, null, rewardInfo);
      }, 2600);
    }
  }, 250);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => openHub('welcome'));
  } else {
    openHub('welcome');
  }

  globalScope.SkyboundCampaign = {
    chapters: CHAPTERS,
    medals: MEDALS,
    openHub,
    closeHub,
    selectTab: renderStage,
    startChapter,
    startChallenge,
    getProgress: loadProgress,
    getCareerStats: loadCareerMeta
  };
})(typeof window !== 'undefined' ? window : globalThis);
