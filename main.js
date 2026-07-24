// Progressive enhancement only — page works fully without JS.

// Theme toggle (initial theme set inline in <head> to avoid flash)
document.getElementById("themeToggle").addEventListener("click", function () {
  var root = document.documentElement;
  var dark = root.dataset.theme === "dark";
  if (dark) {
    delete root.dataset.theme;
    localStorage.setItem("theme", "light");
  } else {
    root.dataset.theme = "dark";
    localStorage.setItem("theme", "dark");
  }
});

// Scroll reveal for sections
if ("IntersectionObserver" in window) {
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add("visible");
        io.unobserve(e.target);
      }
    });
  }, { rootMargin: "0px 0px -8% 0px" });
  document.querySelectorAll(".section").forEach(function (s) { io.observe(s); });
} else {
  document.querySelectorAll(".section").forEach(function (s) { s.classList.add("visible"); });
}

// Current year
document.getElementById("year").textContent = new Date().getFullYear();

// Interactive CV — ask questions about Simon, answered server-side by Gemini.
(function () {
  var form = document.getElementById("cvbotForm");
  if (!form) return;
  var input = document.getElementById("cvbotInput");
  var send = document.getElementById("cvbotSend");
  var log = document.getElementById("cvbotLog");
  var suggest = document.getElementById("cvbotSuggest");
  var busy = false;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // Escape first, then apply a tiny safe subset of Markdown (bold, bullets,
  // paragraphs / line breaks). All HTML tags in the output are generated here,
  // so nothing from the model or user can inject markup.
  function inlineMd(t) {
    return t
      .replace(/\*\*([^*\n]+?)\*\*/g, "<strong>$1</strong>")
      .replace(/__([^_\n]+?)__/g, "<strong>$1</strong>");
  }
  function renderRich(raw) {
    var text = esc(String(raw)).replace(/\r/g, "").trim();
    return text.split(/\n{2,}/).map(function (block) {
      var lines = block.split("\n");
      var isList = lines.every(function (l) { return /^\s*[-*•]\s+/.test(l); });
      if (isList && lines.length) {
        return "<ul>" + lines.map(function (l) {
          return "<li>" + inlineMd(l.replace(/^\s*[-*•]\s+/, "")) + "</li>";
        }).join("") + "</ul>";
      }
      return "<p>" + inlineMd(lines.join("<br>")) + "</p>";
    }).join("");
  }

  function bubble(role, text, isError) {
    var el = document.createElement("div");
    el.className = "cvbot-msg cvbot-" + role + (isError ? " cvbot-err" : "");
    if (role === "bot" && !isError) {
      el.innerHTML = renderRich(text);
    } else {
      el.innerHTML = esc(text);
    }
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  function ask(q) {
    if (busy) return;
    q = (q || "").trim();
    if (!q) return;
    busy = true;
    input.value = "";
    send.disabled = true;
    input.disabled = true;
    log.innerHTML = "";
    bubble("you", q, false);
    var typing = bubble("bot", "…", false);
    typing.classList.add("cvbot-typing");

    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: q })
    }).then(function (r) {
      return r.json().then(function (data) { return { ok: r.ok, data: data }; });
    }).then(function (res) {
      typing.remove();
      if (res.ok && res.data && res.data.reply) {
        bubble("bot", res.data.reply, false);
      } else {
        bubble("bot", (res.data && res.data.error) || "The assistant is unavailable right now.", true);
      }
    }).catch(function () {
      typing.remove();
      bubble("bot", "Network error — please try again.", true);
    }).then(function () {
      busy = false;
      send.disabled = false;
      input.disabled = false;
      input.focus();
    });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    ask(input.value);
  });

  if (suggest) {
    suggest.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-q]");
      if (btn) ask(btn.getAttribute("data-q"));
    });
  }
})();
