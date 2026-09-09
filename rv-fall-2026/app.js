(() => {
  const qs = (s, r = document) => r.querySelector(s),
    qsa = (s, r = document) => [...r.querySelectorAll(s)];
  const stops = window.RV_STOPS || [],
    itin = window.RV_ITINERARY || [];
  const grid = qs("#stop-grid");
  const esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const storeKey = "rv26activityReviewsV2";
  let activityReviews = {};
  try {
    activityReviews = JSON.parse(localStorage.getItem(storeKey) || "{}") || {};
  } catch {}
  const activityKey = (s, i) => s.id + ":" + i;
  function mapFor(name, stop) {
    return (
      "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent(name + " " + stop)
    );
  }
  function currentRole(a, r) {
    return (r && r.role) || a.who;
  }
  function preview(a, s) {
    return (
      a.image ||
      "https://s.wordpress.com/mshots/v1/" +
        encodeURIComponent(a.url) +
        "?w=1200"
    );
  }
  function renderGrid() {
    grid.innerHTML = stops
      .map(
        (s) =>
          `<article class="stop" data-stop="${esc(s.name)}"><img src="${s.image}" ${s.imageFallback ? `data-fallback="${s.imageFallback}"` : ""} alt="${esc(s.name)}"><div class="pad"><h2>${esc(s.name)}</h2><p class="date">${esc(s.dates)}</p><div class="camp"><b>Campground: ${esc(s.campground.name)}</b><p>${esc(s.campground.note)}</p><a href="${s.campground.url}" target="_blank" rel="noopener">Campground ↗</a><a href="${s.campground.map}" target="_blank" rel="noopener">Map ↗</a></div><div class="acts">${s.activities
            .map((a, i) => {
              const r = activityReviews[activityKey(s, i)] || {};
              return `<button class="act" data-stopid="${s.id}" data-i="${i}"><small>${esc(currentRole(a, r))}</small><b>${esc(a.name)}</b><span>${esc(a.facts)}</span><div class="reviewline">${r.rating ? `<span class="badge">${esc(r.rating)}</span>` : ""}${r.role ? `<span class="badge role">Role: ${esc(r.role)}</span>` : ""}</div></button>`;
            })
            .join(
              "",
            )}</div><div class="vote"><button>😍 Love</button><button>🙂 Maybe</button><button>✂ Skip</button></div></div></article>`,
      )
      .join("");
    bindActivityButtons();
    bindStopVotes();
    qsa(".stop > img").forEach((img) =>
      img.addEventListener("error", () => {
        const fallback = img.dataset.fallback;
        if (fallback && img.src !== fallback) img.src = fallback;
      }),
    );
    drawStopVotes();
  }
  let active = null,
    navigating = false;
  const modal = qs("#modal"),
    box = qs(".box", modal),
    mi = qs("#mi"),
    mw = qs("#mw"),
    mt = qs("#mt"),
    mf = qs("#mf"),
    md = qs("#md"),
    mu = qs("#mu"),
    mm = qs("#mm"),
    ratingControls = qs("#ratingControls"),
    roleControls = qs("#roleControls"),
    savedMsg = qs("#savedMsg");
  const cardNav = document.createElement("div");
  cardNav.className = "card-nav";
  cardNav.innerHTML =
    '<button type="button" id="prevActivity" aria-label="Previous activity">← Previous</button><span id="activityPosition"></span><button type="button" id="nextActivity" aria-label="Next activity">Next →</button>';
  qs(".body", modal).insertBefore(cardNav, qs(".actions", modal));
  const prevActivity = qs("#prevActivity"),
    nextActivity = qs("#nextActivity"),
    activityPosition = qs("#activityPosition");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function go(delta) {
    if (!active || navigating) return;
    const n = active.s.activities.length,
      next = (active.i + delta + n) % n;
    if (reduceMotion) {
      openActivity(active.s.id, next, false);
      return;
    }
    navigating = true;
    box.classList.remove(
      "swipe-in-left",
      "swipe-in-right",
      "swipe-out-left",
      "swipe-out-right",
    );
    box.classList.add(delta > 0 ? "swipe-out-left" : "swipe-out-right");
    setTimeout(() => {
      const stopid = active.s.id;
      openActivity(stopid, next, false);
      box.classList.remove("swipe-out-left", "swipe-out-right");
      box.classList.add(delta > 0 ? "swipe-in-right" : "swipe-in-left");
      setTimeout(() => {
        box.classList.remove("swipe-in-left", "swipe-in-right");
        navigating = false;
      }, 260);
    }, 155);
  }
  prevActivity.addEventListener("click", () => go(-1));
  nextActivity.addEventListener("click", () => go(1));
  let touchStartX = null,
    touchStartY = null,
    touchLastX = null;
  box.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length !== 1) return;
      touchStartX = touchLastX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      box.classList.remove("dragging");
    },
    { passive: true },
  );
  box.addEventListener(
    "touchmove",
    (e) => {
      if (touchStartX === null || e.touches.length !== 1) return;
      const x = e.touches[0].clientX,
        y = e.touches[0].clientY,
        dx = x - touchStartX,
        dy = y - touchStartY;
      touchLastX = x;
      if (Math.abs(dx) > 18 && Math.abs(dx) > Math.abs(dy) * 1.15) {
        box.classList.add("dragging");
        const limited = Math.max(-70, Math.min(70, dx * 0.35));
        box.style.transform = `translateX(${limited}px) rotate(${(limited / 70) * 1.2}deg)`;
        box.style.opacity = String(1 - Math.min(0.16, Math.abs(limited) / 500));
      }
    },
    { passive: true },
  );
  box.addEventListener(
    "touchend",
    (e) => {
      if (touchStartX === null || !e.changedTouches.length) return;
      const dx = e.changedTouches[0].clientX - touchStartX,
        dy = e.changedTouches[0].clientY - touchStartY;
      touchStartX = touchStartY = touchLastX = null;
      box.classList.remove("dragging");
      box.style.transform = "";
      box.style.opacity = "";
      if (Math.abs(dx) >= 55 && Math.abs(dx) > Math.abs(dy) * 1.2)
        go(dx < 0 ? 1 : -1);
    },
    { passive: true },
  );
  function bindActivityButtons() {
    qsa(".act").forEach((b) =>
      b.addEventListener("click", () =>
        openActivity(b.dataset.stopid, +b.dataset.i),
      ),
    );
  }
  function openActivity(stopid, i, focusClose = true) {
    const s = stops.find((x) => x.id === stopid),
      a = s.activities[i],
      k = activityKey(s, i),
      r = activityReviews[k] || {};
    active = { s, a, i, k };
    activityPosition.textContent =
      i + 1 + " of " + s.activities.length + " · " + s.name;
    mi.onerror = () => {
      mi.onerror = null;
      mi.src = s.image;
    };
    mi.src = preview(a, s);
    mi.alt = a.name;
    mw.textContent = currentRole(a, r);
    mt.textContent = a.name;
    mf.textContent = a.facts;
    md.textContent = a.desc;
    mu.href = a.url;
    mm.href = mapFor(a.name, s.name);
    qsa("button", ratingControls).forEach((b) =>
      b.classList.toggle("sel", r.rating === b.dataset.rating),
    );
    roleControls.innerHTML = "";
    const original = a.who.toLowerCase();
    const roleOptions = [];
    if (original.includes("sue")) {
      roleOptions.push(["Shared", "⬆ Promote to shared"]);
      roleOptions.push([a.who, "Keep as Sue option"]);
    } else {
      roleOptions.push(["Sue daytime", "☀ Make a Sue workday option"]);
      roleOptions.push([a.who, "Keep as shared"]);
    }
    roleOptions.forEach(([val, label]) => {
      const b = document.createElement("button");
      b.textContent = label;
      b.dataset.role = val;
      b.classList.toggle("sel", r.role === val);
      b.addEventListener("click", () => {
        const rr = activityReviews[k] || {};
        rr.role = rr.role === val ? null : val;
        activityReviews[k] = rr;
        localStorage.setItem(storeKey, JSON.stringify(activityReviews));
        savedMsg.textContent = "Saved for future visits.";
        openActivity(stopid, i, false);
        drawActivitySummary();
        renderGrid();
      });
      roleControls.appendChild(b);
    });
    savedMsg.textContent = r.rating || r.role ? "Saved review loaded." : "";
    modal.classList.add("open");
    if (focusClose) qs("#mc").focus();
  }
  qsa("button", ratingControls).forEach((b) =>
    b.addEventListener("click", () => {
      if (!active) return;
      const rr = activityReviews[active.k] || {};
      rr.rating = rr.rating === b.dataset.rating ? null : b.dataset.rating;
      activityReviews[active.k] = rr;
      localStorage.setItem(storeKey, JSON.stringify(activityReviews));
      savedMsg.textContent = "Saved for future visits.";
      openActivity(active.s.id, active.i, false);
      drawActivitySummary();
      renderGrid();
    }),
  );
  function close() {
    modal.classList.remove("open");
    box.classList.remove(
      "swipe-in-left",
      "swipe-in-right",
      "swipe-out-left",
      "swipe-out-right",
      "dragging",
    );
    box.style.transform = "";
    box.style.opacity = "";
    navigating = false;
  }
  qs("#mc").addEventListener("click", close);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });
  addEventListener("keydown", (e) => {
    if (!modal.classList.contains("open")) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft") go(-1);
    else if (e.key === "ArrowRight") go(1);
  });
  qsa("nav button[data-p]").forEach((b) =>
    b.addEventListener("click", () => {
      qsa("nav button[data-p]").forEach((x) =>
        x.classList.toggle("on", x === b),
      );
      qsa(".panel").forEach((p) =>
        p.classList.toggle("on", p.id === b.dataset.p),
      );
      scrollTo({ top: 0, behavior: "smooth" });
    }),
  );
  const itineraryList = qs("#itinerary-list");
  const kindIcon = (kind) => {
    if (kind.includes("Travel") || kind.includes("move")) return "↗";
    if (kind.includes("Work")) return "☀";
    if (kind.includes("Vacation")) return "✦";
    return "●";
  };
  itineraryList.innerHTML = itin
    .map((x, i) => {
      const d = new Date(x.date + "T12:00:00");
      const label = d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      const isNewStop = !i || itin[i - 1].stop !== x.stop;
      return `${isNewStop ? `<div class="route-stop"><span>${i + 1}</span><div><b>${esc(x.stop)}</b><small>Base camp</small></div></div>` : ""}<article class="itday ${x.kind.toLowerCase().includes("travel") || x.kind.toLowerCase().includes("move") ? "travel" : ""}"><time datetime="${x.date}"><span>${d.toLocaleDateString("en-US", { month: "short" })}</span><b>${d.getDate()}</b><small>${d.toLocaleDateString("en-US", { weekday: "short" })}</small></time><div class="it-node" aria-hidden="true">${kindIcon(x.kind)}</div><div class="it-copy"><span class="itkind">${esc(x.kind)}</span><h3>${esc(x.day)}</h3><p class="it-evening"><b>Evening:</b> ${esc(x.evening)}</p></div></article>`;
    })
    .join("");
  let votes = {};
  try {
    votes = JSON.parse(localStorage.getItem("rv26votes") || "{}");
  } catch {}
  function bindStopVotes() {
    qsa(".stop").forEach((c) =>
      qsa(".vote button", c).forEach((b) =>
        b.addEventListener("click", () => {
          votes[c.dataset.stop] = b.textContent.includes("Love")
            ? "Love"
            : b.textContent.includes("Maybe")
              ? "Maybe"
              : "Skip";
          localStorage.setItem("rv26votes", JSON.stringify(votes));
          drawStopVotes();
        }),
      ),
    );
  }
  function drawStopVotes() {
    qsa(".stop").forEach((c) =>
      qsa(".vote button", c).forEach((b) =>
        b.classList.toggle(
          "sel",
          b.textContent.includes(votes[c.dataset.stop] || "__"),
        ),
      ),
    );
    const parts = ["Love", "Maybe", "Skip"]
      .map((t) => {
        const a = Object.entries(votes)
          .filter((x) => x[1] === t)
          .map((x) => x[0]);
        return a.length ? `<p><b>${t}:</b> ${a.map(esc).join(", ")}</p>` : "";
      })
      .join("");
    qs("#summary").innerHTML =
      parts ||
      "No stop votes yet. Open Stops + activities and vote on each base.";
  }
  function drawActivitySummary() {
    const all = [];
    stops.forEach((s) =>
      s.activities.forEach((a, i) => {
        const r = activityReviews[activityKey(s, i)];
        if (r && (r.rating || r.role))
          all.push({ stop: s.name, name: a.name, ...r });
      }),
    );
    if (!all.length) {
      qs("#activity-summary").innerHTML = "No activity ratings yet.";
      return;
    }
    const groups = ["Love", "Maybe", "Skip"];
    let html = groups
      .map((g) => {
        const a = all.filter((x) => x.rating === g);
        return a.length
          ? `<p><b>${g}:</b> ${a.map((x) => esc(x.stop + " — " + x.name)).join("<br>")}</p>`
          : "";
      })
      .join("");
    const moved = all.filter((x) => x.role);
    if (moved.length)
      html += `<p><b>Role changes:</b><br>${moved.map((x) => esc(x.stop + " — " + x.name + " → " + x.role)).join("<br>")}</p>`;
    qs("#activity-summary").innerHTML =
      html ||
      "Activity role choices saved, but no Love/Maybe/Skip ratings yet.";
  }
  qs("#clear").addEventListener("click", () => {
    votes = {};
    localStorage.removeItem("rv26votes");
    drawStopVotes();
  });
  qs("#clearActivities").addEventListener("click", () => {
    activityReviews = {};
    localStorage.removeItem(storeKey);
    drawActivitySummary();
    renderGrid();
  });
  renderGrid();
  drawActivitySummary();
})();
