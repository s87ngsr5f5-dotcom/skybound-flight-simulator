// flight-recorder.js - SKYBOUND GLOBAL Flight Data Recorder (FDR) & Debriefing Analysis
(function(root){
  'use strict';

  function createFlightRecorder(){
    const maxSamples = 1200; // ~3-4 minutes at 5Hz
    let samples = [];
    let sampleTimer = 0;
    const sampleRate = 0.18; // sample every 180ms
    let maxG = 1.0;
    let minG = 1.0;

    function reset(){
      samples = [];
      sampleTimer = 0;
      maxG = 1.0;
      minG = 1.0;
    }

    // Record telemetry sample
    function step(f, dt){
      if(!f) return;
      sampleTimer += dt;
      if(sampleTimer < sampleRate) return;
      sampleTimer = 0;

      const altM = Math.max(0, f.y - (typeof regionalHeight === 'function' ? regionalHeight(f.x, f.z) : 0));
      const altFt = Math.round(altM * 3.28084);
      const speeds = typeof flightSpeeds === 'function' ? flightSpeeds(f) : { ias: f.speed, tas: f.speed };
      const iasKt = Math.round(speeds.ias * 1.94384);
      const vsiFpm = Math.round(f.vy * 196.85);
      const pitchDeg = Math.round((f.pitch || 0) * (180 / Math.PI) * 10) / 10;
      const bankDeg = Math.round((f.bank || 0) * (180 / Math.PI) * 10) / 10;

      // Normal load factor estimate: 1 / cos(bank) + pitch rate pull
      const gRoll = Math.abs(f.bank) < 1.4 ? 1 / Math.cos(f.bank) : 1.0;
      const gPull = f.speed > 5 ? (f.pitchRate || 0) * f.speed / 9.80665 : 0;
      const gVal = f.ground ? 1.0 : Math.round(Math.max(-2, Math.min(9.5, gRoll + gPull)) * 100) / 100;

      maxG = Math.max(maxG, gVal);
      minG = Math.min(minG, gVal);

      let crossM = 0;
      if(f.destination && typeof runwayCoordinates === 'function'){
        const rc = runwayCoordinates(f.x, f.z, f.destination);
        crossM = Math.round(rc.cross * 10) / 10;
      }

      samples.push({
        t: Math.round(f.elapsed * 10) / 10,
        altM: Math.round(altM * 10) / 10,
        altFt,
        ias: iasKt,
        vsi: vsiFpm,
        pitch: pitchDeg,
        bank: bankDeg,
        g: gVal,
        power: Math.round((f.power || 0) * 100),
        flaps: f.flaps || 0,
        cross: crossM,
        gear: f.gear ? 1 : 0,
        ground: f.ground ? 1 : 0
      });

      if(samples.length > maxSamples){
        samples.shift();
      }
    }

    // Evaluate touchdown performance
    function evaluateLanding(touchdown, ended){
      if(!touchdown) return null;
      const vsi = Math.round(-touchdown.verticalSpeed * 196.85); // positive downward ft/min
      const cross = Math.abs(touchdown.cross || 0);
      const speedKt = Math.round(touchdown.speed * 1.94384);
      const pitchDeg = touchdown.pitch !== undefined ? (touchdown.pitch * 180 / Math.PI).toFixed(1) : '+3.5';
      const gearTravel = 0.45;
      const impactG = (1 + Math.pow(Math.max(0, -touchdown.verticalSpeed), 2) / (2 * 9.80665 * gearTravel)).toFixed(2);
      const alongM = Math.round(touchdown.along || 0);

      let grade = '', stars = '', desc = '', color = '', butter = false;
      if(ended || vsi >= 560){
        grade = '💥 HARD LANDING · 重著陸';
        stars = '★☆☆☆☆';
        desc = '觸地衝擊過大或偏出跑道！已觸發黑盒子過載記錄與機務特檢。';
        color = '#ff6b6b';
      } else if(vsi < 110 && cross < 4.2 && Number(impactG) < 1.25){
        grade = '🧈 BUTTER LANDING · 黃金牛油';
        stars = '★★★★★';
        desc = '極致羽毛般輕柔觸地！氣動拉平完美無瑕，主輪無感貼地。';
        color = '#ffd43b';
        butter = true;
      } else if(vsi < 185 && cross < 7.5){
        grade = '⭐ EXCELLENT GREASER · 極致平順';
        stars = '★★★★☆';
        desc = '優異平順降落！姿態拉平到位，乘客舒適度滿分。';
        color = '#66d9e8';
      } else if(vsi < 330 && cross < 13.0){
        grade = '✈ STANDARD AIRLINE · 標準著陸';
        stars = '★★★☆☆';
        desc = '標準民航操作手冊著陸，接地堅實果斷，有效防止水漂。';
        color = '#69db7c';
      } else {
        grade = '⚠️ FIRM LANDING · 偏重接地';
        stars = '★★☆☆☆';
        desc = '平飄減速不足或拉平過晚，建議五邊 30 呎微帶抬頭姿態。';
        color = '#ffa94d';
      }

      return {
        vsi,
        cross: cross.toFixed(1),
        speedKt,
        pitchDeg,
        impactG,
        alongM,
        grade,
        stars,
        desc,
        color,
        butter
      };
    }

    // Render interactive telemetry graph on canvas
    function drawChart(canvas, tabName){
      if(!canvas || samples.length < 2) return;
      const ctx = canvas.getContext('2d');
      if(!ctx) return;

      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Background grid
      ctx.fillStyle = '#08121a';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(80, 130, 160, 0.18)';
      ctx.lineWidth = 1;

      // 4 horizontal grid lines
      for(let i = 1; i <= 3; i++){
        const y = (h / 4) * i;
        ctx.beginPath();
        ctx.moveTo(35, y);
        ctx.lineTo(w - 10, y);
        ctx.stroke();
      }

      const count = samples.length;
      const tMin = samples[0].t, tMax = samples[count - 1].t;
      const tSpan = Math.max(1, tMax - tMin);

      function getX(sample){
        return 40 + ((sample.t - tMin) / tSpan) * (w - 55);
      }

      // Draw depending on active tab
      const tab = tabName || 'alt';
      if(tab === 'alt'){
        // Altitude (0 to maxAlt)
        let maxAlt = 200;
        for(const s of samples) if(s.altFt > maxAlt) maxAlt = s.altFt;
        maxAlt = Math.ceil(maxAlt / 200) * 200;

        // Label axis
        ctx.fillStyle = '#78a2ba';
        ctx.font = '10px monospace';
        ctx.fillText(maxAlt + 'ft', 2, 14);
        ctx.fillText((maxAlt / 2) + 'ft', 2, h / 2 + 3);
        ctx.fillText('0ft', 2, h - 6);

        // Theoretical 3-deg Glide Path (amber dotted line)
        ctx.strokeStyle = 'rgba(255, 190, 60, 0.45)';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(40, 16);
        ctx.lineTo(w - 15, h - 14);
        ctx.stroke();
        ctx.setLineDash([]);

        // Altitude curve (cyan glow)
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        for(let i = 0; i < count; i++){
          const x = getX(samples[i]);
          const y = h - 14 - (samples[i].altFt / maxAlt) * (h - 28);
          if(i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Legend
        ctx.fillStyle = '#00e5ff';
        ctx.fillText('實測高度 (ft)', w - 85, 16);
        ctx.fillStyle = '#ffbe3c';
        ctx.fillText('3° 下滑道', w - 165, 16);

      } else if(tab === 'speed'){
        // IAS (cyan) & VSI (orange)
        let maxIAS = 160;
        for(const s of samples) if(s.ias > maxIAS) maxIAS = s.ias;

        ctx.fillStyle = '#00e5ff';
        ctx.font = '10px monospace';
        ctx.fillText(maxIAS + 'kt', 2, 14);
        ctx.fillText('0kt', 2, h - 6);

        // IAS trace
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        for(let i = 0; i < count; i++){
          const x = getX(samples[i]);
          const y = h - 14 - (samples[i].ias / maxIAS) * (h - 28);
          if(i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // VSI trace (range -1200 to +400)
        ctx.strokeStyle = '#ff922b';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        for(let i = 0; i < count; i++){
          const x = getX(samples[i]);
          const vsi = Math.max(-1400, Math.min(600, samples[i].vsi));
          const y = h - 14 - ((vsi + 1400) / 2000) * (h - 28);
          if(i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        ctx.fillStyle = '#00e5ff';
        ctx.fillText('空速 IAS (kt)', w - 80, 16);
        ctx.fillStyle = '#ff922b';
        ctx.fillText('下沉率 VSI (fpm)', w - 175, 16);

      } else if(tab === 'gforce'){
        // Pitch (purple) & G-Force (lime)
        ctx.fillStyle = '#51cf66';
        ctx.font = '10px monospace';
        ctx.fillText('3.0 G', 2, 14);
        ctx.fillText('1.0 G', 2, h / 2 + 3);
        ctx.fillText('0.0 G', 2, h - 6);

        // G-force trace (lime)
        ctx.strokeStyle = '#51cf66';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        for(let i = 0; i < count; i++){
          const x = getX(samples[i]);
          const g = Math.max(0, Math.min(3.5, samples[i].g));
          const y = h - 14 - (g / 3.2) * (h - 28);
          if(i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Pitch trace (purple)
        ctx.strokeStyle = '#cc5de8';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        for(let i = 0; i < count; i++){
          const x = getX(samples[i]);
          const pitch = Math.max(-10, Math.min(20, samples[i].pitch));
          const y = h - 14 - ((pitch + 10) / 30) * (h - 28);
          if(i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        ctx.fillStyle = '#51cf66';
        ctx.fillText('過載 (G)', w - 60, 16);
        ctx.fillStyle = '#cc5de8';
        ctx.fillText('仰角 (°)', w - 120, 16);
      }

      // Mark touchdown ground contact point
      const tdIndex = samples.findIndex(s => s.ground === 1);
      if(tdIndex >= 0){
        const tdX = getX(samples[tdIndex]);
        ctx.strokeStyle = '#ff6b6b';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(tdX, 8);
        ctx.lineTo(tdX, h - 10);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#ff6b6b';
        ctx.font = 'bold 9px monospace';
        ctx.fillText('▼ 接地 Touchdown', tdX - 35, 11);
      }
    }

    // Export FDR data to CSV format string
    function exportCSV(flightInfo){
      const headers = [
        'Time_s',
        'Altitude_m',
        'Altitude_ft',
        'IAS_kt',
        'VSI_fpm',
        'Pitch_deg',
        'Bank_deg',
        'G_Force',
        'Throttle_pct',
        'Flaps',
        'Centerline_m',
        'Gear',
        'Ground'
      ];
      const rows = [headers.join(',')];

      for(const s of samples){
        rows.push([
          s.t,
          s.altM,
          s.altFt,
          s.ias,
          s.vsi,
          s.pitch,
          s.bank,
          s.g,
          s.power,
          s.flaps,
          s.cross,
          s.gear,
          s.ground
        ].join(','));
      }

      return rows.join('\r\n');
    }

    // Trigger CSV file download in browser
    function downloadCSV(flightInfo){
      if(typeof window === 'undefined' || !window.document) return;
      const csv = exportCSV(flightInfo);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const filename = `Skybound_FDR_${new Date().toISOString().replace(/[:.]/g,'-')}.csv`;
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }

    return {
      get samples(){ return samples; },
      get maxG(){ return maxG; },
      get minG(){ return minG; },
      reset,
      step,
      evaluateLanding,
      drawChart,
      exportCSV,
      downloadCSV
    };
  }

  const recorder = createFlightRecorder();
  root.flightRecorder = recorder;
  if(typeof module !== 'undefined' && module.exports) module.exports = recorder;
})(typeof window !== 'undefined' ? window : global);
