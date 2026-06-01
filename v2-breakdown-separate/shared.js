(function () {
  var FLOW_KEY = "wt_v2_breakdown_state";
  var ARCHIVE_KEY = "wt_s";
  var CYCLE = ["tomorrow", "say", "release"];
  var BLABEL = {
    tomorrow: { l: "Tomorrow", bc: "cbadge-t", cc: "bt" },
    say: { l: "Speak", bc: "cbadge-s", cc: "bs" },
    release: { l: "Release", bc: "cbadge-r", cc: "br" }
  };

  var KW = [
    { w: ["angry", "anger", "mad", "pissed", "hate", "furious", "disrespect", "dismissed", "unfair"], l: "Anger that still feels hot" },
    { w: ["tired", "exhausted", "drained", "burnout", "worn", "depleted"], l: "Tiredness from holding too much" },
    { w: ["deadline", "unfinished", "behind", "task", "project", "overdue", "backlog"], l: "Pressure from unfinished work" },
    { w: ["boss", "manager", "client", "coworker", "colleague", "team", "meeting"], l: "Friction with someone today" },
    { w: ["sad", "disappoint", "hurt", "let down", "betrayed", "ignored", "rejected"], l: "Disappointment that still stings" },
    { w: ["scared", "anxious", "worried", "fear", "tomorrow", "repeat", "again"], l: "Fear tomorrow will feel the same" },
    { w: ["numb", "empty", "blank", "hollow", "detached", "nothing"], l: "Numbness after too much" },
    { w: ["stress", "pressure", "overwhelm", "too much", "everything"], l: "Too much happening at once" }
  ];
  var GENERIC = [
    "A heavy feeling without a name yet",
    "Something unfinished in your mind",
    "Tension your body is still holding",
    "The weight of today's expectations",
    "A quiet sadness that lingered"
  ];

  var state = loadFlow();
  var page = document.body.getAttribute("data-page");

  if (page === "pour") initPour();
  if (page === "sort") initSort();
  if (page === "carry") initCarry();
  if (page === "release") initRelease();
  if (page === "breathe") initBreathe();
  if (page === "return") initReturn();
  if (page === "past") initPast();

  function defaultState() {
    return {
      transcript: "",
      textFallback: "",
      emotions: [],
      weights: [],
      buckets: {}
    };
  }

  function loadFlow() {
    try {
      var raw = localStorage.getItem(FLOW_KEY);
      return raw ? Object.assign(defaultState(), JSON.parse(raw)) : defaultState();
    } catch (e) {
      return defaultState();
    }
  }

  function saveFlow() {
    localStorage.setItem(FLOW_KEY, JSON.stringify(state));
  }

  function analyzeText(txt) {
    var low = (txt || "").toLowerCase();
    var found = [];
    for (var i = 0; i < KW.length && found.length < 5; i += 1) {
      var entry = KW[i];
      for (var j = 0; j < entry.w.length; j += 1) {
        if (low.indexOf(entry.w[j]) !== -1) {
          if (found.indexOf(entry.l) === -1) found.push(entry.l);
          break;
        }
      }
    }
    state.emotions.forEach(function (em) {
      if (found.length >= 5) return;
      if (em === "Anger" && !includesChunk(found, "Anger")) found.push("Anger that still feels hot");
      if (em === "Sadness" && !includesChunk(found, "sadness")) found.push("A sadness you're still sitting with");
      if (em === "Overload" && !includesChunk(found, "much")) found.push("The overload of too much at once");
      if (em === "Numb" && !includesChunk(found, "Numbness")) found.push("Numbness after too much");
      if (em === "Disappointment" && !includesChunk(found, "disappointment")) found.push("A disappointment you couldn't say out loud");
      if (em === "I don't know" && !includesChunk(found, "can't name")) found.push("Something you can't name yet, but it's there");
    });
    if (!found.length) {
      return GENERIC.slice(0, 3);
    }
    return found.slice(0, 5);
  }

  function includesChunk(arr, chunk) {
    return arr.some(function (x) { return x.toLowerCase().indexOf(chunk.toLowerCase()) !== -1; });
  }

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function ensureWeights() {
    if (!state.weights || !state.weights.length) {
      state.weights = analyzeText(state.transcript || state.textFallback);
      saveFlow();
    }
  }

  function initPour() {
    var chips = Array.prototype.slice.call(document.querySelectorAll(".chip"));
    chips.forEach(function (chip) {
      var e = chip.getAttribute("data-e");
      if (state.emotions.indexOf(e) !== -1) chip.classList.add("on");
      chip.addEventListener("click", function () {
        chip.classList.toggle("on");
        if (chip.classList.contains("on")) {
          if (state.emotions.indexOf(e) === -1) state.emotions.push(e);
        } else {
          state.emotions = state.emotions.filter(function (x) { return x !== e; });
        }
        saveFlow();
      });
    });

    var transcript = document.getElementById("transcript");
    var textArea = document.getElementById("textArea");
    var voiceBtn = document.getElementById("voiceOrb");
    var startVoice = document.getElementById("startVoice");
    var stopVoice = document.getElementById("stopVoice");
    var typeMode = document.getElementById("typeMode");
    var continueBtn = document.getElementById("toSort");
    var timer = document.getElementById("voiceTimer");
    var langSel = document.getElementById("speechLang");
    transcript.value = state.transcript || "";
    textArea.value = state.textFallback || "";
    if (langSel) {
      langSel.value = localStorage.getItem("wt_v2_speech_lang") || "auto";
      langSel.addEventListener("change", function () {
        localStorage.setItem("wt_v2_speech_lang", langSel.value);
      });
    }

    transcript.addEventListener("input", function () {
      state.transcript = transcript.value;
      saveFlow();
    });
    textArea.addEventListener("input", function () {
      state.textFallback = textArea.value;
      saveFlow();
    });

    var recog = null;
    var listening = false;
    var recFinal = "";
    var recInterim = "";
    var recSec = 0;
    var iv = null;

    function resolveLang() {
      var pick = langSel ? langSel.value : "auto";
      if (pick && pick !== "auto") return pick;
      return navigator.language || "en-US";
    }
    function tick() {
      recSec += 1;
      var mm = Math.floor(recSec / 60);
      var ss = recSec % 60;
      timer.textContent = mm + ":" + String(ss).padStart(2, "0");
    }
    function setListening(on) {
      listening = on;
      voiceBtn.classList.toggle("listening", on);
      startVoice.style.display = on ? "none" : "block";
      stopVoice.style.display = on ? "block" : "none";
    }

    function start() {
      var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) {
        textArea.style.display = "block";
        textArea.placeholder = "Voice recognition is unavailable here. Type any language, sounds, or fragments.";
        return;
      }
      recFinal = (state.transcript || "").trim();
      if (recFinal) recFinal += " ";
      recInterim = "";
      recSec = 0;
      timer.textContent = "0:00";
      if (iv) clearInterval(iv);
      iv = setInterval(tick, 1000);
      recog = new SR();
      recog.lang = resolveLang();
      recog.continuous = true;
      recog.interimResults = true;
      recog.maxAlternatives = 3;
      setListening(true);
      recog.onresult = function (e) {
        var interimNow = "";
        for (var i = e.resultIndex; i < e.results.length; i += 1) {
          var alt = e.results[i][0];
          var chunk = alt && alt.transcript ? alt.transcript : "";
          if (!chunk) continue;
          if (e.results[i].isFinal) recFinal += chunk + " ";
          else interimNow += chunk + " ";
        }
        recInterim = interimNow;
        transcript.value = (recFinal + recInterim).replace(/\s{2,}/g, " ");
        state.transcript = transcript.value;
        saveFlow();
      };
      recog.onerror = function (evt) {
        var err = evt && evt.error ? evt.error : "";
        if (err === "not-allowed" || err === "service-not-allowed" || err === "audio-capture" || err === "no-speech") {
          stop();
          textArea.style.display = "block";
          textArea.placeholder = "Mic is off. You can type instead.";
        }
      };
      recog.onend = function () {
        if (listening) {
          try { recog.start(); } catch (e) {}
        }
      };
      try { recog.start(); } catch (e) { setListening(false); }
    }

    function stop() {
      if (iv) clearInterval(iv);
      iv = null;
      setListening(false);
      if (recog) {
        try { recog.stop(); } catch (e) {}
        recog = null;
      }
      var merged = (recFinal + recInterim).replace(/\s{2,}/g, " ").trim();
      if (merged) transcript.value = merged;
      state.transcript = transcript.value;
      saveFlow();
    }

    voiceBtn.addEventListener("click", function () {
      if (!listening) start();
      else stop();
    });
    startVoice.addEventListener("click", start);
    stopVoice.addEventListener("click", stop);
    typeMode.addEventListener("click", function () {
      textArea.style.display = "block";
      textArea.focus();
    });
    continueBtn.addEventListener("click", function () {
      if (!state.transcript && textArea.value) state.transcript = textArea.value;
      state.textFallback = textArea.value;
      state.weights = analyzeText(state.transcript || state.textFallback || "");
      saveFlow();
      window.location.href = "03-sort.html";
    });
  }

  function initSort() {
    ensureWeights();
    var wrap = document.getElementById("weightCards");
    wrap.innerHTML = "";
    state.weights.forEach(function (w) {
      var d = document.createElement("div");
      d.className = "card weight-card";
      d.innerHTML = '<div class="wdot"></div><div class="wtext">' + esc(w) + "</div>";
      wrap.appendChild(d);
    });
    var next = document.getElementById("toCarry");
    next.addEventListener("click", function () {
      if (!Object.keys(state.buckets || {}).length) {
        state.buckets = {};
        state.weights.forEach(function (_, i) { state.buckets[i] = "release"; });
      }
      saveFlow();
      window.location.href = "04-carry.html";
    });
  }

  function initCarry() {
    ensureWeights();
    if (!state.buckets) state.buckets = {};
    state.weights.forEach(function (_, i) {
      if (!state.buckets[i]) state.buckets[i] = i < Math.ceil(state.weights.length / 2) ? "tomorrow" : "release";
    });
    saveFlow();

    var c = document.getElementById("carryCards");
    c.innerHTML = "";
    state.weights.forEach(function (w, i) {
      var b = state.buckets[i];
      var d = document.createElement("div");
      d.className = "carry-card " + BLABEL[b].cc;
      d.innerHTML = '<span class="wtext">' + esc(w) + '</span><span class="cbadge ' + BLABEL[b].bc + '" id="cb' + i + '">' + BLABEL[b].l + "</span>";
      d.addEventListener("click", function () {
        var cur = state.buckets[i];
        var nxt = CYCLE[(CYCLE.indexOf(cur) + 1) % CYCLE.length];
        state.buckets[i] = nxt;
        d.className = "carry-card " + BLABEL[nxt].cc;
        var badge = document.getElementById("cb" + i);
        badge.className = "cbadge " + BLABEL[nxt].bc;
        badge.textContent = BLABEL[nxt].l;
        saveFlow();
      });
      c.appendChild(d);
    });

    document.getElementById("toRelease").addEventListener("click", function () {
      saveFlow();
      window.location.href = "05-release.html";
    });
  }

  function initRelease() {
    ensureWeights();
    var list = document.getElementById("releaseItems");
    var rel = state.weights.filter(function (_, i) { return state.buckets[i] === "release"; });
    list.innerHTML = "";
    if (!rel.length) {
      list.innerHTML = '<p class="muted center">Nothing assigned to release. Continue when ready.</p>';
    } else {
      rel.forEach(function (w) {
        var d = document.createElement("div");
        d.className = "card r-item";
        d.textContent = w;
        list.appendChild(d);
      });
    }
    var btn = document.getElementById("letGo");
    var toNext = document.getElementById("toBreathe");
    btn.addEventListener("click", function () {
      Array.prototype.slice.call(document.querySelectorAll(".r-item")).forEach(function (el, i) {
        setTimeout(function () {
          el.style.opacity = "0";
          el.style.transform = "translateY(12px) scale(.96)";
          el.style.transition = "all 1.1s ease";
        }, i * 220);
      });
      btn.disabled = true;
      btn.textContent = "Letting go...";
      setTimeout(function () {
        toNext.style.display = "block";
      }, 1800 + rel.length * 220);
    });
  }

  function initBreathe() {
    var phase = document.getElementById("bPhase");
    var cd = document.getElementById("bCountdown");
    var st = document.getElementById("sessionTimer");
    var next = document.getElementById("toReturn");
    var wrap = document.getElementById("lotusWrap");
    var rings = [];
    [240, 210, 180, 150, 120].forEach(function (size, i) {
      var r = document.createElement("div");
      r.className = "ring";
      r.style.width = size + "px";
      r.style.height = size + "px";
      r.style.opacity = String(0.2 + i * 0.1);
      wrap.appendChild(r);
      rings.push(r);
    });

    var startAt = 0;
    var raf = 0;
    function ease(t) { return 0.5 - Math.cos(Math.PI * t) / 2; }
    function fmt(sec) {
      var s = Math.max(0, Math.floor(sec));
      var m = Math.floor(s / 60);
      var r = s % 60;
      return String(m).padStart(2, "0") + ":" + String(r).padStart(2, "0");
    }
    function frame(ts) {
      if (!startAt) startAt = ts;
      var elapsed = (ts - startAt) / 1000;
      var cycle = 10;
      var inh = 4;
      var exh = 6;
      var sec = elapsed % cycle;
      var bloom;
      var remain;
      if (sec < inh) {
        bloom = ease(sec / inh);
        phase.textContent = "Inhale";
        remain = inh - sec;
      } else {
        bloom = 1 - ease((sec - inh) / exh);
        phase.textContent = "Exhale";
        remain = cycle - sec;
      }
      cd.textContent = remain.toFixed(1);
      st.textContent = elapsed <= 180 ? fmt(180 - elapsed) : "+" + fmt(elapsed - 180);
      rings.forEach(function (r, i) {
        var base = 1 + i * 0.03;
        var pulse = (bloom - 0.5) * (0.18 - i * 0.02);
        var rot = (elapsed * (i % 2 ? -1 : 1) * (1 + i * 0.1));
        r.style.transform = "translate(-50%,-50%) rotate(" + rot.toFixed(2) + "deg) scale(" + (base + pulse).toFixed(4) + ")";
        r.style.left = "50%";
        r.style.top = "50%";
      });
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    next.addEventListener("click", function () {
      cancelAnimationFrame(raf);
      window.location.href = "07-return.html";
    });
  }

  function initReturn() {
    document.getElementById("saveSession").addEventListener("click", function () {
      var entry = {
        date: new Date().toISOString(),
        transcript: state.transcript || state.textFallback || "",
        emotions: state.emotions || [],
        weights: state.weights || []
      };
      var arr = [];
      try { arr = JSON.parse(localStorage.getItem(ARCHIVE_KEY) || "[]"); } catch (e) {}
      arr.push(entry);
      localStorage.setItem(ARCHIVE_KEY, JSON.stringify(arr));
      document.getElementById("saveMsg").textContent = "Saved only on this device.";
    });
    document.getElementById("startAgain").addEventListener("click", function () {
      state = defaultState();
      saveFlow();
      window.location.href = "01-home.html";
    });
  }

  function initPast() {
    var arr = [];
    try { arr = JSON.parse(localStorage.getItem(ARCHIVE_KEY) || "[]"); } catch (e) {}
    var el = document.getElementById("pastList");
    if (!arr.length) {
      el.innerHTML = '<div class="card muted center">No cups saved yet.</div>';
      return;
    }
    el.innerHTML = "";
    arr.slice().reverse().forEach(function (s) {
      var d = new Date(s.date);
      var ds = d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
      var ts = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
      var div = document.createElement("div");
      div.className = "card";
      var tags = (s.emotions || []).map(function (e) { return '<span class="chip on" style="cursor:default">' + esc(e) + "</span>"; }).join(" ");
      var note = esc((s.transcript || "").slice(0, 160));
      div.innerHTML = '<div class="label">' + esc(ds + " · " + ts) + "</div><div style=\"margin-top:8px\">" + tags + '</div><p class="subtitle" style="margin-top:10px">' + note + "</p>";
      el.appendChild(div);
    });
  }
})();
