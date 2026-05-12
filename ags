(function () {
 var root = document.currentScript.parentElement;
 if (!root || !root.classList.contains("mur-call-preview")) return;

 /** Customer support + Legal: replace with real turns (add startTime per line when you sync to audio). */
 var SHARED_TURNS = [
 { speaker: "ai", text: "Replace this line with your agent script for this tab." },
 { speaker: "customer", text: "Replace with caller lines." },
 ];

 var APPOINTMENT_TURNS = [
 {speaker:"ai", text:"Hi, you\u2019ve reached LunaCare Wellness Clinic. I can help you book, reschedule, or cancel an appointment.", startTime:0.0},
 {speaker:"customer", text:"Hi, I would like to book an appointment", startTime:6.55},
 {speaker:"ai", text:"To get started, um, please tell me what type of appointment you\u2019re looking for\u2014like a general consultation, physiotherapy session, or a follow-up visit.", startTime:9.2},
 {speaker:"customer", text:"Um, I\u2019m looking for general consultation.", startTime:16.35},
 {speaker:"ai", text:"Got it. And do you have a preferred day or time? I can check the calendar for the earliest available slot.", startTime:19.4},
 {speaker:"customer", text:"I would prefer a booking for Wednesday, preferably after 3PM", startTime:26.45},
 {speaker:"ai", text:"Alright, I found an opening for Tuesday at 11:30 AM, and another one on Wednesday at 4 PM.", startTime:30.3},
 {speaker:"ai", text:"Which one works better for you?", startTime:39.45},
 {speaker:"customer", text:"Ahh.. Wednesday 4PM works for me", startTime:42.0},
 {speaker:"ai", text:"Perfect. I\u2019ll reserve that for you. Before I confirm, may I have your full name and phone number?", startTime:44.65},
 {speaker:"customer", text:"Sure, its Priya, and my number is 9999459213", startTime:53.55},
 {speaker:"ai", text:"Thanks. Your appointment is booked for Wednesday, 4PM at LunaCare Wellness Clinic.", startTime:56.05},
 {speaker:"ai", text:"You\u2019ll receive a confirmation message shortly. Is there anything else I can help you with today?", startTime:59.3},
 {speaker:"customer", text:"No, that will be all, thank you", startTime:66.85},
 {speaker:"ai", text:"Thank you for calling LunaCare Wellness Clinic. Have a wonderful day.", startTime:68.9},
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
 .replace(/ /g, ">")
 .replace(/"/g, """);
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
 return ' ' + escapeHtml(turn.text) + " ";
 }
 if (turnIdx < activeTurn) {
 return ' ' + escapeHtml(turn.text) + " ";
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
 html += ' ' + escapeHtml(words[i]) + " ";
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
 ' ' +
 ' ' +
 ' ' +
 " "
 );
 }

 function aiAvatar() {
 return (
 ' ' +
 ' ' +
 ' ' +
 ' ' +
 ' ' +
 ' ' +
 ' ' +
 ' ' +
 ' ' +
 ' ' +
 ' ' +
 ' ' +
 " "
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
 ' ';
 html += ' ';
 if (!isAI) {
 html += ' ' + escapeHtml(lang.customerLabel || "Customer") + " ";
 html += customerAvatar();
 } else {
 html += aiAvatar();
 html += ' ' + escapeHtml(lang.aiRoleLabel || "AI Assistant") + " ";
 }
 html += " ";
 html += ' ';
 for (var gi = 0; gi < group.length; gi++) {
 var turnIdx = group[gi];
 var bubbleEnter = groupIsNewToView(oldVisKey, [turnIdx]);
 html +=
 '  ';
 html += renderTurnText(turnIdx, lang, currentWordIndex, offsets, activeTurn, prevCwiAnim);
 html += " ";
 }
 html += " ";
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
