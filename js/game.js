/* The Clibbins Trail — Oregon Trail prototype, GMT-800 edition */
(() => {
  const $ = (id) => document.getElementById(id);
  const scene = $("scene");
  const view = $("view");
  const ctx = view.getContext("2d");
  const art = $("art");
  const overlay = $("overlay");
  const panel = $("text");
  const cross = $("crosshair");

  const W = 1100;
  const H = 420;

  let screen = "title";
  let sel = 0;
  let state = null;
  let storeQty = null;
  let nameIdx = 0;
  let traveling = false;
  let travelT = 0;
  let hunt = null;
  let river = null;
  let outpost = null;
  let eventObj = null;
  let tombInput = "";
  let lastKey = 0;
  let audioOn = false;
  let actx = null;
  let songTimer = 0;
  let mouse = { x: W / 2, y: H / 2 };
  let raf = 0;
  let toast = "";
  let toastT = 0;
  const IM = { side: {}, hero: {}, bg: {} };
  DATA.trucks.forEach((t) => {
    IM.side[t.id] = new Image();
    IM.side[t.id].src = t.sprite;
    IM.hero[t.id] = new Image();
    IM.hero[t.id].src = t.hero;
  });
  ["prairie", "forest", "hunt", "river"].forEach((k) => {
    IM.bg[k] = new Image();
    IM.bg[k].src = `assets/bg/${k}.jpg`;
  });
  function imgReady(im) {
    return im && im.complete && im.naturalWidth > 0;
  }

  const rand = (a, b) => a + Math.random() * (b - a);
  const irand = (a, b) => (a + Math.floor(Math.random() * (b - a + 1)));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  function occupation() {
    return DATA.occupations.find((o) => o.id === state.occupation);
  }
  function truck() {
    return DATA.trucks.find((t) => t.id === state.truck);
  }
  function stands() {
    return DATA.stands.find((s) => s.id === state.stands);
  }
  function alive() {
    return state.party.filter((p) => p.hp > 0);
  }
  function leader() {
    return state.party[0];
  }
  function nextLandmark() {
    return (
      DATA.landmarks.find((l) => !state.visited.includes(l.mile) && l.mile >= state.miles - 0.05 && l.mile > 0) ||
      DATA.landmarks.find((l) => !state.visited.includes(l.mile) && l.mile > 0) ||
      DATA.landmarks[DATA.landmarks.length - 1]
    );
  }
  function hereLandmark() {
    return DATA.landmarks.find((l) => Math.abs(l.mile - state.miles) < 1.2);
  }
  function markLandmark(lm) {
    if (lm && !state.visited.includes(lm.mile)) state.visited.push(lm.mile);
  }
  function cargoWeight() {
    const i = state.inv;
    return Math.round(
      i.fuel * 6 + i.food + i.parts * 25 + i.atf * 2 + i.ammo * 3 + i.beer * 18 + i.blaster +
        alive().length * 180
    );
  }
  function overweight() {
    return cargoWeight() > truck().payload;
  }
  function outpostMarkup() {
    return 1.45 + (state.miles / DATA.totalMiles) * 1.15;
  }
  function outpostBuy(it) {
    const p = it.price * outpostMarkup();
    return it.price < 1 ? Math.round(p * 100) / 100 : Math.round(p);
  }
  function outpostSell(it) {
    return it.price < 1 ? it.sell : Math.round(it.sell);
  }
  function invStep(it) {
    return it.id === "food" || it.id === "fuel" ? 5 : 1;
  }
  function invGet(id) {
    return state.inv[id] || 0;
  }
  function invAdd(id, n) {
    state.inv[id] = Math.max(0, invGet(id) + n);
  }
  function openOutpost(lm) {
    outpost = { name: lm.name, kind: lm.kind, talk: lm.talk || "" };
    go("outpost");
  }
  function outpostAdjust(dir) {
    if (sel >= DATA.store.length) return;
    const it = DATA.store[sel];
    const step = invStep(it);
    if (dir === "buy") {
      const cost = outpostBuy(it) * step;
      if (state.money < cost) {
        toast = "Not enough cash.";
        toastT = 2;
      } else if (invGet(it.id) + step > it.max) {
        toast = "No more room.";
        toastT = 2;
      } else {
        state.money -= cost;
        invAdd(it.id, step);
        blip(400, 0.04);
      }
    } else {
      if (invGet(it.id) < step) {
        toast = "You don't have that.";
        toastT = 2;
      } else {
        state.money += outpostSell(it) * step;
        invAdd(it.id, -step);
        blip(480, 0.04);
      }
    }
    render();
  }
  function healthWord() {
    const avg = alive().reduce((s, p) => s + p.hp, 0) / Math.max(1, alive().length);
    if (!alive().length) return "dead";
    if (avg > 80) return "good";
    if (avg > 55) return "fair";
    if (avg > 30) return "poor";
    return "very poor";
  }
  function fmtDate(d) {
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }
  function month() {
    return state.date.getMonth();
  }

  function newParty(names) {
    return names.map((n, i) => ({
      name: n,
      hp: i === 0 && occupation().id === "craigslist" ? 86 : 100,
      status: "good",
    }));
  }

  function freshState() {
    const occ = DATA.occupations[0];
    return {
      occupation: occ.id,
      truck: "gmt800",
      stands: "harbor",
      party: [
        { name: "HOSS", hp: 100, status: "good" },
        { name: "DEVIN", hp: 100, status: "good" },
        { name: "RANDY", hp: 100, status: "good" },
        { name: "BARB", hp: 100, status: "good" },
      ],
      money: occ.money,
      date: new Date(DATA.startDate[0], DATA.startDate[1], DATA.startDate[2]),
      miles: 0,
      pace: "steady",
      rations: "filling",
      weather: "fair",
      inv: { fuel: 0, food: 0, parts: 0, atf: 0, ammo: 0, beer: 0, blaster: 0 },
      engine: 100,
      trans: 72,
      tires: 100,
      restDays: 0,
      log: [],
      visited: [0],
      deadCause: null,
      deadWho: null,
      score: 0,
    };
  }

  function applyOccupationAndTruck() {
    const occ = occupation();
    const t = truck();
    state.money = occ.money - stands().cost;
    if (state.money < 0) state.money = 0;
    state.trans = t.transMax;
    if (occ.transHit) state.trans = Math.max(20, state.trans - occ.transHit);
    if (occ.extraFood) state.inv.food += occ.extraFood;
    if (occ.id === "craigslist") {
      state.engine = 78;
      state.tires = 70;
    }
  }

  /* ---------- audio ---------- */
  function armAudio() {
    if (!actx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) actx = new AC();
    }
    if (actx && actx.state === "suspended") actx.resume();
    audioOn = true;
  }
  function blip(f, d = 0.07, type = "square", v = 0.035) {
    if (!audioOn || !actx) return;
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type;
    o.frequency.value = f;
    g.gain.setValueAtTime(v, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + d);
    o.connect(g).connect(actx.destination);
    o.start();
    o.stop(actx.currentTime + d);
  }
  const SONG = [392, 440, 494, 440, 392, 330, 349, 392, 294, 330, 349, 392];
  let songI = 0;

  /* ---------- screens ---------- */
  function setArt(src, fit) {
    const f = fit || "cover";
    art.style.objectFit = f;
    art.style.objectPosition = f === "contain" ? "center center" : "center 45%";
    art.classList.toggle("fit-contain", f === "contain");
    if (!src) {
      art.classList.remove("show");
      art.removeAttribute("src");
      return;
    }
    art.src = src;
    art.classList.add("show");
  }

  function go(name, extraSel) {
    screen = name;
    sel = extraSel || 0;
    traveling = name === "trail" ? traveling : false;
    if (name !== "hunt") hunt = null;
    document.body.classList.toggle("hunt", name === "hunt");
    $("crt").classList.toggle("fullart", name === "death" || name === "victory");
    $("crt").classList.toggle(
      "baked",
      name === "death" && !!(state && DATA.deaths[state.deadCause] && DATA.deaths[state.deadCause].baked)
    );
    cross.hidden = name !== "hunt";
    if (name !== "hunt" && name !== "death" && name !== "victory" && name !== "event" && name !== "river" && name !== "store" && name !== "outpost" && name !== "title" && name !== "intro" && name !== "occupation" && name !== "truck" && name !== "stands" && name !== "depart" && name !== "landmark" && name !== "supplies" && name !== "help" && name !== "scores") {
      setArt(null);
    }
    overlay.innerHTML = "";
    render();
  }

  function menu(lines, hint) {
    return lines
      .map((l, i) => `<div class="menu-line ${i === sel ? "sel" : ""}">${i === sel ? "▶ " : "  "}${i + 1}. ${l}</div>`)
      .join("") + (hint ? `<div class="hint">${hint}</div>` : "");
  }

  /* ---------- render ---------- */
  function render() {
    const fn = renders[screen];
    if (fn) fn();
    drawScene();
  }

  const renders = {
    title() {
      setArt("assets/title.jpg");
      overlay.innerHTML = `<div class="title">THE CLIBBINS TRAIL</div>
        <div class="sub">Independence, Missouri — 2004<br/>A MECC-style pilgrimage for GMT-800s and the men who crawl under them.</div>`;
      panel.innerHTML = menu(
        ["Travel the trail", "See the graves", "What are clibbins?"],
        "SPACE / ENTER to select   ·   1-3 to jump   ·   S sound"
      );
    },
    help() {
      setArt("assets/title.jpg");
      overlay.innerHTML = "";
      panel.innerHTML = `<h2>CLIBBINS</h2>Grass clippings on the road. Slick as ATF on a garage floor. In the old-hoss dialect you do not hit a patch of clippings — yew slip awn dem clibbins.

This is Oregon Trail with a 4L60. Outfit a truck, feed a crew, and try not to die under Harbor Freight jack stands.

<div class="hint">SPACE to return</div>`;
    },
    graves() {
      setArt(null);
      const graves = loadGraves();
      panel.innerHTML = graves.length
        ? `<h2>ALONG THE TRAIL</h2>` +
          graves
            .slice(-8)
            .map((g) => `${g.name} — ${g.cause}\n"${g.epitaph}"  (${g.miles} mi)`)
            .join("\n\n") + `\n\n<div class="hint">SPACE to return</div>`
        : `No one has died yet. That will not last.\n\n<div class="hint">SPACE to return</div>`;
    },
    intro() {
      setArt("assets/title.jpg");
      overlay.innerHTML = "";
      panel.innerHTML = `It is 2004. You are leaving Independence, Missouri for the mud hole at Oregon City — two thousand and forty miles of prairie, grade, and grass clippings.

Your truck is your wagon. Your crew is your oxen. Dysentery still exists, but it is a Sinclair taquito now.

<div class="hint">SPACE to continue</div>`;
    },
    occupation() {
      setArt("assets/store.jpg");
      const list = DATA.occupations.map((o) => `${o.name}  ($${o.money})`);
      const o = DATA.occupations[sel];
      panel.innerHTML = `<h2>WHAT'S YOUR TRADE?</h2>${menu(list)}\n<div class="tiny">${o.blurb}\nScore x${o.scoreMult}. Repair skill ${Math.round(o.repair * 100)}.</div>`;
    },
    names() {
      setArt("assets/store.jpg");
      const rows = state.party
        .map(
          (p, i) =>
            `<div class="name-row"><span>${i + 1}.</span><input data-i="${i}" maxlength="14" value="${p.name}" /></div>`
        )
        .join("");
      panel.innerHTML = `<h2>WHO'S IN THE TRUCK?</h2>Leader first. The others can die without ending the trip. You cannot.
${rows}
<div class="hint">TAB to move   ·   ENTER when the crew is named</div>`;
      const inputs = [...panel.querySelectorAll("input")];
      inputs.forEach((inp) => {
        inp.addEventListener("input", () => {
          const v = inp.value.replace(/[<>]/g, "").slice(0, 14).toUpperCase() || "HOSS";
          inp.value = v;
          state.party[+inp.dataset.i].name = v;
        });
        inp.addEventListener("focus", () => (nameIdx = +inp.dataset.i));
      });
      setTimeout(() => inputs[nameIdx]?.focus(), 30);
    },
    truck() {
      const t = DATA.trucks[sel];
      setArt(t.hero, "contain");
      overlay.innerHTML = "";
      const list = DATA.trucks.map((tr) => tr.name);
      panel.innerHTML = `<h2>WHICH RIG?</h2>${menu(list)}\n<div class="tiny">${t.spec}\n${t.blurb}\nPayload ${t.payload} lbs · ${t.mpg} mpg · trans toughness ${t.transMax}</div>`;
    },
    stands() {
      setArt((truck() || DATA.trucks[sel] || DATA.trucks[0]).hero, "contain");
      overlay.innerHTML = "";
      const list = DATA.stands.map((s) => `${s.name}  ($${s.cost})`);
      const s = DATA.stands[sel];
      panel.innerHTML = `<h2>JACK STANDS</h2>You will get under this truck. Choose carefully.
${menu(list)}\n<div class="tiny">${s.blurb}</div>`;
    },
    store() {
      setArt("assets/store.jpg");
      overlay.innerHTML = "";
      if (!storeQty) {
        storeQty = {};
        DATA.store.forEach((it) => (storeQty[it.id] = it.startHint));
        const billOf = () => DATA.store.reduce((s, it) => s + storeQty[it.id] * it.price, 0);
        while (billOf() > state.money * 0.82) {
          if (storeQty.food > 80) storeQty.food -= 20;
          else if (storeQty.fuel > 12) storeQty.fuel -= 2;
          else if (storeQty.ammo > 1) storeQty.ammo -= 1;
          else if (storeQty.beer > 0) storeQty.beer -= 1;
          else break;
        }
      }
      const lines = DATA.store.map((it) => {
        const q = storeQty[it.id];
        const cost = Math.round(q * it.price);
        return `${it.name.padEnd(26, " ")} ${String(q).padStart(4)}  $${cost}`;
      });
      const bill = DATA.store.reduce((s, it) => s + storeQty[it.id] * it.price, 0);
      const weight = DATA.store.reduce((s, it) => s + storeQty[it.id] * it.weight, 0) + alive().length * 180;
      panel.innerHTML = `<div class="cols"><div>
<h2>MATT'S OUTFITTERS</h2>
Independence, MO
${menu(lines, "← → amount   ·   ENTER leave")}
</div><div>
Cash: $${state.money.toFixed(0)}
Bill: $${bill.toFixed(0)}
After: $${(state.money - bill).toFixed(0)}

Weight: ${Math.round(weight)} lbs
Payload: ${truck().payload} lbs
${weight > truck().payload ? '<span class="bad">OVERLOADED</span>' : '<span class="good">fits in the bed</span>'}
${toastT > 0 ? `<div class="hint">${toast}</div>` : ""}

<div class="tiny">Fuel and food run out. Parts and ATF keep the 4L60 in one piece. Beer is morale. PB Blaster is faith.</div>
</div></div>`;
    },
    depart() {
      setArt(truck().hero, "contain");
      overlay.innerHTML = "";
      panel.innerHTML = `${fmtDate(state.date)}

${leader().name}'s party leaves Independence in a ${truck().name}.
Jack stands: ${stands().name}.
Next landmark: ${nextLandmark().name}, ${nextLandmark().mile} miles.

You may not survive. That is the point.

<div class="hint">SPACE to hit the trail</div>`;
    },
    trail() {
      setArt(null);
      const lm = nextLandmark();
      const milesTo = Math.max(0, Math.round(lm.mile - state.miles));
      const t = truck();
      const transClass = state.trans < 25 ? "bad" : state.trans < 50 ? "warn" : "";
      const here = hereLandmark();
      const atPost = here && (here.kind === "shop" || here.kind === "fort");
      const actions = traveling
        ? `Traveling the trail...\nSPACE to stop at the next chance.`
        : `You may:\n${menu([
            "Continue on trail",
            "Check supplies",
            "Look at map",
            "Change pace",
            "Change food rations",
            "Stop to rest",
            atPost ? "Visit the trading post" : "Attempt to trade",
            "Hunt for food",
            "Crawl under the truck",
          ])}`;
      panel.innerHTML = `<div class="cols"><div>
${fmtDate(state.date)}
Weather ${weatherLabel()} · Health ${healthWord()}
Food ${Math.round(state.inv.food)} lbs · Fuel ${Math.round(state.inv.fuel)} gal
Next: ${lm.name}, ${milesTo} mi
Miles ${Math.round(state.miles)} · $${Math.round(state.money)}
${DATA.paces[state.pace].label} · ${DATA.rations[state.rations].label}
Eng ${Math.round(state.engine)} · <span class="${transClass}">Trans ${Math.round(state.trans)}</span> · Tires ${Math.round(state.tires)}
${overweight() ? '<span class="bad">Overloaded</span>' : '<span class="good">Load OK</span>'}
${toastT > 0 ? `<div class="hint">${toast}</div>` : ""}
</div><div>
${t.name}
Crew: ${alive().map((p) => p.name).join(", ") || "none"}

${actions}
</div></div>`;
    },
    supplies() {
      setArt("assets/store.jpg");
      const i = state.inv;
      panel.innerHTML = `YOUR SUPPLIES

Fuel            ${Math.round(i.fuel)} gal
Food            ${Math.round(i.food)} lbs
Parts kits      ${i.parts}
ATF             ${i.atf} qts
Ammo            ${i.ammo} boxes
Beer            ${i.beer} cases
PB Blaster      ${i.blaster} cans
Jack stands     ${stands().name}
Cash            $${Math.round(state.money)}
Cargo weight    ${cargoWeight()} / ${truck().payload} lbs

Crew:
${state.party.map((p) => `  ${p.name.padEnd(14)} ${p.hp <= 0 ? "DEAD" : p.status + " (" + Math.round(p.hp) + ")"}`).join("\n")}

<div class="hint">SPACE to return</div>`;
    },
    map() {
      setArt(null);
      panel.innerHTML = `THE CLIBBINS TRAIL

Independence, MO  ────────────────────────  Oregon City
${mapText()}

You are at mile ${Math.round(state.miles)}. ${hereLandmark() ? "At " + hereLandmark().name + "." : "Next: " + nextLandmark().name + "."}

<div class="hint">SPACE to return</div>`;
    },
    pace() {
      const keys = Object.keys(DATA.paces);
      panel.innerHTML = `<h2>PACE</h2>Grinding wears the trans. Easy takes all summer.
${menu(keys.map((k) => DATA.paces[k].label + (k === "grinding" ? "   (the 4L60 hates this)" : "")))}`;
    },
    rations() {
      const keys = Object.keys(DATA.rations);
      panel.innerHTML = `<h2>RATIONS</h2>
${menu(keys.map((k) => `${DATA.rations[k].label}  (${DATA.rations[k].lbs} lbs / person / day)`))}`;
    },
    rest() {
      panel.innerHTML = `How many days will you rest? (1-9, 0 to cancel)

Resting heals the crew and the truck a little. It also eats food and invites taquitos.`;
    },
    talk() {
      const lm = hereLandmark() || nextLandmark();
      const line = lm.talk || pick(DATA.talk);
      panel.innerHTML = `A hoss at ${lm.name}:

"${pick([line, ...DATA.talk])}"

<div class="hint">SPACE to return</div>`;
    },
    trade() {
      const tr = eventObj;
      panel.innerHTML = `${tr.line}

You have: food ${Math.round(state.inv.food)}  fuel ${Math.round(state.inv.fuel)}  parts ${state.inv.parts}  ammo ${state.inv.ammo}  beer ${state.inv.beer}  blaster ${state.inv.blaster}  cash $${Math.round(state.money)}

${menu(["Take the trade", "No thanks"])}`;
    },
    outpost() {
      setArt("assets/store.jpg");
      overlay.innerHTML = "";
      const lines = DATA.store.map((it) => {
        const have = it.id === "food" || it.id === "fuel" ? Math.round(state.inv[it.id]) : state.inv[it.id];
        const buy = outpostBuy(it);
        const sell = outpostSell(it);
        const short = it.name.replace(/\s*\(.*\)\s*/, "").trim();
        return `${short.padEnd(14, " ")}${String(have).padStart(4)}   $${buy} / $${sell}`;
      });
      lines.push("Look for a side job");
      lines.push("Leave");
      panel.innerHTML = `<div class="cols"><div>
<h2>${outpost.name}</h2>
${menu(lines, "← sell   → buy   ·   8 work   ·   9 leave")}
</div><div>
${outpost.talk ? outpost.talk : "They will buy what you can spare."}

Cash: $${Math.round(state.money)}
Weight: ${cargoWeight()} / ${truck().payload} lbs
${overweight() ? '<span class="bad">OVERLOADED</span>' : '<span class="good">Load OK</span>'}

Buy / sell is local price.
Hunt meat. Help strangers.
${toastT > 0 ? `<div class="hint">${toast}</div>` : ""}
</div></div>`;
    },
    event() {
      const e = eventObj;
      if (e.image) setArt(e.image);
      else setArt(null);
      overlay.innerHTML = "";
      if (e.choices) {
        panel.innerHTML = `${e.text}\n\n${menu(e.choices.map((c) => c.label))}`;
      } else {
        panel.innerHTML = `${e.text}\n\n<div class="hint">SPACE to continue</div>`;
      }
    },
    river() {
      setArt("assets/bg/river.jpg");
      overlay.innerHTML = "";
      const r = river;
      panel.innerHTML = `${r.name.toUpperCase()}

Weather: ${weatherLabel()}
River width: ${r.width} feet
River depth: ${r.depth} feet
Current: ${r.current}

You may:
${menu([
  "Ford the crossing",
  "Caulk the truck and float (contractor bags)",
  `Take the wrecker ferry ($${r.ferry})`,
  "Wait a day (water may drop)",
  "Get back on the trail",
])}`;
    },
    hunt() {
      setArt("assets/bg/hunt.jpg");
      overlay.innerHTML = "";
      const h = hunt;
      panel.innerHTML = `HUNTING     ammo ${h.ammo} boxes (${h.shots} shots)     bagged ${h.lbs} lbs

Click or SPACE to fire. ESC / ENTER to walk back to the truck.
Don't shoot the truck. Don't shoot Randy.`;
    },
    landmark() {
      const lm = hereLandmark();
      setArt(lm && lm.kind === "end" ? (truck().id === "c10" ? "assets/victory.jpg" : truck().hero) : truck().hero);
      overlay.innerHTML = "";
      panel.innerHTML = `${fmtDate(state.date)}

You have arrived at ${lm.name}.
${lm.talk ? '"' + lm.talk + '"' : ""}

Miles traveled: ${Math.round(state.miles)}

<div class="hint">SPACE to continue</div>`;
    },
    death() {
      const d = DATA.deaths[state.deadCause] || DATA.deaths.stranded;
      if (d.image) {
        setArt(d.image);
        art.style.objectFit = "contain";
      } else {
        setArt(null);
        art.style.objectFit = "cover";
      }
      overlay.innerHTML = "";
      const who = state.deadWho || leader().name;
      if (d.baked) {
        panel.innerHTML = `<div class="hint">SPACE to continue</div>`;
      } else {
        panel.innerHTML = `${who}'s party has died.

${d.line}

You have died of ${d.cause}.

<div class="hint">SPACE to continue</div>`;
      }
    },
    tombstone() {
      setArt(null);
      const d = DATA.deaths[state.deadCause] || DATA.deaths.stranded;
      panel.innerHTML = `You may carve a tombstone.

${state.deadWho || leader().name}
died of ${d.cause}
mile ${Math.round(state.miles)}

Epitaph (type, ENTER to carve):
<span class="good">${tombInput || d.epitaph}</span>_

<div class="hint">ENTER to carve   ·   ESC for the default</div>`;
    },
    victory() {
      setArt(truck().id === "c10" ? "assets/victory.jpg" : truck().hero);
      art.style.objectFit = truck().id === "c10" ? "contain" : "cover";
      overlay.innerHTML = "";
      const d = DATA.deaths[state.deadCause];
      panel.innerHTML = `${leader().name.toUpperCase()} ${truck().spec.split("·")[0].trim().toUpperCase()} SURVIVED THE TRAIL

Oregon City, ${fmtDate(state.date)}
Miles: ${Math.round(state.miles)}
Survivors: ${alive().map((p) => p.name).join(", ")}
Score: ${state.score}

The mud hole accepts you.

<div class="hint">SPACE to carve it into the granite</div>`;
    },
    scores() {
      setArt("assets/victory.jpg");
      overlay.innerHTML = `<div class="title">THE CLIBBINS TRAIL</div>`;
      const list = loadScores();
      panel.innerHTML = `<h2>POINTS</h2>` +
        (list.length
          ? list
              .slice(0, 8)
              .map((s, i) => `${i + 1}. ${s.name.padEnd(12)} ${String(s.score).padStart(5)}   ${s.truck}`)
              .join("\n")
          : "No scores yet.") +
        `\n\n<div class="hint">SPACE for the title</div>`;
    },
  };

  function mapText() {
    const marks = DATA.landmarks.filter((l) => l.kind !== "start");
    const w = 42;
    const pos = Math.round((state.miles / DATA.totalMiles) * w);
    let bar = "".padEnd(w, "·");
    bar = bar.slice(0, pos) + "■" + bar.slice(pos + 1);
    return "MO " + bar + " OR";
  }

  function weatherLabel() {
    return (DATA.weather.find((w) => w.id === state.weather) || DATA.weather[0]).label;
  }

  /* ---------- canvas travel ---------- */
  function drawScene() {
    if (screen === "hunt") {
      drawHunt();
      return;
    }
    if (screen === "map") {
      drawMap();
      return;
    }
    if (screen === "trail" || traveling) {
      drawTrailView();
      return;
    }
    if (screen === "river") {
      ctx.clearRect(0, 0, W, H);
      drawSpriteOnGround(392, 340, 340, Math.sin(travelT * 8) * 2);
      return;
    }
    ctx.clearRect(0, 0, W, H);
  }

  function drawCover(img) {
    if (!imgReady(img)) return false;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const ir = iw / ih;
    const tr = W / H;
    let sx = 0, sy = 0, sw = iw, sh = ih;
    if (ir > tr) {
      sw = ih * tr;
      sx = (iw - sw) / 2;
    } else {
      sh = iw / tr;
      sy = Math.max(0, (ih - sh) * 0.12);
    }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
    return true;
  }

  function travelBg() {
    if (!state) return IM.bg.prairie;
    if (state.miles > 1680 || (state.miles > 900 && state.miles < 1120)) return IM.bg.forest;
    return IM.bg.prairie;
  }

  function drawSpriteOnGround(groundY, x, targetW, bob) {
    const t = (state && truck()) || DATA.trucks[0];
    const img = IM.side[t.id];
    if (!imgReady(img)) {
      drawPixelTruck(x, groundY - 78 + (bob || 0), t);
      return { x, y: groundY - 78, w: targetW, h: 90 };
    }
    const th = img.naturalHeight * (targetW / img.naturalWidth);
    const y = groundY - th + (bob || 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "rgba(0,0,0,0.38)";
    ctx.beginPath();
    ctx.ellipse(x + targetW * 0.52, groundY - 3, targetW * 0.4, 11, 0, 0, 7);
    ctx.fill();
    ctx.drawImage(img, x, y, targetW, th);
    return { x, y, w: targetW, h: th };
  }

  function skyColor() {
    const w = state ? state.weather : "fair";
    if (w === "storm" || w === "rain") return ["#4a5a6a", "#7a8790"];
    if (w === "snow" || w === "blizzard" || w === "cold") return ["#8aa0b8", "#d0d8e0"];
    if (w === "hot") return ["#3a7cc8", "#f2d48a"];
    return ["#2d6db4", "#8ec4ee"];
  }

  function drawTrailView() {
    const t = travelT;
    ctx.imageSmoothingEnabled = false;
    if (!drawCover(travelBg())) {
      const [top, bot] = skyColor();
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, top);
      g.addColorStop(1, bot);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#c4a24a";
      ctx.fillRect(0, 250, W, H - 250);
      ctx.fillStyle = "#7a5a3a";
      ctx.fillRect(0, 330, W, 58);
    }

    const wth = state && state.weather;
    if (wth === "storm" || wth === "rain") {
      ctx.fillStyle = "rgba(30,40,55,0.22)";
      ctx.fillRect(0, 0, W, H);
    }
    if (wth === "snow" || wth === "blizzard" || wth === "cold") {
      ctx.fillStyle = "rgba(200,215,230,0.18)";
      ctx.fillRect(0, 0, W, H);
    }
    if (wth === "hot") {
      ctx.fillStyle = "rgba(255,180,60,0.08)";
      ctx.fillRect(0, 0, W, H);
    }

    const bob = traveling ? Math.sin(t * 14) * 3 : 0;
    const groundY = 372;
    const box = drawSpriteOnGround(groundY, 520, 430, bob);

    if (traveling) {
      ctx.fillStyle = "rgba(170,150,110,0.4)";
      for (let i = 0; i < 10; i++) {
        const dx = box.x - 12 - ((t * 160 + i * 22) % 90);
        const dy = groundY - 8 - (i % 4) * 4;
        ctx.fillRect(dx, dy, 10, 3);
      }
    }

    if (state && state.miles > 1700) {
      ctx.fillStyle = "#2f6a28";
      for (let i = 0; i < 8; i++) {
        const x = (i * 160 + t * 180) % (W + 40);
        ctx.fillRect(x, groundY - 8, 50, 6);
      }
    }

    if (wth === "rain" || wth === "storm") {
      ctx.strokeStyle = "rgba(180,200,220,0.5)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 50; i++) {
        const x = (i * 47 + t * 320) % W;
        const y = (i * 73 + t * 420) % H;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 4, y + 12);
        ctx.stroke();
      }
    }
    if (wth === "snow" || wth === "blizzard") {
      ctx.fillStyle = "#fff";
      for (let i = 0; i < 60; i++) {
        const x = (i * 53 + t * 40) % W;
        const y = (i * 89 + t * 90) % H;
        ctx.fillRect(x, y, 2, 2);
      }
    }
  }

  function cloud(x, y, s) {
    ctx.beginPath();
    ctx.ellipse(x, y, s, s * 0.45, 0, 0, 7);
    ctx.ellipse(x + s * 0.5, y - 8, s * 0.6, s * 0.4, 0, 0, 7);
    ctx.fill();
  }
  function mountain(x, base, h, snow) {
    ctx.beginPath();
    ctx.moveTo(x - h, base);
    ctx.lineTo(x, base - h);
    ctx.lineTo(x + h, base);
    ctx.closePath();
    ctx.fill();
    if (snow) {
      ctx.beginPath();
      ctx.moveTo(x - h * 0.25, base - h * 0.75);
      ctx.lineTo(x, base - h);
      ctx.lineTo(x + h * 0.25, base - h * 0.75);
      ctx.closePath();
      ctx.fill();
    }
  }
  function drawWagon(x, y) {
    ctx.fillStyle = "#c8b48a";
    ctx.fillRect(x, y - 18, 46, 18);
    ctx.fillStyle = "#6a4a28";
    ctx.beginPath();
    ctx.ellipse(x + 23, y - 28, 22, 16, 0, 3.14, 0, true);
    ctx.fill();
    ctx.fillStyle = "#222";
    ctx.beginPath();
    ctx.arc(x + 8, y + 4, 6, 0, 7);
    ctx.arc(x + 38, y + 4, 6, 0, 7);
    ctx.fill();
    ctx.fillStyle = "#8a6a3a";
    ctx.fillRect(x - 28, y - 10, 28, 8);
    ctx.fillStyle = "#5a3a18";
    ctx.fillRect(x - 40, y - 16, 10, 16);
    ctx.fillRect(x - 22, y - 16, 10, 16);
  }

  function drawPixelTruck(x, y, t) {
    const c = t.color;
    const s = 3;
    const px = (dx, dy, w, h, col) => {
      ctx.fillStyle = col;
      ctx.fillRect(x + dx * s, y + dy * s, w * s, h * s);
    };
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(x + 8, y + 78, 250, 12);
    px(8, 22, 44, 22, c.body);
    px(8, 36, 44, 10, c.two);
    px(50, 6, 42, 32, c.roof);
    px(54, 10, 14, 12, "#8fd0ee");
    px(70, 10, 14, 12, "#8fd0ee");
    px(50, 32, 44, 14, c.two);
    px(90, 18, 30, 26, c.body);
    px(112, 34, 10, 10, "#d8d8d8");
    px(94, 20, 18, 8, "#1a1a1a");
    px(116, 40, 8, 8, "#ececec");
    px(4, 40, 8, 8, "#ececec");
    px(18, 44, 14, 14, "#111");
    px(22, 48, 6, 6, "#888");
    px(88, 44, 14, 14, "#111");
    px(92, 48, 6, 6, "#888");
    if (t.id === "lb7" || t.id === "suburban") {
      px(36, 44, 14, 14, "#111");
      px(40, 48, 6, 6, "#888");
    }
    if (c.stacks) {
      px(62, -16, 4, 24, "#cfd3d6");
      px(70, -16, 4, 24, "#cfd3d6");
    }
    px(116, 24, 5, 4, "#e8a030");
    px(8, 24, 4, 4, "#c04040");
  }

  function drawMap() {
    ctx.fillStyle = "#0c1a10";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "#c8b070";
    ctx.lineWidth = 3;
    ctx.beginPath();
    const pts = DATA.landmarks.map((l, i) => {
      const x = 60 + (l.mile / DATA.totalMiles) * (W - 120);
      const y = 80 + Math.sin(i * 0.7) * 50 + (i % 3) * 30;
      return [x, y, l];
    });
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.stroke();
    ctx.font = '8px "Press Start 2P"';
    pts.forEach(([x, y, l], i) => {
      const here = state && Math.abs(l.mile - state.miles) < 40;
      ctx.fillStyle = here ? "#7cff6b" : "#e8e0c0";
      ctx.fillRect(x - 4, y - 4, 8, 8);
      if (here || l.kind === "end" || l.kind === "start" || i % 2 === 0) {
        const label = (l.name.length > 16 ? l.name.split(" ")[0] : l.name).toUpperCase();
        ctx.fillText(label, Math.max(8, x - 28), y + (i % 2 ? 22 : -12));
      }
    });
    if (state) {
      const x = 60 + (state.miles / DATA.totalMiles) * (W - 120);
      ctx.fillStyle = "#ff6b5a";
      ctx.fillRect(x - 6, 40, 12, 12);
      ctx.fillText("YOU", x - 18, 34);
    }
  }

  /* ---------- hunt ---------- */
  function startHunt() {
    if (state.inv.ammo <= 0) {
      toast = "No ammo.";
      toastT = 2;
      go("trail");
      return;
    }
    hunt = {
      ammo: state.inv.ammo,
      shots: state.inv.ammo * 5,
      lbs: 0,
      animals: [],
      t: 0,
      flash: 0,
      over: false,
      photo: [
        { id: "deer", x: 600, y: 210, r: 88, lbs: 80, dead: false },
        { id: "turkey", x: 800, y: 260, r: 70, lbs: 12, dead: false },
      ],
      truckBox: null,
    };
    go("hunt");
  }
  function spawnAnimal() {
    const a = pick(DATA.animals);
    hunt.animals.push({
      ...a,
      x: W + 40,
      y: 200 + Math.random() * 110,
      vx: -a.speed * (1.2 + Math.random()),
      hp: a.hp,
      dead: 0,
    });
  }
  function drawHunt() {
    ctx.clearRect(0, 0, W, H);
    if (!hunt) return;
    ctx.imageSmoothingEnabled = false;
    hunt.truckBox = drawSpriteOnGround(360, 16, 300, 0);
    if (hunt.flash > 0) {
      ctx.fillStyle = `rgba(255,255,220,${hunt.flash})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
  function shoot() {
    if (!hunt || hunt.shots <= 0 || hunt.over) {
      blip(110, 0.1, "sawtooth", 0.03);
      return;
    }
    hunt.shots--;
    if (hunt.shots % 5 === 0) hunt.ammo = Math.max(0, hunt.ammo - 1);
    hunt.flash = 0.6;
    blip(180, 0.05, "square", 0.06);
    const hx = mouse.x;
    const hy = mouse.y;
    const tb = hunt.truckBox;
    if (tb && hx > tb.x && hx < tb.x + tb.w && hy > tb.y && hy < tb.y + tb.h) {
      state.engine -= 8;
      toast = "You shot the truck, hoss.";
      toastT = 3;
      blip(90, 0.2, "sawtooth", 0.05);
      return;
    }
    const photo = hunt.photo.find((p) => !p.dead && Math.hypot(p.x - hx, p.y - hy) < p.r);
    if (photo) {
      photo.dead = true;
      hunt.lbs += photo.lbs;
      blip(520, 0.08, "square", 0.04);
      return;
    }
    let hit = null;
    let best = 999;
    hunt.animals.forEach((a) => {
      if (a.dead) return;
      const dx = a.x - hx;
      const dy = a.y - a.h / 2 - hy;
      const d = Math.hypot(dx, dy);
      if (d < 56 && d < best) {
        best = d;
        hit = a;
      }
    });
    if (hit) {
      hit.hp--;
      if (hit.hp <= 0) {
        hit.dead = 0.01;
        hunt.lbs += hit.lbs;
        blip(520, 0.08, "square", 0.04);
      }
    } else {
      hunt.animals.forEach((a) => {
        if (!a.dead) a.vx *= 1.25;
      });
    }
  }
  function endHunt() {
    state.inv.ammo = hunt.ammo;
    state.inv.food += hunt.lbs;
    const got = hunt.lbs;
    hunt = null;
    document.body.classList.remove("hunt");
    cross.hidden = true;
    eventObj = {
      text:
        got > 0
          ? `You bagged ${got} lbs of meat and dragged it to the bed.\n${got > 150 ? "The 4L60 felt that." : "The coyotes are disappointed."}`
          : "You return empty-handed. The prairie keeps its own counsel.",
      image: "assets/bg/hunt.jpg",
    };
    go("event");
  }

  /* ---------- simulation ---------- */
  function rollWeather() {
    const m = month();
    let bag;
    if (m >= 10 || m <= 1) bag = ["cold", "cold", "snow", "fair", "blizzard", "cool"];
    else if (m >= 5 && m <= 7) bag = ["hot", "hot", "fair", "fair", "storm", "rain"];
    else bag = ["fair", "fair", "cool", "rain", "storm", "hot"];
    if (state.miles > 1700 && Math.random() < 0.25) bag.push("rain", "rain");
    state.weather = pick(bag);
  }

  function dayWear(opts) {
    const resting = !!(opts && opts.rest);
    const pace = DATA.paces[state.pace];
    const ration = DATA.rations[state.rations];
    const t = truck();
    const occ = occupation();
    const n = Math.max(1, alive().length);

    // food
    const eat = ration.lbs * n;
    state.inv.food = Math.max(0, state.inv.food - eat);
    if (state.inv.food <= 0) {
      alive().forEach((p) => (p.hp -= 10));
    } else {
      alive().forEach((p) => (p.hp = clamp(p.hp + ration.health, 1, 100)));
    }

    // beer morale
    if (state.inv.beer > 0 && Math.random() < 0.08) {
      state.inv.beer--;
      alive().forEach((p) => (p.hp = clamp(p.hp + 4, 1, 100)));
    }

    // fuel — resting or waiting does not burn a highway day's worth
    const mpg = t.mpg * (overweight() ? 0.78 : 1) * (state.weather === "snow" ? 0.85 : 1);
    const gallons = resting ? 0.4 : pace.miles / mpg;
    state.inv.fuel = Math.max(0, state.inv.fuel - gallons);

    // wear
    let wear = 1.1 * pace.wear * (overweight() ? 1.35 : 1);
    if (t.id === "gmt800") wear *= 1.35;
    if (t.id === "c10") wear *= 0.55;
    if (state.weather === "hot") wear *= 1.15;
    const onPass = state.miles > 900 && state.miles < 1000 || state.miles > 1780 && state.miles < 1920;
    if (onPass) wear *= 1.6;
    state.trans = Math.max(0, state.trans - wear * (0.35 + Math.random() * 0.5));
    state.engine = Math.max(0, state.engine - wear * 0.18);
    state.tires = Math.max(0, state.tires - wear * 0.12);

    // health statuses
    alive().forEach((p) => {
      if (p.hp > 80) p.status = "good";
      else if (p.hp > 55) p.status = "fair";
      else if (p.hp > 30) p.status = "poor";
      else p.status = "very poor";
      if (state.weather === "blizzard" || state.weather === "cold") p.hp -= 2;
      if (month() >= 10) p.hp -= 1.5;
    });

    state.date.setDate(state.date.getDate() + 1);
  }

  function canMove() {
    if (!alive().length) return "dead";
    if (leader().hp <= 0) return "leader";
    if (state.inv.fuel <= 0) return "fuel";
    if (state.trans <= 0) return "trans";
    if (state.engine <= 0) return "engine";
    return null;
  }

  function kill(cause, who) {
    traveling = false;
    state.deadCause = cause;
    state.deadWho = who || leader().name;
    const victim = state.party.find((p) => p.name === state.deadWho) || leader();
    victim.hp = 0;
    victim.status = "dead";
    if (leader().hp <= 0 || alive().length === 0) {
      go("death");
    } else {
      eventObj = {
        text: `${state.deadWho} has died of ${(DATA.deaths[cause] || {}).cause || cause}.\nThe rest of the party keeps driving.`,
        image: (DATA.deaths[cause] || {}).image,
      };
      state.deadCause = null;
      go("event");
    }
  }

  function pickEvent() {
    const t = truck();
    const pool = [];
    const add = (w, fn) => pool.push({ w, fn });

    add(8, evCheckEngine);
    add(6, evFlat);
    add(5, evIllness);
    add(4, evTalkTomb);
    add(3, evTrade);
    add(8, evJob);
    add(state.inv.fuel < 14 ? 14 : 6, evGas);
    add(3, evWeatherTalk);
    add(3, evDeer);

    if (t.id === "gmt800" || state.trans < 50) add(10, evTransSlip);
    if (t.id === "gmt800" && state.trans < 28) add(14, evTransDeath);
    if (t.diesel) add(8, evChargePipe);
    if (state.stands === "harbor" || state.stands === "none") add(6, evNeedRepair);
    if (state.miles > 1700) add(8, evClibbinsWarn);
    if (state.miles > 1850 && (state.weather === "rain" || state.pace === "grinding")) add(10, evClibbinsDeath);
    if (state.inv.food < 40) add(4, evStarving);
    if (month() >= 10) add(4, evCold);
    if (Math.random() < 0.3) add(3, evBattery);
    if (state.inv.food > 0) add(2, evTaquito);
    add(2, evUjoint);
    add(2, evCatStolen);
    add(2, evRadiator);

    const total = pool.reduce((s, p) => s + p.w, 0);
    let r = Math.random() * total;
    for (const p of pool) {
      r -= p.w;
      if (r <= 0) return p.fn();
    }
    return null;
  }

  function showEvent(e) {
    traveling = false;
    eventObj = e;
    go("event");
  }

  function evCheckEngine() {
    state.engine -= 6;
    return {
      text: "The check-engine light has been on since Kansas. It is now blinking, which is rude.",
    };
  }
  function evFlat() {
    state.tires -= 20;
    const choices = [
      {
        label: "Put on the spare and keep moving",
        fn: () => {
          state.tires = Math.min(100, state.tires + 30);
          if (Math.random() < 0.08) return kill("tire");
          resumeTrail("You change the tire. The lug nuts were on there with feelings.");
        },
      },
      {
        label: "Aire it up with the pancake compressor and pray",
        fn: () => {
          if (Math.random() < 0.18) return kill("tire");
          state.tires += 10;
          resumeTrail("It holds. For now.");
        },
      },
    ];
    return { text: "You have blown a tire on a rusted rim.", choices };
  }
  function evIllness() {
    const p = pick(alive());
    p.hp -= 18;
    p.status = "poor";
    if (p.hp <= 0) return (kill("dysentery", p.name), null);
    return { text: `${p.name} has a situation involving a gas-station taquito. Health is poor.` };
  }
  function evTaquito() {
    const p = pick(alive());
    p.hp -= 25;
    if (p.hp <= 0) return (kill("dysentery", p.name), null);
    return { text: `${p.name} ate a roller-grill taquito at a Sinclair. You have dysentery at home.` };
  }
  function evTalkTomb() {
    const g = pick(loadGraves().concat([{ name: "Devin", cause: "a jack stand failure", epitaph: "trusted the orange ones", miles: Math.round(state.miles - 20) }]));
    return { text: `You find a tombstone beside the road.\n\n${g.name}\n"${g.epitaph}"\ndied of ${g.cause}` };
  }
  function evTrade() {
    const tr = pick(DATA.npcTrades);
    eventObj = tr;
    traveling = false;
    go("trade");
    return null;
  }
  function evGas() {
    const offers = [
      { text: "A Sinclair with one pump and a handwritten sign. 12 gallons for $24.", gal: 12, cost: 24 },
      { text: "Sealed jerry cans in a ditch. Somebody's loss. +8 gal.", gal: 8, cost: 0 },
      { text: "A farmer will fill you from the tank behind the barn for $15. +10 gal.", gal: 10, cost: 15 },
      { text: "A tanker driver will spare 15 gallons for $30 if you don't ask questions.", gal: 15, cost: 30 },
      { text: "A locked ranch pump. The key is in the visor. +10 gal.", gal: 10, cost: 0 },
      { text: "A wrecker with a transfer tank. 8 gallons for $16.", gal: 8, cost: 16 },
    ];
    const o = pick(offers);
    if (o.cost <= 0) {
      invAdd("fuel", o.gal);
      return { text: o.text };
    }
    return {
      text: o.text,
      choices: [
        {
          label: `Fill up ($${o.cost}, +${o.gal} gal)`,
          fn: () => {
            if (state.money < o.cost) {
              resumeTrail("You count the glovebox and come up short.");
              return;
            }
            state.money -= o.cost;
            invAdd("fuel", o.gal);
            resumeTrail(`The pump knocks. +${o.gal} gal.`);
          },
        },
        { label: "Keep the cash", fn: () => resumeTrail("You roll on thirsty.") },
      ],
    };
  }
  function evJob() {
    const j = pick(DATA.jobs);
    return {
      text: j.text,
      image: "assets/store.jpg",
      choices: [
        { label: `Help ($${j.pay})`, fn: () => doJob(j) },
        { label: "Keep rolling", fn: () => resumeTrail("You leave them on the shoulder. That's a choice.") },
      ],
    };
  }
  function doJob(j, next) {
    if (j.fuel && invGet("fuel") < j.fuel) {
      resumeTrail("You're too light on fuel to help.", next);
      return;
    }
    if (j.under) {
      if (state.stands === "none" && Math.random() < 0.32) return kill("floorjack");
      const fail = stands().fail * 0.65;
      if (Math.random() < fail) return kill(truck().id === "suburban" ? "suburban" : "jackstands");
    }
    if (j.batteryRisk && Math.random() < j.batteryRisk) return kill("battery");
    if (j.fuel) invAdd("fuel", -j.fuel);
    if (j.days) {
      for (let i = 0; i < j.days; i++) dayWear({ rest: true });
    }
    if (j.food) invAdd("food", j.food);
    if (j.fuelPay) invAdd("fuel", j.fuelPay);
    state.money += j.pay;
    resumeTrail(j.ok, next);
  }
  function offerWork() {
    if (Math.random() < 0.28) {
      resumeTrail("Nobody needs a wrench today. Try the next town.", "outpost");
      return;
    }
    const j = pick(DATA.jobs);
    eventObj = {
      text: j.text,
      next: "outpost",
      image: "assets/store.jpg",
      choices: [
        { label: `Help ($${j.pay})`, fn: () => doJob(j, "outpost") },
        { label: "Not this one", fn: () => go("outpost") },
      ],
    };
    go("event");
  }
  function evWeatherTalk() {
    rollWeather();
    return { text: `Weather turns ${weatherLabel()}. The prairie does not care about your schedule.` };
  }
  function evDeer() {
    state.engine -= 4;
    return { text: "A mule deer tests the bumper. The bumper passes. The deer does not. +40 lbs food." , after: () => (state.inv.food += 40) };
  }
  function evTransSlip() {
    state.trans -= 8;
    if (state.inv.atf > 0) {
      return {
        text: "She slipped in second. The 4L60 is talking to you.",
        choices: [
          {
            label: "Dump a quart of ATF in and pretend that is a rebuild",
            fn: () => {
              state.inv.atf--;
              state.trans = Math.min(truck().transMax, state.trans + 10);
              resumeTrail("The dipstick looks less like a murder scene.");
            },
          },
          {
            label: "Keep hammering. She'll be fine.",
            fn: () => {
              state.trans -= 10;
              if (state.trans <= 5 && truck().id === "gmt800") return kill("4l60");
              resumeTrail("Second gear is now a rumor.");
            },
          },
        ],
      };
    }
    return { text: "She slipped in second. You are out of ATF. The trail gets quieter, then louder." };
  }
  function evTransDeath() {
    return {
      text: "The 4L60 has been crying since South Pass. Second gear is a coin flip.",
      choices: [
        {
          label: "Try to limp it in second anyway",
          fn: () => kill("4l60"),
        },
        {
          label: "Stop and try to drop the pan (needs parts + jack stands)",
          fn: () => attemptRepair("trans"),
        },
      ],
    };
  }
  function evChargePipe() {
    if (Math.random() < 0.35) return (kill("truckasaurus"), null);
    state.engine -= 20;
    return {
      text: "A charge air pipe lets go. It sounded like a shotgun. Everyone's heart stopped, then started, mostly.",
    };
  }
  function evNeedRepair() {
    return {
      text: "Something is leaking. You will have to get under the truck.",
      choices: [
        { label: "Crawl under it", fn: () => attemptRepair("leak") },
        { label: "Keep driving until it gets worse", fn: () => { state.engine -= 12; resumeTrail("It gets worse."); } },
      ],
    };
  }
  function evClibbinsWarn() {
    return { text: "Clibbins on the grade. Grass clippings, wet, the whole meme. Slow down, hoss." };
  }
  function evClibbinsDeath() {
    if (state.pace === "easy") {
      return { text: "You hit a patch of clibbins and the rear steps out. Easy pace saves you. Gobbless." };
    }
    return {
      text: "The shoulder is green and slick. Yew see dem clibbins.",
      choices: [
        { label: "Hammer down anyway", fn: () => kill("clibbins") },
        { label: "Back it down and creep", fn: () => { state.pace = "easy"; resumeTrail("You creep over the clippings like a man who wants to live."); } },
      ],
    };
  }
  function evStarving() {
    if (state.inv.food <= 0 && Math.random() < 0.4) return (kill("starvation"), null);
    return { text: "The crew is hungry. Hunting is no longer a hobby." };
  }
  function evCold() {
    if (month() >= 10 && Math.random() < 0.2) return (kill("winter"), null);
    alive().forEach((p) => (p.hp -= 6));
    return { text: "The heater core was bypassed two states ago. Everyone can see their breath. In the cab." };
  }
  function evBattery() {
    return {
      text: "The truck is dead at a rest stop. Someone left the dome light on. It was Randy.",
      choices: [
        {
          label: "Jump it (watch the polarity, hoss)",
          fn: () => {
            if (Math.random() < 0.12) return kill("battery");
            resumeTrail("It fires. Randy is not allowed near the keys.");
          },
        },
        {
          label: "Push-start it down the grade",
          fn: () => {
            if (!truck().fourby && Math.random() < 0.2) return kill("clibbins");
            resumeTrail("It fires on the roll. Educational software does not recommend this.");
          },
        },
      ],
    };
  }
  function evUjoint() {
    state.engine -= 5;
    return {
      text: "A U-joint announces itself. The driveshaft is considering a career as a lawn dart.",
      choices: [
        { label: "Crawl under and grease it", fn: () => attemptRepair("ujoint") },
        { label: "Ignore it like a knock sensor", fn: () => { state.trans -= 8; resumeTrail("The vibration is now a personality."); } },
      ],
    };
  }
  function evCatStolen() {
    state.money = Math.max(0, state.money - 40);
    return { text: "Someone stole the catalytic converter in the night. You have lost $40 of scrap and all of your faith in Fort Hall." };
  }
  function evRadiator() {
    return {
      text: "She's running hot. The needle is in the place the needle is not supposed to be.",
      choices: [
        { label: "Open the cap right now", fn: () => kill("radiator") },
        { label: "Wait, then add water if you have any beer left to sacrifice", fn: () => {
          if (state.inv.beer > 0) state.inv.beer--;
          state.engine = Math.min(100, state.engine + 8);
          resumeTrail("You wait. You add liquid. You live. Barely a story.");
        } },
      ],
    };
  }

  function attemptRepair(kind) {
    const fail = stands().fail * (occupation().wisdom < 0.4 ? 1.25 : 0.85);
    const dirt = 1;
    if (state.stands === "none") {
      if (Math.random() < 0.45) return kill("floorjack");
    }
    if (Math.random() < fail * dirt) {
      if (truck().id === "suburban") return kill("suburban");
      return kill("jackstands");
    }
    if (state.inv.parts > 0) {
      state.inv.parts--;
      if (kind === "trans") state.trans = Math.min(truck().transMax, state.trans + 28);
      else state.engine = Math.min(100, state.engine + 16);
      if (state.inv.blaster > 0 && Math.random() < 0.3) state.inv.blaster--;
      resumeTrail("You get under it. The stands hold. You fix what you can and crawl out a believer.");
    } else {
      state.engine += 4;
      resumeTrail("No parts. You tighten what's reachable and spray PB Blaster as a sacrament.");
    }
  }

  function resumeTrail(msg, next) {
    toast = msg;
    toastT = 4;
    eventObj = { text: msg, next: next || "trail" };
    go("event");
  }

  function startTravel() {
    const pending = nextLandmark();
    if (pending && state.miles + 0.05 >= pending.mile && !state.visited.includes(pending.mile) && pending.mile > 0) {
      arrive(pending);
      return;
    }
    const stuck = canMove();
    if (stuck === "fuel") {
      showEvent({
        text: "You are out of fuel on the shoulder. The gauge has been lying to you for twenty miles.",
        choices: [
          {
            label: "Flag a trucker ($20 for 10 gal)",
            fn: () => {
              if (state.money < 20) {
                resumeTrail("He looks at your empty wallet and keeps rolling.");
                return;
              }
              state.money -= 20;
              invAdd("fuel", 10);
              resumeTrail("A reefer driver dumps 10 gallons into your tank. +10 gal.");
            },
          },
          {
            label: "Siphon a parked dually",
            fn: () => {
              invAdd("fuel", 8);
              if (Math.random() < 0.12) {
                state.money = Math.max(0, state.money - 30);
                resumeTrail("You get 8 gallons and a lecture. He takes $30 for the trouble.");
              } else {
                resumeTrail("You siphon 8 gallons. Educational software does not endorse this.");
              }
            },
          },
          {
            label: "Walk to a Sinclair (lose a day, $18 for 12 gal)",
            fn: () => {
              dayWear({ rest: true });
              if (state.money >= 18) {
                state.money -= 18;
                invAdd("fuel", 12);
                resumeTrail("You walk back with 12 gallons and blisters. +12 gal.");
              } else {
                invAdd("fuel", 4);
                resumeTrail("They take pity. Four gallons in a milk jug. +4 gal.");
              }
            },
          },
        ],
      });
      return;
    }
    if (stuck === "trans") {
      showEvent({
        text: "The transmission is done. It is a paperweight that used to be a 4L60.",
        choices: [
          { label: "Get under it and try anyway", fn: () => attemptRepair("trans") },
          { label: "Sit here until someone with a wrecker finds you", fn: () => {
            if (Math.random() < 0.5) kill("stranded");
            else {
              state.money = Math.max(0, state.money - 80);
              state.trans = 20;
              resumeTrail("A wrecker drops a junkyard trans in. It costs $80 and smells like a barn.");
            }
          } },
        ],
      });
      return;
    }
    if (stuck === "engine") {
      kill("stranded");
      return;
    }
    if (stuck === "leader" || stuck === "dead") {
      kill(state.deadCause || "starvation");
      return;
    }
    traveling = true;
    go("trail");
  }

  function tickTravel(dt) {
    if (!traveling) return;
    const pace = DATA.paces[state.pace];
    const dayMs = 0.55;
    travelT += dt;
    songTimer += dt;
    if (audioOn && songTimer > 0.22) {
      songTimer = 0;
      blip(SONG[songI % SONG.length], 0.12, "square", 0.025);
      songI++;
    }

    // accumulate to a day
    tickTravel._acc = (tickTravel._acc || 0) + dt;
    if (tickTravel._acc < dayMs) return;
    tickTravel._acc = 0;

    rollWeather();
    const miles = pace.miles * (state.weather === "blizzard" ? 0.4 : state.weather === "storm" ? 0.7 : 1);
    const lm = nextLandmark();
    const step = Math.min(miles, lm.mile - state.miles);
    state.miles += step;
    dayWear();

    // deaths from hp
    for (const p of state.party) {
      if (p.hp <= 0 && p.status !== "dead") {
        p.status = "dead";
        traveling = false;
        if (p === leader()) {
          const cause = state.inv.food <= 0 ? "starvation" : month() >= 10 ? "winter" : "dysentery";
          kill(cause, p.name);
          return;
        }
        showEvent({ text: `${p.name} has died. The truck has an extra seat and a worse mood.` });
        return;
      }
    }

    if (state.miles >= DATA.totalMiles - 0.1) {
      traveling = false;
      win();
      return;
    }

    if (state.miles + 0.05 >= lm.mile) {
      state.miles = lm.mile;
      traveling = false;
      arrive(lm);
      return;
    }

    if (screen === "trail") renders.trail();

    if (Math.random() < 0.22 + (state.pace === "grinding" ? 0.08 : 0)) {
      const e = pickEvent();
      if (e) {
        traveling = false;
        if (e.after) e.after();
        showEvent(e);
        return;
      }
    }
  }

  function arrive(lm) {
    if (lm.kind === "end") {
      markLandmark(lm);
      win();
      return;
    }
    if (lm.kind === "river" || lm.kind === "clibbins") {
      river = {
        name: lm.name,
        width: irand(80, 280),
        depth: irand(lm.depth ? lm.depth[0] : 3, lm.depth ? lm.depth[1] : 8),
        current: pick(["slow", "moderate", "fast", "mean"]),
        ferry: lm.kind === "clibbins" ? irand(35, 55) : irand(18, 40),
        mile: lm.mile,
      };
      go("river");
      return;
    }
    markLandmark(lm);
    if (lm.kind === "shop" || lm.kind === "fort") {
      openOutpost(lm);
      return;
    }
    go("landmark");
  }

  function doRiver(choice) {
    const r = river;
    const t = truck();
    const depth = r.depth;
    if (choice === 4) {
      go("trail");
      return;
    }
    if (choice === 3) {
      dayWear({ rest: true });
      river.depth = clamp(depth + irand(-2, 1), 1, 12);
      river.current = pick(["slow", "moderate", "slow", "moderate"]);
      if (!river.ferry) river.ferry = irand(18, 40);
      toast = "The water drops a little. The ferry is still running.";
      toastT = 3;
      render();
      return;
    }
    if (choice === 2) {
      if (!r.ferry) {
        river.ferry = irand(18, 40);
        toast = "A wrecker with a barge rolls up. Ferry is $" + river.ferry + ".";
        toastT = 3;
        render();
        return;
      }
      if (state.money < r.ferry) {
        toast = "Not enough cash.";
        toastT = 2;
        render();
        return;
      }
      state.money -= r.ferry;
      markLandmark({ mile: r.mile });
      river = null;
      resumeTrail("The wrecker ferry takes you across. Dignity: low. Survival: high.");
      return;
    }
    if (choice === 1) {
      const chance = 0.55 + (depth > 6 ? 0.25 : 0);
      if (Math.random() < chance) {
        markLandmark({ mile: r.mile });
        river = null;
        kill("drowning");
        return;
      }
      markLandmark({ mile: r.mile });
      river = null;
      resumeTrail("The contractor bags hold. You will never tell the dealership.");
      return;
    }
    // ford — still dumb, just not a coin flip
    let risk = 0.04 + depth * 0.025;
    if (r.current === "fast" || r.current === "mean") risk += 0.08;
    if (!t.fourby) risk += 0.1;
    if (overweight()) risk += 0.06;
    if (state.pace === "grinding") risk += 0.05;
    if (t.id === "c10") risk += 0.04;
    if (Math.random() < risk) {
      markLandmark({ mile: r.mile });
      river = null;
      if (Math.random() < 0.5) kill("drowning");
      else {
        state.inv.food = Math.max(0, state.inv.food - 80);
        state.inv.fuel = Math.max(0, state.inv.fuel - 8);
        state.engine -= 15;
        resumeTrail("You stall mid-crossing. You get out. You lose food, fuel, and a little of your soul.");
      }
      return;
    }
    markLandmark({ mile: r.mile });
    river = null;
    resumeTrail("You ford it. Water up the doors. The floor mats will never be dry again.");
  }

  function win() {
    traveling = false;
    state.miles = DATA.totalMiles;
    const occ = occupation();
    const survivors = alive().length;
    let score = 400 * survivors + Math.round(state.inv.food) + Math.round(state.money) + Math.round(state.trans) * 2;
    if (state.stands === "good") score += 80;
    if (truck().id === "c10") score += 120;
    if (truck().id === "gmt800") score += 200;
    score *= occ.scoreMult;
    state.score = score;
    saveScore();
    go("victory");
  }

  function saveScore() {
    const list = loadScores();
    list.unshift({
      name: leader().name,
      score: state.score,
      truck: truck().name,
      date: Date.now(),
    });
    localStorage.setItem("clibbins-scores", JSON.stringify(list.slice(0, 20)));
  }
  function loadScores() {
    try {
      return JSON.parse(localStorage.getItem("clibbins-scores") || "[]");
    } catch {
      return [];
    }
  }
  function saveGrave(epitaph) {
    const d = DATA.deaths[state.deadCause] || DATA.deaths.stranded;
    const list = loadGraves();
    list.push({
      name: state.deadWho || leader().name,
      cause: d.cause,
      epitaph: epitaph || d.epitaph,
      miles: Math.round(state.miles),
    });
    localStorage.setItem("clibbins-graves", JSON.stringify(list.slice(-40)));
  }
  function loadGraves() {
    try {
      return JSON.parse(localStorage.getItem("clibbins-graves") || "[]");
    } catch {
      return [];
    }
  }

  /* ---------- input ---------- */
  function onKey(e) {
    const k = e.key;
    if (k === "s" && screen === "title") {
      armAudio();
      blip(440, 0.1);
      return;
    }
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "Enter"].includes(k)) e.preventDefault();

    if (screen === "names") {
      if (k === "Enter") {
        go("truck");
        blip(520);
      }
      return;
    }
    if (screen === "tombstone") {
      if (k === "Escape") {
        saveGrave(null);
        go("scores");
        return;
      }
      if (k === "Enter") {
        saveGrave(tombInput || null);
        go("scores");
        return;
      }
      if (k === "Backspace") {
        tombInput = tombInput.slice(0, -1);
        render();
        return;
      }
      if (k.length === 1 && tombInput.length < 48) {
        tombInput += k;
        render();
      }
      return;
    }
    if (screen === "hunt") {
      if (k === " " ) shoot();
      if (k === "Enter" || k === "Escape") endHunt();
      return;
    }
    if (screen === "rest" && k >= "0" && k <= "9") {
      const n = +k;
      if (n === 0) {
        go("trail");
        return;
      }
      for (let i = 0; i < n; i++) {
        dayWear({ rest: true });
        alive().forEach((p) => (p.hp = clamp(p.hp + 6, 1, 100)));
        state.engine = Math.min(100, state.engine + 2);
      }
      resumeTrail(`You rest ${n} day${n > 1 ? "s" : ""}. The crew is slightly less doomed.`);
      return;
    }

    if (k === "ArrowUp") {
      sel -= 1;
      wrapSel();
      blip(280, 0.04);
      render();
      return;
    }
    if (k === "ArrowDown") {
      sel += 1;
      wrapSel();
      blip(260, 0.04);
      render();
      return;
    }

    wrapSel();

    if (screen === "outpost" && (k === "ArrowLeft" || k === "ArrowRight")) {
      if (sel < DATA.store.length) outpostAdjust(k === "ArrowRight" ? "buy" : "sell");
      return;
    }
    if (screen === "store" && (k === "ArrowLeft" || k === "ArrowRight")) {
      if (sel < DATA.store.length) {
        const it = DATA.store[sel];
        const dir = k === "ArrowRight" ? 1 : -1;
        const step = it.id === "food" || it.id === "fuel" ? 5 : 1;
        storeQty[it.id] = clamp(storeQty[it.id] + dir * step, 0, it.max);
        blip(400, 0.04);
        render();
      }
      return;
    }

    if (k === "0" && screen === "trail" && !traveling) {
      sel = 9;
      confirm();
      return;
    }
    if (k >= "1" && k <= "9") {
      sel = +k - 1;
      wrapSel();
      if (screen === "trail" && traveling) {
        traveling = false;
        render();
        return;
      }
      if (["trail", "occupation", "title", "river", "event", "trade", "truck", "stands", "pace", "rations", "outpost"].includes(screen)) {
        confirm();
        return;
      }
      render();
      return;
    }

    if (k === " " || k === "Enter") {
      armAudio();
      if (screen === "trail" && traveling) {
        traveling = false;
        render();
        return;
      }
      confirm();
    }
    if (k === "Escape" && ["supplies", "map", "talk", "pace", "rations", "outpost"].includes(screen)) go("trail");
  }

  function wrapSel() {
    const max = {
      title: 3,
      occupation: DATA.occupations.length,
      truck: DATA.trucks.length,
      stands: DATA.stands.length,
      store: DATA.store.length,
      trail: 9,
      pace: 3,
      rations: 4,
      river: 5,
      trade: 2,
      outpost: DATA.store.length + 2,
      event: eventObj && eventObj.choices ? eventObj.choices.length : 1,
    }[screen];
    if (!max) return;
    if (sel < 0) sel = max - 1;
    if (sel >= max) sel = 0;
  }

  function confirm() {
    blip(520, 0.06);
    switch (screen) {
      case "title":
        if (sel === 0) {
          state = freshState();
          storeQty = null;
          go("intro");
        } else if (sel === 1) go("graves");
        else go("help");
        break;
      case "help":
      case "graves":
        go("title");
        break;
      case "intro":
        go("occupation");
        break;
      case "occupation":
        state.occupation = DATA.occupations[sel].id;
        go("names");
        break;
      case "truck":
        state.truck = DATA.trucks[sel].id;
        go("stands");
        break;
      case "stands":
        state.stands = DATA.stands[sel].id;
        applyOccupationAndTruck();
        go("store");
        break;
      case "store":
        checkout();
        break;
      case "depart":
        go("trail");
        break;
      case "trail":
        trailAction(sel);
        break;
      case "supplies":
      case "map":
      case "talk":
      case "landmark":
        go("trail");
        break;
      case "pace":
        state.pace = Object.keys(DATA.paces)[sel];
        go("trail");
        break;
      case "rations":
        state.rations = Object.keys(DATA.rations)[sel];
        go("trail");
        break;
      case "trade": {
        const tr = eventObj;
        if (sel === 0) {
          const has = (k, v) => (k === "money" ? state.money >= v : invGet(k) >= v);
          const add = (k, v) => {
            if (k === "money") state.money += v;
            else invAdd(k, v);
          };
          const ok = Object.entries(tr.give).every(([k, v]) => has(k, v));
          if (!ok) {
            toast = "You don't have it.";
            toastT = 2;
            go("trail");
            break;
          }
          Object.entries(tr.give).forEach(([k, v]) => add(k, -v));
          Object.entries(tr.take).forEach(([k, v]) => add(k, v));
          resumeTrail("You make the trade.");
        } else go("trail");
        break;
      }
      case "outpost":
        if (sel === DATA.store.length) offerWork();
        else if (sel === DATA.store.length + 1) {
          outpost = null;
          go("trail");
        }
        break;
      case "event":
        if (eventObj && eventObj.choices) {
          const c = eventObj.choices[sel];
          if (c) c.fn();
        } else go(eventObj && eventObj.next ? eventObj.next : "trail");
        break;
      case "river":
        doRiver(sel);
        break;
      case "death":
        tombInput = "";
        go("tombstone");
        break;
      case "victory":
        tombInput = "made the mud hole";
        state.deadCause = null;
        saveGrave("made the mud hole");
        go("scores");
        break;
      case "scores":
        go("title");
        break;
    }
  }

  function checkout() {
    const bill = DATA.store.reduce((s, it) => s + storeQty[it.id] * it.price, 0);
    if (bill > state.money) {
      toast = "Matt will not extend credit.";
      toastT = 3;
      render();
      return;
    }
    state.money -= bill;
    DATA.store.forEach((it) => {
      state.inv[it.id] += storeQty[it.id];
    });
    go("depart");
  }

  function trailAction(i) {
    switch (i) {
      case 0: startTravel(); break;
      case 1: go("supplies"); break;
      case 2: go("map"); break;
      case 3: go("pace"); break;
      case 4: go("rations"); break;
      case 5: go("rest"); render(); break;
      case 6: {
        const here = hereLandmark();
        if (here && (here.kind === "shop" || here.kind === "fort")) {
          openOutpost(here);
        } else {
          eventObj = pick(DATA.npcTrades);
          go("trade");
        }
        break;
      }
      case 7: startHunt(); break;
      case 8: attemptRepair("leak"); break;
      case 9: go("talk"); break;
    }
  }

  /* ---------- mouse ---------- */
  scene.addEventListener("mousemove", (e) => {
    const r = scene.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * W;
    mouse.y = ((e.clientY - r.top) / r.height) * H;
    if (screen === "hunt") {
      cross.style.left = `${e.clientX - r.left}px`;
      cross.style.top = `${e.clientY - r.top}px`;
    }
  });
  scene.addEventListener("mousedown", (e) => {
    if (screen === "hunt") {
      e.preventDefault();
      shoot();
    }
  });
  $("panel").addEventListener("click", (e) => {
    const line = e.target.closest(".menu-line");
    if (!line) return;
    const lines = [...panel.querySelectorAll(".menu-line")];
    sel = lines.indexOf(line);
    confirm();
  });

  window.addEventListener("keydown", onKey);

  /* ---------- loop ---------- */
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    travelT += traveling ? 0 : dt * 0.15;
    if (toastT > 0) toastT -= dt;
    if (hunt && screen === "hunt") {
      hunt.t += dt;
      hunt.flash = Math.max(0, hunt.flash - dt * 4);
      hunt.animals.forEach((a) => {
        if (a.dead) a.dead += dt;
        else {
          a.x += a.vx * 40 * dt;
          if (a.x < -80 || a.x > W + 80) {
            a.x = a.vx > 0 ? -40 : W + 40;
            a.y = 220 + Math.random() * 120;
          }
        }
      });
      hunt.animals = hunt.animals.filter((a) => a.dead < 2);
      if (hunt.t > 40) endHunt();
    }
    if (traveling) tickTravel(dt);
    if (["trail", "map", "hunt", "title"].includes(screen) || traveling) drawScene();
    raf = requestAnimationFrame(frame);
  }

  function fit() {
    const s = Math.min(window.innerWidth / 1116, window.innerHeight / 736);
    $("crt").style.transform = `scale(${s})`;
    $("scale").style.width = `${1116 * s}px`;
    $("scale").style.height = `${736 * s}px`;
  }
  window.addEventListener("resize", fit);
  fit();

  const dieAt = new URLSearchParams(location.search).get("die");
  if (dieAt && DATA.deaths[dieAt]) {
    state = freshState();
    state.occupation = "shade";
    state.truck = "gmt800";
    state.stands = "harbor";
    applyOccupationAndTruck();
    state.miles = 640;
    kill(dieAt);
  } else if (/[?&]skip\b/.test(location.search)) {
    state = freshState();
    state.occupation = "shade";
    const qTruck = new URLSearchParams(location.search).get("truck");
    state.truck = DATA.trucks.some((t) => t.id === qTruck) ? qTruck : "gmt800";
    state.stands = "harbor";
    applyOccupationAndTruck();
    state.inv = { fuel: 32, food: 280, parts: 3, atf: 6, ammo: 4, beer: 1, blaster: 2 };
    if (new URLSearchParams(location.search).get("shop")) {
      openOutpost(DATA.landmarks.find((l) => l.kind === "shop"));
    } else {
      go("trail");
    }
  } else {
    go("title");
  }
  raf = requestAnimationFrame(frame);
})();
