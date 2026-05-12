/**
 * AI Receptionist call preview — Webflow embed logic.
 * Load this file with a synchronous <script src> as the LAST child inside
 * <div class="mur-call-preview"> so document.currentScript.parentElement is the root.
 *
 * Host on GitHub and serve via jsDelivr:
 *   https://cdn.jsdelivr.net/gh/SurajPratap10/ag-to@main/ags
 *
 * Do not use defer/async on that tag (currentScript must be set during run).
 */

(function () {
  var root = document.currentScript.parentElement;
  if (!root || !root.classList.contains("mur-call-preview")) return;

  /** Customer support + Legal: replace with real turns (add startTime per line when you sync to audio). */
  var SHARED_TURNS = [
    { speaker: "ai", text: "Replace this line with your agent script for this tab." },
    { speaker: "customer", text: "Replace with caller lines." },
  ];

  var APPOINTMENT_TURNS = [
    {speaker:"ai",       text:"Hi, you\u2019ve reached LunaCare Wellness Clinic. I can help you book, reschedule, or cancel an appointment.", startTime:0.0},
    {speaker:"customer", text:"Hi, I would like to book an appointment",                                                                    startTime:6.55},
    {speaker:"ai",       text:"To get started, um, please tell me what type of appointment you\u2019re looking for\u2014like a general consultation, physiotherapy session, or a follow-up visit.", startTime:9.2},
    {speaker:"customer", text:"Um, I\u2019m looking for general consultation.",                                                              startTime:16.35},
    {speaker:"ai",       text:"Got it. And do you have a preferred day or time? I can check the calendar for the earliest available slot.",   startTime:19.4},
    {speaker:"customer", text:"I would prefer a booking for Wednesday, preferably after 3PM",                                                startTime:26.45},
    {speaker:"ai",       text:"Alright, I found an opening for Tuesday at 11:30 AM, and another one on Wednesday at 4 PM.",                  startTime:30.3},
    {speaker:"ai",       text:"Which one works better for you?",                                                                             startTime:39.45},
    {speaker:"customer", text:"Ahh.. Wednesday 4PM works for me",                                                                            startTime:42.0},
    {speaker:"ai",       text:"Perfect. I\u2019ll reserve that for you. Before I confirm, may I have your full name and phone number?",       startTime:44.65},
    {speaker:"customer", text:"Sure, its Priya, and my number is 9999459213",                                                                startTime:53.55},
    {speaker:"ai",       text:"Thanks. Your appointment is booked for Wednesday, 4PM at LunaCare Wellness Clinic.",                           startTime:56.05},
    {speaker:"ai",       text:"You\u2019ll receive a confirmation message shortly. Is there anything else I can help you with today?",        startTime:59.3},
    {speaker:"customer", text:"No, that will be all, thank you",                                                                             startTime:66.85},
    {speaker:"ai",       text:"Thank you for calling LunaCare Wellness Clinic. Have a wonderful day.",                                        startTime:68.9},
  ];

  var LANGS = [
    {
      flag: "",
      label: "Appointment scheduling",
      aiRoleLabel: "Appointment scheduling",
      customerLabel: "Caller",
      audioSrc: "https://murf.ai/public-assets/webflow/voice-agent-demos/appointment-scheduling.wav",
      turns: APPOINTMENT_TURNS,
    },
    {
      flag: "",
      label: "Customer support",
      aiRoleLabel: "Customer support",
      customerLabel: "Caller",
      audioSrc: "https://murf.ai/public-assets/webflow/voice-agent-demos/customer-support+.wav",
      turns: SHARED_TURNS,
    },
    {
      flag: "",
      label: "Legal services",
      aiRoleLabel: "Legal services",
      customerLabel: "Caller",
      audioSrc: "https://murf.ai/public-assets/webflow/voice-agent-demos/legal-services.wav",
      turns: SHARED_TURNS,
    },
  ];

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function buildOffsets(turns) {
    var o = [];
    var n = 0;
    for (var i = 0; i < turns.length; i++) {
      o.push(n);
      n += turns[i].text.split(" ").length;
    }
    return o;
  }

  function countTotal(turns) {
    var s = 0;
    for (var i = 0; i < turns.length; i++) s += turns[i].text.split(" ").length;
    return s;
  }

  function activeTurnFrom(wordIdx, offsets) {
    if (wordIdx < 0) return -1;
    var result = 0;
    for (var i = 0; i < offsets.length; i++) {
      if (wordIdx >= offsets[i]) result = i;
      else break;
    }
    return result;
  }

  function visibleIndices(activeTurn, len) {
    if (len <= 0) return [];
    if (activeTurn < 0) return [0];
    var end = Math.min(activeTurn, len - 1);
    var out = [];
    for (var i = 0; i <= end; i++) out.push(i);
    return out;
  }

  var preset = (root.getAttribute("data-preset") || "").toLowerCase();
  var langIndex = 0;
  if (preset === "support" || preset === "customer-support" || preset === "customer_support") langIndex = 1;
  else if (preset === "legal" || preset === "legal-services") langIndex = 2;

  var playState = "idle";
  var currentWordIndex = -1;
  var progress = 0;
  var intervalId = null;
  var rafId = null;
  var wordRef = -1;
  var WORD_MS = 230;

  var elFlag = root.querySelector(".mur-call-preview__lang-flag");
  var elLabel = root.querySelector(".mur-call-preview__lang-label");
  var elThread = root.querySelector(".mur-call-preview__thread");
  var elProgressFill = root.querySelector(".mur-call-preview__progress__fill");
  var btnPlayPause = root.querySelector(".mur-call-preview__play-pause");
  var btnRestart = root.querySelector(".mur-call-preview__restart");
  var btnPrev = root.querySelector(".mur-call-preview__lang-prev");
  var btnNext = root.querySelector(".mur-call-preview__lang-next");
  var audio = root.querySelector(".mur-call-preview__audio");
  var LANG_CODES = ["appointment", "support", "legal"];
  var lastVisKey = null;
  var lastCwiForWordAnim = -2;
  /** Avoid reassigning audio.src when unchanged — that reloads media and resets currentTime (breaks pause/resume). */
  var lastSyncedAudioUrl = null;

  var threadScrollRaf = null;
  var threadWantsSmoothScroll = false;

  function scheduleThreadScroll(smooth) {
    if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      smooth = false;
    }
    threadWantsSmoothScroll = threadWantsSmoothScroll || smooth;
    if (threadScrollRaf !== null) return;
    threadScrollRaf = requestAnimationFrame(function () {
      threadScrollRaf = null;
      if (!elThread) return;
      var target = elThread.scrollHeight;
      var useSmooth = threadWantsSmoothScroll;
      threadWantsSmoothScroll = false;
      if (useSmooth) {
        try {
          elThread.scrollTo({ top: target, behavior: "smooth" });
        } catch (e) {
          elThread.scrollTop = target;
        }
      } else {
        elThread.scrollTop = target;
      }
    });
  }

  function groupIsNewToView(oldKey, groupIdxs) {
    if (oldKey === null || oldKey === "") return true;
    var parts = oldKey.split("-");
    for (var ni = 0; ni < groupIdxs.length; ni++) {
      if (parts.indexOf(String(groupIdxs[ni])) === -1) return true;
    }
    return false;
  }

  function audioUrlForCurrentLang() {
    var code = LANG_CODES[langIndex];
    var u = root.getAttribute("data-audio-" + code);
    if (u) return u.trim();
    var lang = LANGS[langIndex];
    if (lang && lang.audioSrc) return String(lang.audioSrc).trim();
    var fb = root.getAttribute("data-audio-src");
    if (fb) return fb.trim();
    return "";
  }

  function syncAudioSrc() {
    if (!audio) return;
    var u = audioUrlForCurrentLang();
    try {
      if (u) {
        if (lastSyncedAudioUrl !== u) {
          audio.src = u;
          lastSyncedAudioUrl = u;
        }
      } else {
        lastSyncedAudioUrl = null;
        audio.removeAttribute("src");
        audio.load();
      }
    } catch (e) {}
  }

  function hasTimedAudio() {
    return !!audioUrlForCurrentLang();
  }

  function audioPause() {
    if (!audio) return;
    try {
      audio.pause();
    } catch (e) {}
  }

  function audioHardStop() {
    if (!audio) return;
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch (e) {}
  }

  function clearTimer() {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function onPreviewComplete() {
    if (playState === "idle") return;
    clearTimer();
    playState = "idle";
    currentWordIndex = -1;
    progress = 0;
    audioHardStop();
    lastVisKey = null;
    lastCwiForWordAnim = -2;
    render();
  }

  function syncFromAudioTime() {
    var lang = LANGS[langIndex];
    var turns = lang.turns;
    var offsets = buildOffsets(turns);
    var total = countTotal(turns);
    if (!audio || !total) return;
    var d = audio.duration;
    if (!d || !isFinite(d) || d <= 0) return;
    var t = Math.min(d, Math.max(0, audio.currentTime));
    progress = (t / d) * 100;

    if (turns[0] && typeof turns[0].startTime === "number") {
      var aTurn = 0;
      for (var si = 0; si < turns.length; si++) {
        if (t >= turns[si].startTime) aTurn = si; else break;
      }
      var tStart = turns[aTurn].startTime;
      var tEnd = (aTurn + 1 < turns.length) ? turns[aTurn + 1].startTime : d;
      var tDur = tEnd - tStart;
      var wc = turns[aTurn].text.split(" ").length;
      var elapsed = t - tStart;
      var wi = tDur > 0 ? Math.min(wc - 1, Math.floor((elapsed / tDur) * wc)) : 0;
      currentWordIndex = offsets[aTurn] + Math.max(0, wi);
    } else {
      var idx = Math.min(total - 1, Math.max(0, Math.floor((t / d) * total)));
      currentWordIndex = idx;
    }

    var at = activeTurnFrom(currentWordIndex, offsets);
    playState = at <= 1 ? "playing" : "mid-playback";
  }

  function runAudioRaf() {
    if (rafId !== null) cancelAnimationFrame(rafId);
    function tick() {
      if (!audio || audio.paused) {
        rafId = null;
        return;
      }
      if (audio.ended) {
        rafId = null;
        onPreviewComplete();
        return;
      }
      syncFromAudioTime();
      render();
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
  }

  function startWordFallback(fromWord, offsets, total) {
    clearTimer();
    wordRef = fromWord;
    currentWordIndex = fromWord;
    progress = total > 0 ? ((fromWord + 1) / total) * 100 : 0;
    var at = activeTurnFrom(fromWord, offsets);
    playState = at <= 1 ? "playing" : "mid-playback";
    render();
    intervalId = setInterval(function () {
      wordRef += 1;
      if (wordRef >= total) {
        clearTimer();
        onPreviewComplete();
        return;
      }
      currentWordIndex = wordRef;
      progress = ((wordRef + 1) / total) * 100;
      var at2 = activeTurnFrom(wordRef, offsets);
      if (at2 >= 2) playState = "mid-playback";
      render();
    }, WORD_MS);
  }

  function startPlayback(resume) {
    var lang = LANGS[langIndex];
    var offsets = buildOffsets(lang.turns);
    var total = countTotal(lang.turns);
    clearTimer();

    if (hasTimedAudio()) {
      syncAudioSrc();
      if (!resume) {
        try {
          audio.currentTime = 0;
        } catch (e) {}
        currentWordIndex = 0;
        progress = total > 0 ? (1 / total) * 100 : 0;
      }
      playState = "playing";
      render();
      var pr = audio.play();
      if (pr && typeof pr.catch === "function") pr.catch(function () {});
      syncFromAudioTime();
      render();
      runAudioRaf();
    } else {
      if (!resume) {
        startWordFallback(0, offsets, total);
      } else {
        startWordFallback(currentWordIndex, offsets, total);
      }
    }
  }

  if (audio) {
    audio.addEventListener("ended", function () {
      if (playState === "idle" || playState === "paused") return;
      onPreviewComplete();
    });
  }

  function renderTurnText(turnIdx, lang, cwi, offsets, activeTurn, prevCwiAnim) {
    var turn = lang.turns[turnIdx];
    var words = turn.text.split(" ");
    var off = offsets[turnIdx];

    if (playState === "idle") {
      return '<span class="mur-call-preview__dim">' + escapeHtml(turn.text) + "</span>";
    }
    if (turnIdx < activeTurn) {
      return '<span class="mur-call-preview__dim">' + escapeHtml(turn.text) + "</span>";
    }
    if (turnIdx > activeTurn) return "";

    var allowWordIn =
      (playState === "playing" || playState === "mid-playback") && cwi !== prevCwiAnim;

    var html = "";
    for (var i = 0; i < words.length; i++) {
      var g = off + i;
      if (g <= cwi) {
        var wcls = "mur-call-preview__word";
        if (allowWordIn && g === cwi) wcls += " mur-call-preview__word--in";
        html += '<span class="' + wcls + '">' + escapeHtml(words[i]) + "</span>";
        if (i < words.length - 1) html += " ";
      }
    }
    return html;
  }

  function syncTypingBubbleWords(bubbleInner, turnIdx, lang, cwi, offsets, prevCwiAnim) {
    var turn = lang.turns[turnIdx];
    var words = turn.text.split(" ");
    var off = offsets[turnIdx];
    var playOn = playState === "playing" || playState === "mid-playback";
    var allowWordIn = playOn && cwi !== prevCwiAnim;

    var targetN = 0;
    for (var wi = 0; wi < words.length; wi++) {
      if (off + wi <= cwi) targetN++;
      else break;
    }

    if (bubbleInner.querySelector(".mur-call-preview__dim")) bubbleInner.textContent = "";

    function wordSpans() {
      return bubbleInner.querySelectorAll(".mur-call-preview__word");
    }

    var spans = wordSpans();
    while (spans.length > targetN) {
      var last = bubbleInner.lastChild;
      if (last && last.nodeType === 3) bubbleInner.removeChild(last);
      last = bubbleInner.lastChild;
      if (last && last.nodeType === 1) bubbleInner.removeChild(last);
      spans = wordSpans();
    }

    for (var j = 0; j < targetN; j++) {
      var g = off + j;
      var span = spans[j];
      if (!span) {
        if (bubbleInner.childNodes.length === 0) {
          span = document.createElement("span");
          span.className = "mur-call-preview__word";
          bubbleInner.appendChild(span);
        } else {
          bubbleInner.appendChild(document.createTextNode(" "));
          span = document.createElement("span");
          span.className = "mur-call-preview__word";
          bubbleInner.appendChild(span);
        }
        spans = wordSpans();
        span = spans[j];
      }
      if (span.textContent !== words[j]) span.textContent = words[j];
      if (allowWordIn && g === cwi) span.classList.add("mur-call-preview__word--in");
      else span.classList.remove("mur-call-preview__word--in");
    }
  }

  function customerAvatar() {
    return (
      '<span class="mur-call-preview__avatar mur-call-preview__avatar--customer" aria-hidden="true">' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">' +
      '<circle cx="10" cy="10" r="10" fill="url(#murfp-cust-g)" fill-opacity="0.5"/>' +
      "</svg></span>"
    );
  }

  function aiAvatar() {
    return (
      '<span class="mur-call-preview__avatar mur-call-preview__avatar--ai" aria-hidden="true">' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">' +
      '<g clip-path="url(#murfp-clip)">' +
      '<path d="M13.4032 13.3514C10.5903 16.6467 6.76098 18.5256 3.46801 19.4021C3.46684 19.4025 3.46567 19.4029 3.4645 19.4033C3.38207 19.4248 3.30043 19.4463 3.21918 19.4666C3.04223 19.5037 2.85903 19.5232 2.67153 19.5232C1.19848 19.5232 0.00473022 18.3295 0.00473022 16.8564V1.59668C0.00512085 4.98496 0.727777 10.1752 2.58793 12.8975C3.07582 13.6115 3.63051 14.2127 4.23168 14.6943C4.23246 14.6943 4.23364 14.6951 4.23442 14.6963C4.28403 14.7365 4.33442 14.7756 4.38481 14.8135C7.02504 16.8135 10.5911 16.3596 13.325 13.3123L13.4032 13.3514Z" fill="url(#murfp-p0)"/>' +
      '<path d="M13.3723 13.3203L13.3598 13.3352L13.3578 13.3375L13.2711 13.4402C12.3594 14.4313 11.3449 15.1617 10.2852 15.6051C10.2664 15.6129 10.2473 15.6207 10.2285 15.6281C9.46682 15.932 8.68088 16.0887 7.89104 16.0887C7.75979 16.0887 7.62893 16.0844 7.49807 16.0758C5.52659 15.9457 3.73479 14.8406 2.45276 12.9637C1.60237 11.7191 0.952759 9.88633 0.522681 7.51602C0.514868 7.47227 0.506665 7.42851 0.498853 7.38477C0.498853 7.3832 0.498462 7.38125 0.498071 7.37969C0.474243 7.24336 0.451196 7.10781 0.429321 6.97305C0.427759 6.96133 0.425806 6.94961 0.423853 6.93828C0.405493 6.82344 0.387915 6.70937 0.371118 6.59609C0.362915 6.54102 0.355103 6.48633 0.346899 6.43203C0.322681 6.26094 0.300024 6.0918 0.27854 5.92422C0.269556 5.85078 0.260571 5.77773 0.251587 5.70469C0.24729 5.66641 0.242603 5.62813 0.237915 5.58984C0.230103 5.52109 0.22229 5.45273 0.214868 5.38477C0.214868 5.3832 0.214478 5.38164 0.214478 5.38047C0.199634 5.24609 0.185962 5.11328 0.173071 4.98203C0.17229 4.97383 0.171509 4.96562 0.170728 4.95742C0.165259 4.89961 0.15979 4.84219 0.154321 4.78516C0.15354 4.77344 0.152368 4.76211 0.151196 4.75078C0.143384 4.66445 0.135962 4.5793 0.128931 4.49492C0.125024 4.44531 0.121118 4.39609 0.116821 4.34727C0.109009 4.24805 0.101978 4.15039 0.0949463 4.05391C0.094165 4.04531 0.0937744 4.03633 0.0929932 4.02773C0.0871338 3.94023 0.0812744 3.8543 0.0758057 3.76953C0.0738525 3.73633 0.0718994 3.70312 0.0695557 3.66992C0.06604 3.61172 0.062915 3.55391 0.0593994 3.49688C0.05979 3.49609 0.0593994 3.49531 0.0593994 3.49453C0.0562744 3.43828 0.05354 3.38281 0.050415 3.32773C0.050415 3.32422 0.050415 3.3207 0.050415 3.3168C0.0461182 3.23516 0.0426025 3.15508 0.0390869 3.07656C0.0355713 2.99766 0.0324463 2.9207 0.0297119 2.84531C0.0293213 2.83398 0.0289307 2.82305 0.02854 2.81211C0.0265869 2.7582 0.0246338 2.70547 0.0230713 2.65391C0.0226807 2.64258 0.02229 2.63125 0.0218994 2.61992C0.0207275 2.57969 0.0195557 2.53984 0.0183838 2.50078C0.0176025 2.47578 0.0172119 2.45078 0.0164307 2.42656C0.0156494 2.40234 0.0152588 2.37852 0.0144775 2.35508C0.0144775 2.34805 0.0144775 2.34102 0.0140869 2.33398C0.0133057 2.3 0.0125244 2.2668 0.0121338 2.23398C0.0105713 2.15625 0.00939941 2.08164 0.00822754 2.00937C0.00783691 1.97031 0.00744629 1.93203 0.00705566 1.89492V1.87617C0.00705566 1.84141 0.00627441 1.80742 0.00627441 1.77422C0.00627441 1.75547 0.00588379 1.73672 0.00588379 1.71797C0.00549316 1.675 0.00549316 1.63359 0.00549316 1.59375V1.55469C0.00705566 1.1875 0.304712 0.890625 0.67229 0.890625C0.831665 0.890625 0.977759 0.946484 1.0926 1.04023L1.18909 1.13672L13.3727 13.3203H13.3723Z" fill="url(#murfp-p1)"/>' +
      '<path d="M0.428925 6.97314C0.4508 7.10791 0.473846 7.24346 0.497675 7.37979C0.473456 7.24385 0.4508 7.10791 0.428925 6.97314Z" fill="url(#murfp-p2)"/>' +
      '<path fill-rule="evenodd" clip-rule="evenodd" d="M0.75314 7.47424C1.1264 9.53099 1.72952 11.4905 2.64563 12.8315C3.95044 14.741 5.7483 15.7643 7.63292 15.8487C9.51803 15.933 11.5088 15.0787 13.1988 13.1952L13.3732 13.3517C11.6452 15.2775 9.59007 16.1709 7.62244 16.0828C5.65432 15.9947 3.79262 14.9254 2.45212 12.9638L2.45211 12.9638C1.50806 11.5818 0.897712 9.58345 0.522532 7.51609C0.14684 5.44592 0.00473022 3.29356 0.00473022 1.59375H0.239105C0.239105 3.28222 0.380394 5.4203 0.75314 7.47424Z" fill="url(#murfp-p3)"/>' +
      '<path d="M6.60629 6.63281C9.41918 3.3375 13.2485 1.45859 16.5414 0.582031C16.5426 0.58164 16.5438 0.58125 16.545 0.580859C16.6274 0.559375 16.709 0.537891 16.7903 0.517578C16.9672 0.480469 17.1504 0.460938 17.3379 0.460938C18.811 0.460938 20.0047 1.65469 20.0047 3.12773V18.3875C20.0043 14.9992 19.2817 9.80898 17.4215 7.08672C16.9336 6.37266 16.3789 5.77148 15.7778 5.28984C15.777 5.28984 15.7758 5.28906 15.775 5.28789C15.7254 5.24766 15.675 5.20859 15.6247 5.1707C12.9844 3.1707 9.4184 3.62461 6.68442 6.67187L6.60629 6.63281Z" fill="url(#murfp-p4)"/>' +
      '<path d="M6.63757 6.66387L6.65007 6.64902L6.65203 6.64668L6.73874 6.54395C7.65046 5.55293 8.66492 4.82246 9.72468 4.3791C9.74343 4.37129 9.76257 4.36348 9.78132 4.35606C10.543 4.05215 11.329 3.89551 12.1188 3.89551C12.2501 3.89551 12.3809 3.8998 12.5118 3.9084C14.4833 4.03848 16.2751 5.14356 17.5571 7.02051C18.4075 8.26504 19.0571 10.0979 19.4872 12.4682C19.495 12.5119 19.5032 12.5557 19.511 12.5994C19.511 12.601 19.5114 12.6029 19.5118 12.6045C19.5356 12.7408 19.5587 12.8764 19.5805 13.0111C19.5821 13.0229 19.5841 13.0346 19.586 13.0459C19.6044 13.1607 19.6219 13.2748 19.6387 13.3881C19.6469 13.4432 19.6548 13.4979 19.663 13.5521C19.6872 13.7232 19.7098 13.8924 19.7313 14.06C19.7403 14.1334 19.7493 14.2064 19.7583 14.2795C19.7626 14.3178 19.7673 14.3561 19.7719 14.3943C19.7798 14.4631 19.7876 14.5314 19.795 14.5994C19.795 14.601 19.7954 14.6025 19.7954 14.6037C19.8102 14.7381 19.8239 14.8709 19.8368 15.0021C19.8376 15.0104 19.8384 15.0186 19.8391 15.0268C19.8446 15.0846 19.8501 15.142 19.8555 15.199C19.8563 15.2107 19.8575 15.2221 19.8587 15.2334C19.8665 15.3197 19.8739 15.4049 19.8809 15.4893C19.8848 15.5389 19.8887 15.5881 19.893 15.6369C19.9009 15.7361 19.9079 15.8338 19.9149 15.9303C19.9157 15.9389 19.9161 15.9479 19.9169 15.9564C19.9227 16.0439 19.9286 16.1299 19.9341 16.2146C19.936 16.2479 19.938 16.2811 19.9403 16.3143C19.9438 16.3725 19.9469 16.4303 19.9505 16.4873C19.9501 16.4881 19.9505 16.4889 19.9505 16.4896C19.9536 16.5459 19.9563 16.6014 19.9594 16.6564C19.9594 16.66 19.9594 16.6635 19.9594 16.6674C19.9637 16.749 19.9673 16.8291 19.9708 16.9076C19.9743 16.9865 19.9774 17.0635 19.9802 17.1389C19.9805 17.1502 19.9809 17.1611 19.9813 17.1721C19.9833 17.226 19.9852 17.2787 19.9868 17.3303C19.9872 17.3416 19.9876 17.3529 19.988 17.3643C19.9891 17.4045 19.9903 17.4443 19.9915 17.4834C19.9923 17.5084 19.9927 17.5334 19.9934 17.5576C19.9942 17.5818 19.9946 17.6057 19.9954 17.6291C19.9954 17.6361 19.9954 17.6432 19.9958 17.6502C19.9966 17.6842 19.9973 17.7174 19.9977 17.7502C19.9993 17.8279 20.0005 17.9025 20.0016 17.9748C20.002 18.0139 20.0024 18.0522 20.0028 18.0893V18.108C20.0028 18.1428 20.0036 18.1768 20.0036 18.21C20.0036 18.2287 20.004 18.2475 20.004 18.2662C20.0044 18.3092 20.0044 18.3506 20.0044 18.3904V18.4295C20.0028 18.7967 19.7052 19.0936 19.3376 19.0936C19.1782 19.0936 19.0321 19.0377 18.9173 18.9439L18.8208 18.8475L6.63757 6.66387Z" fill="url(#murfp-p5)"/>' +
      '<path d="M19.5809 13.0111C19.5591 12.8764 19.536 12.7408 19.5122 12.6045C19.5364 12.7404 19.5591 12.8764 19.5809 13.0111Z" fill="url(#murfp-p6)"/>' +
      '<path fill-rule="evenodd" clip-rule="evenodd" d="M12.3766 4.13557C10.4915 4.05119 8.50073 4.90551 6.81072 6.78905L6.63628 6.63252C8.36424 4.70668 10.4194 3.81335 12.387 3.90143C14.3552 3.98953 16.2169 5.05879 17.5574 7.02045C18.5016 8.40224 19.112 10.4006 19.4871 12.468C19.8627 14.5382 20.0048 16.6907 20.0048 18.3905H19.7704C19.7704 16.702 19.6292 14.5638 19.2565 12.5098C18.8833 10.453 18.2801 8.49355 17.3639 7.15269L17.4606 7.08657L17.3639 7.15269C16.059 5.24325 14.2612 4.21993 12.3766 4.13557Z" fill="url(#murfp-p7)"/>' +
      '<path d="M9.99998 14.7776C12.6387 14.7776 14.7777 12.6386 14.7777 9.9999C14.7777 7.36123 12.6387 5.22217 9.99998 5.22217C7.36131 5.22217 5.22224 7.36123 5.22224 9.9999C5.22224 12.6386 7.36131 14.7776 9.99998 14.7776Z" fill="white"/>' +
      "</g></svg></span>"
    );
  }

  function render() {
    var lang = LANGS[langIndex];
    if (elFlag) elFlag.textContent = lang.flag || "";
    if (elLabel) elLabel.textContent = lang.label || "";

    var prevCwiAnim = lastCwiForWordAnim;
    lastCwiForWordAnim = currentWordIndex;

    var offsets = buildOffsets(lang.turns);
    var total = countTotal(lang.turns);
    var activeTurn = activeTurnFrom(currentWordIndex, offsets);
    var vis = visibleIndices(activeTurn, lang.turns.length);
    var visKey = vis.join("-");

    if (visKey !== lastVisKey) {
      var oldVisKey = lastVisKey;
      lastVisKey = visKey;
      var html = "";
      var vi = 0;
      while (vi < vis.length) {
        var group = [];
        var sp0 = lang.turns[vis[vi]].speaker;
        while (vi < vis.length && lang.turns[vis[vi]].speaker === sp0) {
          group.push(vis[vi]);
          vi++;
        }
        var isAI = sp0 === "ai";
        var g0 = group[0];
        var gLast = group[group.length - 1];
        var groupPast = activeTurn >= 0 && gLast < activeTurn;
        var turnEnter = groupIsNewToView(oldVisKey, group);
        html +=
          '<div class="mur-call-preview__turn mur-call-preview__turn--' +
          (isAI ? "ai" : "customer") +
          (groupPast ? " mur-call-preview__turn--past" : "") +
          (turnEnter ? " mur-call-preview__turn--enter" : "") +
          '" data-group-from="' +
          g0 +
          '" data-group-to="' +
          gLast +
          '">';
        html += '<div class="mur-call-preview__meta">';
        if (!isAI) {
          html += '<span class="mur-call-preview__role">' + escapeHtml(lang.customerLabel || "Customer") + "</span>";
          html += customerAvatar();
        } else {
          html += aiAvatar();
          html += '<span class="mur-call-preview__role">' + escapeHtml(lang.aiRoleLabel || "AI Assistant") + "</span>";
        }
        html += "</div>";
        html += '<div class="mur-call-preview__bubble-stack">';
        for (var gi = 0; gi < group.length; gi++) {
          var turnIdx = group[gi];
          var bubbleEnter = groupIsNewToView(oldVisKey, [turnIdx]);
          html +=
            '<div class="mur-call-preview__bubble mur-call-preview__bubble--' +
            (isAI ? "ai" : "customer") +
            (bubbleEnter ? " mur-call-preview__bubble--enter" : "") +
            '" data-bubble-turn="' +
            turnIdx +
            '"><span class="mur-call-preview__bubble-inner">';
          html += renderTurnText(turnIdx, lang, currentWordIndex, offsets, activeTurn, prevCwiAnim);
          html += "</span></div>";
        }
        html += "</div></div>";
      }
      elThread.innerHTML = html;
      scheduleThreadScroll(true);
    } else {
      var useIncrementalTyping =
        (playState === "playing" || playState === "mid-playback") && activeTurn >= 0;
      for (var vj = 0; vj < vis.length; vj++) {
        var tj = vis[vj];
        var bubbleInner = elThread.querySelector('[data-bubble-turn="' + tj + '"] .mur-call-preview__bubble-inner');
        if (bubbleInner) {
          if (useIncrementalTyping && tj === activeTurn) {
            syncTypingBubbleWords(bubbleInner, tj, lang, currentWordIndex, offsets, prevCwiAnim);
          } else {
            bubbleInner.innerHTML = renderTurnText(tj, lang, currentWordIndex, offsets, activeTurn, prevCwiAnim);
          }
        }
      }
      scheduleThreadScroll(false);
    }

    if (elProgressFill) {
      var pr = Math.min(100, Math.max(0, progress));
      elProgressFill.style.width = pr + "%";
    }
    var isPlaying = playState === "playing" || playState === "mid-playback";
    btnPlayPause.classList.toggle("is-playing", isPlaying);
    btnRestart.style.display = playState !== "idle" ? "inline-flex" : "none";
  }

  btnPlayPause.addEventListener("click", function () {
    var isPlaying = playState === "playing" || playState === "mid-playback";
    if (isPlaying) {
      clearTimer();
      playState = "paused";
      audioPause();
      render();
    } else if (playState === "idle") {
      startPlayback(false);
    } else if (playState === "paused") {
      startPlayback(true);
    }
  });

  btnRestart.addEventListener("click", function () {
    lastVisKey = null;
    lastCwiForWordAnim = -2;
    if (hasTimedAudio()) {
      syncAudioSrc();
      try {
        audio.currentTime = 0;
      } catch (e) {}
      audioPause();
    } else {
      clearTimer();
    }
    startPlayback(false);
  });

  if (btnPrev) {
    btnPrev.addEventListener("click", function () {
      clearTimer();
      audioHardStop();
      syncAudioSrc();
      lastVisKey = null;
      lastCwiForWordAnim = -2;
      playState = "idle";
      currentWordIndex = -1;
      progress = 0;
      langIndex = (langIndex - 1 + LANGS.length) % LANGS.length;
      render();
    });
  }

  if (btnNext) {
    btnNext.addEventListener("click", function () {
      clearTimer();
      audioHardStop();
      syncAudioSrc();
      lastVisKey = null;
      lastCwiForWordAnim = -2;
      playState = "idle";
      currentWordIndex = -1;
      progress = 0;
      langIndex = (langIndex + 1) % LANGS.length;
      render();
    });
  }

  syncAudioSrc();
  render();
})();
