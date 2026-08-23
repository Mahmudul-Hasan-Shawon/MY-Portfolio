/* ==========================================================================
   PORTFOLIO FRONTEND
   Every section on this page is built from the Google Sheet. Nothing here
   is hard-coded except the fallback dataset at the bottom of this block,
   which keeps the site presentable if the endpoint is unreachable.

   1. Paste your Apps Script Web App URL into API_URL below.
   2. Everything else is edited in the spreadsheet.
   ========================================================================== */

var API_URL = "https://script.google.com/macros/s/AKfycbxaaCaYpuu5JI0tAsg-tB2PcFlZZTRY0V5rX6_U5M1RsFyG4nj5L8b30oe1aH-9QVDYIQ/exec"; // ← "https://script.google.com/macros/s/AKfy.../exec"

/* ── State ────────────────────────────────────────────────────────────── */
var CFG = {};      // ⚙ Config          → key/value map
var SECS = [];     // 🧩 Sections       → order, visibility, headings
var NAV = [];      // 🧭 Navigation
var STATS = [];    // 📊 Stats
var SKILLS = [];   // 🧠 Skills
var TOOLS = [];    // 🧰 Tools
var PROJECTS = []; // 🚀 Projects
var TSTS = [];     // 💬 Testimonials
var SVCS = [];     // 🛠 Services
var EXP = [];      // 🗓 Experience
var FAQS = [];     // ❓ FAQ
var SOCIAL = [];   // 🔗 Social Links
var FORMOPTS = {}; // 📝 Form Options
var RESUME = {};   // 📄 Resume        → key/value map, like ⚙ Config
var RXTRA = [];    // 🏅 Resume Extras → grouped list rows
var LIVE = false;  // true once sheet data has loaded

var FILTER = "All";
var ROUTE = { name: "home", slug: "" }; // current page, see parseRoute()
var LENIS = null;                       // smooth-scroll instance, null when disabled

/* Where the site is mounted. Derived from wherever the <script> tag points,
   so hosting under a subdirectory needs no extra configuration — just point
   the tag at /sub/assets/js/site.js and everything follows. */
var BASE = (function () {
    var tag = document.querySelector('script[src*="site.js"]');
    if (!tag) return "";
    try {
        return new URL(tag.getAttribute("src"), location.href).pathname
            .replace(/\/assets\/js\/site\.js.*$/, "");
    } catch (e) { return ""; }
})();

/* ── Tiny helpers ─────────────────────────────────────────────────────── */
function $(sel, root) { return (root || document).querySelector(sel); }
function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

function esc(v) {
    return String(v === undefined || v === null ? "" : v)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/* Config lookup that tolerates spacing / casing differences in the sheet. */
function cfg(key, fallback) {
    if (CFG && CFG[key] !== undefined && CFG[key] !== "") return CFG[key];
    var flat = String(key).toLowerCase().replace(/[^a-z0-9]/g, "");
    for (var k in CFG) {
        if (String(k).toLowerCase().replace(/[^a-z0-9]/g, "") === flat && CFG[k] !== "") return CFG[k];
    }
    return fallback === undefined ? "" : fallback;
}

function on(key, dflt) {
    var v = cfg(key, dflt === undefined ? "yes" : dflt);
    var s = String(v).trim().toLowerCase();
    return !(s === "no" || s === "false" || s === "0" || s === "off" || s === "hide" || s === "");
}

/* 📄 Resume first, ⚙ Config second, argument last. Two lookups rather than
   one because the résumé sheet is optional: a workbook that predates it
   still fills the page from Config, and a blank cell on the résumé sheet
   means "use whatever the site already says" instead of "show nothing". */
function rcfg(key, fallback) {
    if (RESUME && RESUME[key] !== undefined && RESUME[key] !== "") return RESUME[key];

    var flat = String(key).toLowerCase().replace(/[^a-z0-9]/g, "");
    for (var k in RESUME) {
        if (String(k).toLowerCase().replace(/[^a-z0-9]/g, "") === flat && RESUME[k] !== "") return RESUME[k];
    }
    return cfg(key, fallback);
}

/* The on()/rcfg() pairing — a résumé toggle that can also be left to Config. */
function ron(key, dflt) {
    var s = String(rcfg(key, dflt === undefined ? "yes" : dflt)).trim().toLowerCase();
    return !(s === "no" || s === "false" || s === "0" || s === "off" || s === "hide" || s === "");
}

/* Multi-line cell → array of trimmed, non-empty lines. */
function lines(v) {
    return String(v || "").split(/\r?\n/).map(function (s) { return s.trim(); })
        .filter(function (s) { return s.length; });
}

/* Comma OR newline separated cell → array. */
function listOf(v) {
    return String(v || "").split(/[\n,]/).map(function (s) { return s.trim(); })
        .filter(function (s) { return s.length; });
}

/* *word* → <em>word</em>, and line breaks → <br>. Lets the sheet control
   which words get the accent colour without any HTML in the cell. */
function markup(v) {
    return esc(v).replace(/\*([^*]+)\*/g, "<em>$1</em>").replace(/\r?\n/g, "<br>");
}

function icon(v, dflt) {
    var s = String(v || "").trim();
    if (!s) return dflt || "fa-solid fa-circle-dot";
    return /^fa[-srbl]/.test(s) ? s : "fa-solid " + (s.indexOf("fa-") === 0 ? s : "fa-" + s);
}

function initials(name) {
    return String(name || "?").trim().split(/\s+/).slice(0, 2)
        .map(function (w) { return w.charAt(0).toUpperCase(); }).join("");
}

function slugify(v) {
    return String(v || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/* Any video link the sheet might hold → a URL an <iframe> will actually
   play. Handles watch?v=, youtu.be, /shorts/, /live/, Vimeo and Loom, and
   passes anything already embeddable straight through. */
function videoEmbed(url) {
    var u = String(url || "").trim();
    if (!u) return "";
    if (/\/embed\/|player\.vimeo\.com|\/videoseries/.test(u)) return u;

    var yt = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
    if (yt) {
        var t = u.match(/[?&](?:t|start)=(\d+)/);
        return "https://www.youtube-nocookie.com/embed/" + yt[1] +
            "?rel=0&modestbranding=1&playsinline=1" + (t ? "&start=" + t[1] : "");
    }

    var vm = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vm) return "https://player.vimeo.com/video/" + vm[1];

    var lo = u.match(/loom\.com\/(?:share|embed)\/([A-Za-z0-9]+)/);
    if (lo) return "https://www.loom.com/embed/" + lo[1];

    return u; // assume the cell already holds an embeddable URL
}

/* Avatar element that degrades to initials when the URL is missing/broken. */
function avatar(url, name, cls) {
    if (url) {
        return '<img src="' + esc(url) + '" alt="' + esc(name) + '" loading="lazy" ' +
            'onerror="this.outerHTML=\'<span class=&quot;av-fallback ' + (cls || '') + '&quot;>' +
            esc(initials(name)) + '</span>\'">';
    }
    return '<span class="av-fallback ' + (cls || '') + '">' + esc(initials(name)) + '</span>';
}

/* Section meta from the 🧩 Sections sheet. */
function sec(key) {
    for (var i = 0; i < SECS.length; i++) if (SECS[i].key === key) return SECS[i];
    return { key: key, show: true, eyebrow: "", title: "", subtitle: "" };
}

function secHead(key, num, center) {
    var s = sec(key);
    if (!s.title && !s.eyebrow && !s.subtitle) return "";
    return '<header class="sec-head' + (center ? ' center' : '') + '" data-reveal>' +
        (s.eyebrow ? '<span class="mono-label"><span class="eyebrow-num">' +
            (num || "") + '</span> ' + esc(s.eyebrow) + '</span>' : '') +
        (s.title ? '<h2 class="sec-title">' + markup(s.title) + '</h2>' : '') +
        (s.subtitle ? '<p class="sec-sub">' + markup(s.subtitle) + '</p>' : '') +
        '</header>';
}

/* ==========================================================================
   ROUTER
   Three pages, real URLs, one HTML file:

     /                     home — featured projects only
     /portfolio            every project
     /portfolio/<slug>     one project in full

   The host has to rewrite unknown paths to index.html; see the _redirects,
   vercel.json, .htaccess and 404.html shipped alongside this file.
   ========================================================================== */

/* Leading slash, no trailing slash. Set by ⚙ Config → "Projects Base Path". */
function projBase() {
    var b = String(cfg("projectsBasePath", "/portfolio")).trim();
    if (!b) b = "/portfolio";
    if (b.charAt(0) !== "/") b = "/" + b;
    return b.replace(/\/+$/, "");
}

function urlHome() { return BASE + "/"; }
function urlProjects() { return BASE + projBase(); }
function urlProject(slug) { return BASE + projBase() + "/" + encodeURIComponent(slug); }

/* ── Unlisted résumé ──────────────────────────────────────────────────
   A fourth page that nothing on the site points at. It never appears in
   the nav, the drawer, the footer, a breadcrumb or a sitemap, and it asks
   crawlers not to index it. Two ways in, both of them typed:

     • the path itself            →  /resume
     • the trigger word, typed on any page, outside a form field
                                  →  "resume"

   Both are set in ⚙ Config ("Resume Path", "Resume Trigger"), so the
   path can be changed to something unguessable without touching code. */
function resumePath() {
    var p = String(rcfg("resumePath", "/resume")).trim();
    if (!p) p = "/resume";
    if (p.charAt(0) !== "/") p = "/" + p;
    return p.replace(/\/+$/, "");
}

function urlResume() { return BASE + resumePath(); }

/* Letters and digits only — the buffer that watches for it is built from
   single printable keypresses, so anything else could never match. */
function resumeTrigger() {
    return String(rcfg("resumeTrigger", "resume")).toLowerCase().replace(/[^a-z0-9]/g, "");
}

/* location.pathname → { name, slug } */
function parseRoute() {
    var path = location.pathname;
    if (BASE && path.indexOf(BASE) === 0) path = path.slice(BASE.length);
    path = path.replace(/\/index\.html$/, "/");
    if (!path) path = "/";

    var rp = resumePath();
    if (path === rp || path === rp + "/") return { name: "resume", slug: "" };

    var pb = projBase();
    if (path === pb || path === pb + "/") return { name: "projects", slug: "" };

    if (path.indexOf(pb + "/") === 0) {
        var slug = path.slice(pb.length + 1).replace(/\/+$/, "");
        try { slug = decodeURIComponent(slug); } catch (e) { /* leave as-is */ }
        return slug ? { name: "project", slug: slug } : { name: "projects", slug: "" };
    }
    return { name: "home", slug: "" };
}

/* Move to another page. `hash` is an optional #section to land on once the
   new page has rendered. */
function go(url, hash, replace) {
    var full = url + (hash || "");
    if (history.pushState) {
        if (replace) history.replaceState({}, "", full);
        else history.pushState({}, "", full);
    } else {
        location.href = full;
        return;
    }
    enterRoute(hash);
}

function enterRoute(hash) {
    ROUTE = parseRoute();
    FILTER = "All";           // a fresh page starts unfiltered
    applyMeta();
    render();
    initUI();

    if (hash) {
        var el = document.getElementById(hash.replace(/^#/, ""));
        if (el) { jumpTop(); scrollToEl(el); return; }
    }
    jumpTop();
}

/* Route changes should start at the top with no animation — easing a whole
   page height would just look like a glitch. */
function jumpTop() {
    if (LENIS) LENIS.scrollTo(0, { immediate: true, force: true });
    else window.scrollTo(0, 0);
}

/* ==========================================================================
   RICH DESCRIPTION PARSER
   Turns a plain Description cell into structured blocks. A line ending in a
   colon starts a new block; the lines beneath it become that block's body.
   Recognised headings render as tailored components, anything else becomes a
   plain titled block. Empty blocks are dropped automatically.

     Overview:      paragraphs
     Problem:       paragraphs
     Solution:      paragraphs
     Features:      checklist
     Highlights:    checklist
     Results:       checklist
     Stack:         pills
     Tech:          pills
     For:           pills
     How It Works:  numbered steps
     Process:       numbered steps
     FAQ:           question line, then "Answer: ..."
   ========================================================================== */
function parseRich(text) {
    var raw = String(text || "").replace(/\r/g, "");
    if (!raw.trim()) return [];

    var blocks = [];
    var current = { title: "", body: [] };

    raw.split("\n").forEach(function (ln) {
        var t = ln.trim();
        var isHeading = /^[A-Za-z][A-Za-z0-9 &/'’-]{0,38}:$/.test(t);
        if (isHeading) {
            if (current.title || current.body.length) blocks.push(current);
            current = { title: t.replace(/:$/, "").trim(), body: [] };
        } else {
            current.body.push(t);
        }
    });
    if (current.title || current.body.length) blocks.push(current);

    return blocks.map(function (b) {
        var key = b.title.toLowerCase();
        var body = b.body.filter(function (s) { return s.length; });
        var kind = "text";

        if (/^(features|highlights|results|benefits|outcomes|deliverables|key features)$/.test(key)) kind = "check";
        else if (/^(stack|tech|tech stack|tools|built with|for|audience)$/.test(key)) kind = "pills";
        else if (/^(how it works|process|steps|workflow|how to use)$/.test(key)) kind = "steps";
        else if (/^(faq|questions)$/.test(key)) kind = "faq";

        return { title: b.title, kind: kind, body: body, raw: b.body };
    }).filter(function (b) { return b.body.length; });
}

function renderRich(text) {
    var blocks = parseRich(text);
    if (!blocks.length) return "";

    return blocks.map(function (b) {
        var head = b.title ? '<h3>' + esc(b.title) + '</h3>' : '';
        var inner = "";

        if (b.kind === "check") {
            inner = '<ul class="pp-list">' + b.body.map(function (l) {
                return '<li><i class="fa-solid fa-check"></i><span>' + esc(l.replace(/^[-•*]\s*/, "")) + '</span></li>';
            }).join("") + '</ul>';

        } else if (b.kind === "pills") {
            var items = b.body.length === 1 ? listOf(b.body[0]) : b.body;
            inner = '<div class="tag-row">' + items.map(function (l) {
                return '<span class="pill accent">' + esc(l) + '</span>';
            }).join("") + '</div>';

        } else if (b.kind === "steps") {
            inner = '<ol class="pp-steps">' + b.body.map(function (l) {
                return '<li><span>' + esc(l.replace(/^\d+[.)]\s*/, "")) + '</span></li>';
            }).join("") + '</ol>';

        } else if (b.kind === "faq") {
            var out = "", q = null;
            b.body.forEach(function (l) {
                if (/^answer\s*:/i.test(l)) {
                    out += '<div class="pp-block" style="margin-bottom:.9rem">' +
                        (q ? '<p style="color:var(--text);font-weight:500;margin-bottom:.25rem">' + esc(q) + '</p>' : '') +
                        '<p>' + esc(l.replace(/^answer\s*:\s*/i, "")) + '</p></div>';
                    q = null;
                } else { q = l; }
            });
            inner = out;

        } else {
            inner = b.body.map(function (l) { return '<p>' + esc(l) + '</p>'; }).join("");
        }

        return '<div class="pp-block">' + head + inner + '</div>';
    }).join("");
}

/* ==========================================================================
   FALLBACK DATASET
   Used only when API_URL is empty or the request fails, so the page is never
   blank. The 🧩 Sections keys here match the sheet exactly.
   ========================================================================== */
var DEMO = {
    config: {
        siteTitle: "mhshan — Automation Engineer",
        brandName: "mhshan",
        brandMark: "mhs",
        brandSub: "code · automate · scale",
        role: "Automation Engineer",
        metaDescription: "Google Apps Script, workflow automation and web scraping. I turn manual, repetitive work into systems that run themselves.",
        availabilityStatus: "Available for work",
        heroEyebrow: "Automation Engineer",
        heroTitle: "Turn repetitive work into *systems that run themselves*",
        heroSubtitle: "I build custom automation that removes 10–20 hours of manual work a week. No bloated SaaS subscriptions — just clean logic, solid code and workflows that scale with the business.",
        primaryButtonText: "Get a free consultation",
        primaryButtonLink: "#contact",
        secondaryButtonText: "See the work",
        secondaryButtonLink: "#projects",
        projectsFeaturedOnly: "Yes",
        projectsPreviewCount: 3,
        projectsViewAllText: "View all projects",
        projectsBasePath: "/portfolio",
        projectVideoHeading: "Walkthrough",
        smoothScroll: "Yes",
        smoothScrollDuration: 1.1,
        trustText: "*500+ projects delivered* across Google Workspace, scraping and browser tooling",
        terminalTitle: "~ mhshan --automation",
        terminalLines: "$ init automation engine\n$ modules loaded ......... 8/8\n$ apps script ............ connected\n$ api connections ........ established\n$ status ................. optimising workflows",
        aboutName: "Mahmudul Hasan Shaown",
        aboutRole: "Apps Script & Workflow Specialist",
        aboutHeading: "The short version",
        aboutBody: "I'm a developer with 6+ years spent building the unglamorous machinery that keeps businesses moving — sync jobs, report generators, scrapers, dashboards and internal tools.\nMost of my work lives inside Google Workspace: Apps Script back-ends, Sheets as a database, Gmail parsing, Drive pipelines and web apps served straight from a spreadsheet.\nAlongside freelancing I work with a cybersecurity firm supporting government-level compliance, which is where the habit of writing defensively came from.\nNo clutter. No expensive SaaS. Just clean logic and precise solutions.",
        aboutMarks: "500+ projects shipped\n6+ years building automation\nAverage response under 2 hours\nDocumented, handover-ready code",
        videoTitle: "Meet your automation partner",
        videoSubtitle: "Two minutes on how I approach automation differently",
        videoEmbedUrl: "",
        contactHeading: "Let's work together",
        contactBody: "Tell me what's eating your week. If it's repetitive, rule-based and lives in a browser or a spreadsheet, it can almost certainly be automated.",
        email: "hello@example.com",
        whatsAppNumber: "",
        location: "Dhaka, Bangladesh",
        responseNote: "I reply within 24 hours. No spam, ever.",
        whyList: "500+ projects delivered end to end\nFast replies, usually within hours\nClean, documented, maintainable code\nOngoing support after handover",
        footerTagline: "code · design · automation",
        copyrightText: "© 2026 — built and maintained by mhshan",
        versionLabel: "v2.0.0",
        statusText: "All systems operational",
        formSuccessMessage: "Message received. I'll get back to you within 24 hours."
    },
    sections: [
        { key: "hero", show: true, order: 1 },
        { key: "stats", show: true, order: 2 },
        { key: "about", show: true, order: 3, eyebrow: "About", title: "Built on *shipped work*, not slides", subtitle: "" },
        { key: "video", show: false, order: 4, eyebrow: "Introduction", title: "Meet your *automation partner*" },
        { key: "skills", show: true, order: 5, eyebrow: "Capabilities", title: "Skills & *expertise*", subtitle: "The stack I reach for when turning a manual process into something that runs on its own." },
        { key: "projects", show: true, order: 6, eyebrow: "Selected work", title: "Automation *projects*", subtitle: "Real systems in production — saving hours, removing errors, scaling quietly in the background." },
        { key: "testimonials", show: true, order: 7, eyebrow: "Feedback", title: "What clients *say*" },
        { key: "services", show: true, order: 8, eyebrow: "Services", title: "How I can *help*", subtitle: "Describe the bottleneck. I'll turn it into a workflow that runs without you." },
        { key: "experience", show: true, order: 9, eyebrow: "Track record", title: "Experience & *education*" },
        { key: "faq", show: true, order: 10, eyebrow: "Questions", title: "Frequently asked *questions*" },
        { key: "contact", show: true, order: 11, eyebrow: "Contact", title: "Start a *project*", subtitle: "Ready to automate? Tell me about the workflow and I'll scope it out." }
    ],
    nav: [
        { label: "Home", link: "#hero", show: true },
        { label: "About", link: "#about", show: true },
        { label: "Skills", link: "#skills", show: true },
        { label: "Projects", link: "#projects", show: true },
        { label: "Services", link: "#services", show: true },
        { label: "FAQ", link: "#faq", show: true }
    ],
    stats: [
        { value: "500+", label: "Projects delivered", sub: "across 6 years", icon: "fa-solid fa-cube", delta: "+12" },
        { value: "300k+", label: "Hours automated", sub: "1.2k saved monthly", icon: "fa-solid fa-clock-rotate-left", delta: "+8%" },
        { value: "98%", label: "Client satisfaction", sub: "380+ reviews", icon: "fa-solid fa-star", delta: "+2%" },
        { value: "<2h", label: "Response time", sub: "avg. 3.2 hours", icon: "fa-solid fa-bolt", delta: "-15%" }
    ],
    skills: [
        { category: "Google Workspace", icon: "fa-brands fa-google", items: "Apps Script\nSheets API\nGmail API\nDrive API", level: 95 },
        { category: "Automation", icon: "fa-solid fa-gears", items: "Workflow design\nScheduled triggers\nAPI integration\nError recovery", level: 92 },
        { category: "Web Scraping", icon: "fa-solid fa-spider", items: "Puppeteer\nCheerio\nRate-limit handling\nData cleaning", level: 88 },
        { category: "Browser Extensions", icon: "fa-brands fa-chrome", items: "Manifest V3\nContent scripts\nTampermonkey\nChrome APIs", level: 85 },
        { category: "Web Applications", icon: "fa-solid fa-code", items: "JavaScript / TypeScript\nNode.js & Express\nREST APIs\nDatabase design", level: 90 },
        { category: "E-commerce", icon: "fa-solid fa-bag-shopping", items: "WooCommerce\nShopify\nPayment gateways\nOrder pipelines", level: 82 }
    ],
    tools: [
        { name: "Apps Script", icon: "fa-solid fa-scroll" }, { name: "Node.js", icon: "fa-brands fa-node" },
        { name: "Puppeteer", icon: "fa-solid fa-robot" }, { name: "Tampermonkey", icon: "fa-solid fa-plug" },
        { name: "Chrome APIs", icon: "fa-brands fa-chrome" }, { name: "Sheets API", icon: "fa-solid fa-table" },
        { name: "Gmail API", icon: "fa-solid fa-envelope" }, { name: "REST", icon: "fa-solid fa-diagram-project" },
        { name: "Git", icon: "fa-brands fa-git-alt" }, { name: "Cloudflare", icon: "fa-brands fa-cloudflare" }
    ],
    projects: [
        {
            title: "Spreadsheet-powered storefront", slug: "sheet-storefront", category: "E-commerce", featured: true,
            summary: "A full retail site — catalogue, cart, checkout, invoicing and order tracking — running entirely on Google Sheets.",
            image: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1200&q=70",
            tags: "Apps Script, JavaScript, Sheets API, PDF",
            client: "Retail client", year: "2026", role: "Solo build", duration: "3 weeks",
            liveUrl: "", repoUrl: "",
            video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            description: "Overview:\nThe shop owner needed a real storefront but had no budget for a platform subscription and no appetite for an admin panel.\n\nProblem:\nProducts, prices and stock lived in a spreadsheet that was edited daily. Any website would fall out of sync within hours.\n\nSolution:\nI made the spreadsheet the single source of truth and served the site from it. Editing a cell updates the live site on the next load — no deploys, no CMS.\n\nFeatures:\nLive catalogue with search, brand and category filters\nCart and checkout with delivery-zone pricing\nAutomatic PDF invoice emailed on every order\nCustomer-facing order tracking by code\nStock status controlled from one column\n\nStack:\nGoogle Apps Script, Vanilla JS, Sheets API, HTML Service\n\nResults:\nZero platform fees\nOrders logged and invoiced without manual work\nOwner ships catalogue changes in seconds"
        },
        {
            title: "Gmail triage & routing engine", slug: "gmail-triage", category: "Utility", featured: true,
            summary: "Parses inbound mail, extracts structured data, labels and routes it, then files attachments in Drive.",
            image: "https://images.unsplash.com/photo-1596526131083-e8c633c948d2?w=1200&q=70",
            tags: "Apps Script, Gmail API, Drive API, Regex",
            client: "Logistics firm", year: "2025", role: "Automation lead", duration: "2 weeks",
            description: "Overview:\nA four-person ops team was spending most of the morning sorting order confirmations by hand.\n\nSolution:\nA scheduled Apps Script that reads unprocessed threads, pulls fields out with tuned patterns, writes rows to a tracking sheet and moves attachments into dated Drive folders.\n\nFeatures:\nField extraction with per-sender templates\nAuto-labelling and archiving\nAttachment filing by date and client\nDaily digest to the ops channel\n\nResults:\nMorning triage dropped from 3 hours to under 10 minutes\nZero missed confirmations since launch"
        },
        {
            title: "Competitive price monitor", slug: "price-monitor", category: "Finance", featured: false,
            summary: "Scrapes competitor pricing on a schedule, tracks movement and raises alerts when a threshold is crossed.",
            image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200&q=70",
            tags: "Puppeteer, Node.js, Sheets API, Alerts",
            client: "Retail group", year: "2025", role: "Solo build", duration: "10 days",
            description: "Overview:\nPricing decisions were made from a spreadsheet someone updated by hand once a week.\n\nSolution:\nA headless scraper walks a watchlist twice daily, normalises the results and writes a time series that a dashboard reads.\n\nFeatures:\nRetry and backoff on rate limits\nChange detection with configurable thresholds\nEmail and chat alerts\nHistorical price charts\n\nResults:\nPricing reviewed daily instead of weekly\nManual data collection removed entirely"
        },
        {
            title: "Report generator for client billing", slug: "report-generator", category: "Management", featured: false,
            summary: "Builds branded PDF statements from raw ledger rows and emails them on a schedule.",
            image: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=1200&q=70",
            tags: "Apps Script, HTML Service, PDF, Triggers",
            client: "Agency", year: "2024", role: "Solo build", duration: "1 week",
            description: "Overview:\nMonth-end billing meant copying numbers into a template, exporting and sending each one manually.\n\nSolution:\nA generator that reads the ledger, renders an HTML invoice per client, converts it to PDF and sends it with a personalised note.\n\nFeatures:\nBranded, print-safe invoice layout\nPer-client currency and tax handling\nScheduled monthly run with a dry-run mode\nDelivery log written back to the sheet\n\nResults:\nTwo days of month-end work reduced to one trigger"
        },
        {
            title: "Lead enrichment pipeline", slug: "lead-enrichment", category: "AI/ML", featured: false,
            summary: "Takes a raw lead list, enriches it from public sources and scores each record for fit.",
            image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=70",
            tags: "Node.js, APIs, Scoring, Sheets",
            client: "SaaS startup", year: "2025", role: "Solo build", duration: "2 weeks",
            description: "Overview:\nSales were working a list where half the rows were missing the fields needed to qualify a lead.\n\nSolution:\nA pipeline that fills the gaps from public sources, deduplicates aggressively and applies a weighted fit score the team can tune.\n\nFeatures:\nFuzzy dedupe across company and domain\nConfigurable scoring weights\nConfidence flags on every enriched field\n\nResults:\nQualified-lead volume up without adding headcount"
        },
        {
            title: "Inventory sync across channels", slug: "inventory-sync", category: "E-commerce", featured: false,
            summary: "Keeps stock levels aligned between a warehouse sheet and two sales channels.",
            image: "https://images.unsplash.com/photo-1553413077-190dd305871c?w=1200&q=70",
            tags: "Apps Script, REST, Webhooks",
            client: "Distributor", year: "2024", role: "Solo build", duration: "3 weeks",
            description: "Overview:\nOverselling was a weekly occurrence because three systems each held their own idea of stock.\n\nSolution:\nOne authoritative sheet, webhook listeners on both channels and a reconciliation pass that logs every correction.\n\nFeatures:\nNear-real-time push on stock change\nConflict log with manual override\nNightly full reconciliation\n\nResults:\nOverselling incidents eliminated"
        }
    ],
    testimonials: [
        { name: "Client A", role: "Operations Manager", rating: 5, quote: "He mapped our whole order process in one call and had a working prototype two days later. The kind of person who asks the right questions before writing any code.", project: "Gmail triage engine", source: "Fiverr" },
        { name: "Client B", role: "Founder, Retail", rating: 5, quote: "Our site is a spreadsheet now, which sounds absurd until you use it. I edit a cell and the shop updates. No monthly fee, no admin panel to learn.", project: "Sheet storefront", source: "Direct" },
        { name: "Client C", role: "Head of Sales", rating: 5, quote: "Clear communication, delivered ahead of schedule, and the handover documentation meant my team could maintain it without him. Rare.", project: "Lead enrichment", source: "Upwork" }
    ],
    services: [
        { title: "Google Sheets automation", icon: "fa-solid fa-table-cells", description: "Sync data, generate reports and trigger alerts without anyone opening the file.", bullets: "Cross-sheet and cross-file sync\nScheduled reports and digests\nValidation and alerting rules", price: "" },
        { title: "Apps Script web apps", icon: "fa-solid fa-window-maximize", description: "Full applications served straight from a spreadsheet — forms, portals and dashboards.", bullets: "doGet / doPost back-ends\nCustom front-ends\nRole-based access", price: "" },
        { title: "Web scraping", icon: "fa-solid fa-spider", description: "Reliable extraction from sites that were never meant to be read by a machine.", bullets: "Price and stock monitoring\nLead generation\nScheduled crawls with retries", price: "" },
        { title: "Gmail automation", icon: "fa-solid fa-envelope-open-text", description: "Parsing, labelling, routing and smart replies for inboxes that get too much.", bullets: "Field extraction from mail\nAuto-labelling and routing\nTemplated replies", price: "" },
        { title: "Browser extensions", icon: "fa-brands fa-chrome", description: "Chrome extensions and userscripts that cut the clicks out of daily admin work.", bullets: "Manifest V3 extensions\nTampermonkey userscripts\nOn-page data capture", price: "" },
        { title: "Docs, PDFs & forms", icon: "fa-solid fa-file-pdf", description: "Auto-generated proposals, contracts and invoices from structured data.", bullets: "Branded PDF generation\nMail-merge at scale\nForm processing pipelines", price: "" }
    ],
    experience: [
        { type: "Work", title: "Freelance Automation Engineer", org: "Self-employed", start: "2019", end: "Present", description: "Building Apps Script back-ends, scrapers and internal tools for clients across retail, logistics and SaaS." },
        { type: "Work", title: "Developer — Security Compliance", org: "Cybersecurity firm", start: "2022", end: "Present", description: "Tooling and automation supporting government-level compliance workflows." },
        { type: "Education", title: "BSc, Computer Science", org: "University", start: "2016", end: "2020", description: "" }
    ],
    faq: [
        { question: "What does a typical project look like?", answer: "A short call to map the process, a written scope with a fixed price, then a working prototype within days. You review, I refine, and it goes live with documentation." },
        { question: "Do I need to be technical to work with you?", answer: "No. Describe the task the way you'd explain it to a new hire — what you open, what you click, what you copy. That's enough for me to design the automation." },
        { question: "Will the automation keep working if something changes?", answer: "Everything I ship handles failure explicitly: retries, logging and alerts when something needs a human. If a source site or API changes, I'll tell you what it takes to adapt." },
        { question: "Who owns the code?", answer: "You do. Every project is handed over with the source, the configuration and a short document explaining how to run and change it." },
        { question: "What do you need from me to start?", answer: "Access to the relevant sheet, inbox or site, a sample of the data, and one walkthrough of how you do it manually today." },
        { question: "How much does it cost?", answer: "Small scripts start low and scale with complexity. I quote a fixed price per project after scoping, so there are no hourly surprises." }
    ],
    social: [
        { platform: "GitHub", icon: "fa-brands fa-github", url: "https://github.com/", featured: true },
        { platform: "LinkedIn", icon: "fa-brands fa-linkedin-in", url: "https://linkedin.com/", featured: true },
        { platform: "Fiverr", icon: "fa-solid fa-f", url: "https://fiverr.com/", featured: true },
        { platform: "Upwork", icon: "fa-solid fa-u", url: "https://upwork.com/", featured: false },
        { platform: "X", icon: "fa-brands fa-x-twitter", url: "https://x.com/", featured: true },
        { platform: "WhatsApp", icon: "fa-brands fa-whatsapp", url: "https://wa.me/", featured: true }
    ],
    formOptions: {
        projectType: ["Sheets automation", "Apps Script web app", "Web scraping", "Gmail automation", "Browser extension", "Website / web app", "Something else"],
        timeline: ["ASAP", "Within 2 weeks", "This month", "Flexible"],
        budget: ["Under $250", "$250 – $750", "$750 – $2,000", "$2,000+", "Not sure yet"]
    },
    resume: {
        experienceTitle: "Experience",
        projectsTitle: "Selected Projects",
        skillsTitle: "Technical Expertise",
        educationTitle: "Education"
    },
    resumeExtras: []
};

/* ==========================================================================
   DATA LOAD
   ========================================================================== */
function boot() {
    preload(10, "connecting");

    if (!API_URL) {
        preload(60, "demo data");
        apply(DEMO, false);
        return;
    }

    var done = false;
    var timer = setTimeout(function () {
        if (!done) { done = true; apply(DEMO, false); }
    }, 12000);

    fetch(API_URL + (API_URL.indexOf("?") === -1 ? "?" : "&") + "action=getAll")
        .then(function (r) {
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.json();
        })
        .then(function (d) {
            if (done) return;
            done = true; clearTimeout(timer);
            if (!d || d.error) throw new Error(d && d.error ? d.error : "Empty response");
            preload(72, "parsing");
            apply(d, true);
        })
        .catch(function (err) {
            if (done) return;
            done = true; clearTimeout(timer);
            console.warn("Sheet unreachable, using fallback content:", err.message);
            preload(60, "fallback data");
            apply(DEMO, false);
        });
}

/* Merge sheet payload over the fallback so a half-filled workbook still
   renders a complete page instead of empty sections. */
function apply(d, live) {
    LIVE = !!live;
    d = d || {};

    // Deliberately NOT merged over the demo config: a cleared cell has to
    // mean "hide this", and merging would resurrect the placeholder text.
    CFG = (LIVE && d.config && Object.keys(d.config).length) ? d.config : DEMO.config;
    SECS = (d.sections && d.sections.length) ? d.sections : DEMO.sections;
    NAV = (d.nav && d.nav.length) ? d.nav : DEMO.nav;
    STATS = pick(d.stats, DEMO.stats);
    SKILLS = pick(d.skills, DEMO.skills);
    TOOLS = pick(d.tools, DEMO.tools);
    PROJECTS = pick(d.projects, DEMO.projects);
    TSTS = pick(d.testimonials, DEMO.testimonials);
    SVCS = pick(d.services, DEMO.services);
    EXP = pick(d.experience, DEMO.experience);
    FAQS = pick(d.faq, DEMO.faq);
    SOCIAL = pick(d.social, DEMO.social);
    FORMOPTS = (d.formOptions && Object.keys(d.formOptions).length) ? d.formOptions : DEMO.formOptions;
    RESUME = (LIVE && d.resume && Object.keys(d.resume).length) ? d.resume : (DEMO.resume || {});
    RXTRA = pick(d.resumeExtras, DEMO.resumeExtras || []);

    SECS = SECS.slice().sort(function (a, b) {
        return (Number(a.order) || 99) - (Number(b.order) || 99);
    });

    PROJECTS.forEach(function (p, i) { if (!p.slug) p.slug = slugify(p.title) || ("project-" + i); });

    ROUTE = parseRoute();
    applyMeta();
    applyTheme();
    preload(88, "compositing");
    render();
    initUI(true);          // reveals are held back for the curtain hand-off
    preDone(revealer);
}

/* An empty array from the sheet means "the owner deleted every row", which
   is a legitimate way to hide a section — only fall back when the key is
   genuinely absent from the response. */
function pick(fromSheet, fallback) {
    if (!LIVE) return fallback;
    return Array.isArray(fromSheet) ? fromSheet : fallback;
}

/* ==========================================================================
   PRELOADER
   The boot sequence only knows three or four real figures, so the rail is
   driven by rAF instead of jumping between them: it eases toward whatever
   is known and, while the sheet request is still in flight, creeps toward
   a soft ceiling — a slow network then reads as progress rather than a
   frozen bar. The curtain lifts only once the counter has landed and the
   loader has had a moment on screen, since a single frame of chrome is
   worse than no loader at all.
   ========================================================================== */

var PRE = {
    pct: 0,        // what the rail is currently showing
    target: 0,     // the highest figure the boot sequence has reported
    t0: 0,
    raf: 0,
    done: false,
    MIN: 900,      // ms the loader stays up even on an instant load
    CEIL: 88       // the creep never claims more than this before "ready"
};

function preload(pct, txt) {
    var t = $("#pre-txt");
    pct = Math.max(0, Math.min(100, Number(pct) || 0));
    if (pct > PRE.target) PRE.target = pct;
    if (t && txt) t.textContent = txt;
    if (!PRE.t0) PRE.t0 = Date.now();
    if (!PRE.raf) PRE.raf = requestAnimationFrame(preFrame);
}

function preFrame() {
    PRE.raf = 0;

    var goal = PRE.target;
    if (goal < 100) {
        // Asymptotic: roughly 55% at two seconds, 82% at six, never the ceiling.
        var age = (Date.now() - PRE.t0) / 1000;
        goal = Math.max(goal, PRE.CEIL * (1 - Math.exp(-age / 2.2)));
    }

    PRE.pct += (goal - PRE.pct) * .14;
    if (goal - PRE.pct < .35) PRE.pct = goal;

    var fill = $("#pre-fill"), num = $("#pre-pct");
    if (fill) fill.style.width = PRE.pct.toFixed(2) + "%";
    if (num) num.textContent = Math.round(PRE.pct);

    if (PRE.pct < 100) PRE.raf = requestAnimationFrame(preFrame);
}

/* Hands over to the page. `after` runs a beat into the wipe so the first
   sections animate in behind the rising sheet instead of sitting there
   already finished by the time it clears. */
function preDone(after) {
    if (PRE.done) return;
    PRE.done = true;
    preload(100, "ready");

    var el = $("#preloader");
    if (!el) { if (after) after(); return; }

    var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var wait = 0;

    if (reduced) {
        // Nothing to watch land, so don't make anyone sit through the ease.
        PRE.pct = 100;
    } else {
        wait = Math.max(0, PRE.MIN - (Date.now() - (PRE.t0 || Date.now())));
    }

    function lift() {
        el.classList.add("done");
        setTimeout(function () { if (after) after(); }, reduced ? 0 : 180);
        setTimeout(function () { el.setAttribute("hidden", ""); }, 1000);
    }

    setTimeout(function () {
        // Let the counter arrive before wiping — but not forever, since a
        // backgrounded tab throttles rAF and would strand the sheet on screen.
        if (PRE.pct >= 99.5) return lift();

        var tries = 0;
        var seal = setInterval(function () {
            if (PRE.pct < 99.5 && ++tries < 60) return;
            clearInterval(seal);
            lift();
        }, 40);
    }, wait);
}

/* ==========================================================================
   HEAD + THEME  (⚙ Config → SEO and THEME blocks)
   ========================================================================== */
function applyMeta() {
    var title = cfg("siteTitle", "Portfolio");
    var desc = cfg("metaDescription");
    var image = cfg("ogImageUrl");
    var url = cfg("siteUrl");

    // Each page announces itself properly, so a shared project link shows the
    // project rather than the site's front-page blurb.
    if (ROUTE.name === "resume") {
        title = cfg("aboutName", cfg("brandName", "Résumé")) + " — Résumé";
        desc = "";                       // nothing to share; the page is unlisted
        url = "";                        // and nothing to declare canonical
    } else if (ROUTE.name === "projects") {
        title = (sec("projects").title || "Projects").replace(/\*/g, "") + " — " + cfg("brandName", "Portfolio");
        desc = sec("projects").subtitle || desc;
        if (url) url = url.replace(/\/$/, "") + projBase();
    } else if (ROUTE.name === "project") {
        var proj = findProject(ROUTE.slug);
        if (proj) {
            title = proj.title + " — " + cfg("brandName", "Portfolio");
            desc = proj.summary || desc;
            if (proj.image) image = proj.image;
            if (url) url = url.replace(/\/$/, "") + projBase() + "/" + proj.slug;
        }
    }

    document.title = title;

    var map = {
        "meta-desc": ["content", desc],
        "meta-keys": ["content", cfg("metaKeywords")],
        "meta-author": ["content", cfg("author", cfg("aboutName"))],
        "meta-theme": ["content", cfg("backgroundColor", "#08090B")],
        "og-title": ["content", title],
        "og-desc": ["content", desc],
        "og-image": ["content", image],
        "canonical": ["href", url],
        "favicon": ["href", cfg("faviconUrl")]
    };
    Object.keys(map).forEach(function (id) {
        var el = document.getElementById(id);
        if (el && map[id][1]) el.setAttribute(map[id][0], map[id][1]);
    });

    // The résumé asks to be left out of the index; every other page keeps
    // the default. Written both ways so a back-button hop out of it clears.
    var robots = document.getElementById("meta-robots");
    if (robots) {
        robots.setAttribute("content", ROUTE.name === "resume"
            ? "noindex, nofollow, noarchive, nosnippet"
            : "index, follow");
    }
}

function applyTheme() {
    document.documentElement.setAttribute(
        "data-theme",
        String(cfg("themeMode", "dark")).toLowerCase().indexOf("light") === 0 ? "light" : "dark"
    );

    var vars = {
        "--accent": cfg("accentColor"),
        "--accent-2": cfg("accentColor2"),
        "--accent-ink": cfg("accentTextColor"),
        "--bg": cfg("backgroundColor"),
        "--surface": cfg("surfaceColor"),
        "--text": cfg("textColor"),
        "--muted": cfg("mutedColor"),
        "--line": cfg("borderColor"),
        "--ff-display": cfg("displayFont"),
        "--ff-sans": cfg("bodyFont"),
        "--ff-mono": cfg("monoFont"),
        "--r": cfg("cornerRadius"),
        "--shell": cfg("contentWidth")
    };

    var css = ":root{";
    Object.keys(vars).forEach(function (k) { if (vars[k]) css += k + ":" + vars[k] + ";"; });

    // Accent tints are derived so a single hex in the sheet restyles the page.
    var a = String(cfg("accentColor", "")).trim();
    if (/^#[0-9a-f]{6}$/i.test(a)) {
        var r = parseInt(a.substr(1, 2), 16), g = parseInt(a.substr(3, 2), 16), b = parseInt(a.substr(5, 2), 16);
        css += "--accent-dim:rgba(" + r + "," + g + "," + b + ",.12);";
        css += "--accent-line:rgba(" + r + "," + g + "," + b + ",.32);";
    }
    css += "}";

    $("#theme-vars").textContent = css;
    $("#custom-css").textContent = cfg("customCss", "");

    if (!on("grainTexture")) document.body.classList.add("no-grain");
    if (cfg("googleFontsUrl")) {
        var l = document.createElement("link");
        l.rel = "stylesheet"; l.href = cfg("googleFontsUrl");
        document.head.appendChild(l);
    }
}

/* ==========================================================================
   RENDER
   ========================================================================== */
var BUILDERS = {
    hero: heroHTML, stats: statsHTML, about: aboutHTML, video: videoHTML,
    skills: skillsHTML, projects: projectsHTML, testimonials: tstHTML,
    services: svcHTML, experience: expHTML, faq: faqHTML, contact: contactHTML
};

function render() {
    renderBrand();
    renderNav();

    if (ROUTE.name === "resume") {
        $("#main").innerHTML = pageResume();
    } else if (ROUTE.name === "projects") {
        $("#main").innerHTML = pageProjects();
    } else if (ROUTE.name === "project") {
        var p = findProject(ROUTE.slug);
        $("#main").innerHTML = p ? pageProject(p) : pageMissing(ROUTE.slug);
    } else {
        $("#main").innerHTML = pageHome();
    }

    // Lets the stylesheet strip the ambient layers back on the résumé.
    document.body.classList.toggle("on-resume", ROUTE.name === "resume");

    renderFooter();
    markActiveNav();
}

/* The home page: every block listed in 🧩 Sections, in its stated order. */
function pageHome() {
    var html = "", n = 0;
    SECS.forEach(function (s) {
        if (!on2(s.show)) return;
        var fn = BUILDERS[s.key];
        if (!fn) return;
        if (s.key !== "hero") n++;
        html += fn(pad(n));
    });
    return html;
}

function on2(v) {
    if (v === undefined || v === null || v === "") return true;
    var s = String(v).trim().toLowerCase();
    return !(s === "no" || s === "false" || s === "0" || s === "off" || s === "hide");
}

function pad(n) { return "[" + (n < 10 ? "0" + n : n) + "]"; }

function renderBrand() {
    var mark = $("#brand-mark"), logo = cfg("logoImageUrl");
    mark.innerHTML = logo
        ? '<img src="' + esc(logo) + '" alt="' + esc(cfg("brandName")) + '">'
        : esc(cfg("brandMark", initials(cfg("brandName", "P"))));

    $("#brand-name").textContent = cfg("brandName", "Portfolio");
    $("#brand-sub").textContent = cfg("brandSub", "");
    // $("#pre-mark").textContent = cfg("brandMark", initials(cfg("brandName", "P")));

    var st = cfg("availabilityStatus");
    if (st) {
        $("#status-text").textContent = st;
        $("#status-chip").hidden = false;
    }

    var cta = $("#nav-cta");
    cta.textContent = cfg("navButtonText", "Contact");
    cta.href = cfg("navButtonLink", "#contact");
}

/* A sheet row still says "#projects"; that now means the projects page. */
function navHref(link) {
    var v = String(link || "#");
    if (/^#projects\/?$/i.test(v.trim())) return urlProjects();
    if (v.charAt(0) === "#" && ROUTE.name !== "home") return urlHome() + v;
    return v;
}

function renderNav() {
    var items = NAV.filter(function (i) { return on2(i.show); });

    $("#nav-links").innerHTML = items.map(function (i) {
        return '<a href="' + esc(navHref(i.link)) + '"' + (on2(i.newTab) && i.newTab ? ' target="_blank" rel="noopener"' : '') +
            '>' + esc(i.label) + '</a>';
    }).join("");

    $("#drawer-links").innerHTML = items.map(function (i, k) {
        return '<a href="' + esc(navHref(i.link)) + '" data-close-drawer>' + esc(i.label) +
            '<span class="idx">' + pad(k + 1) + '</span></a>';
    }).join("");

    $("#drawer-social").innerHTML = socialHTML(false);
}

/* On /portfolio and /portfolio/<slug> the scroll spy has no matching
   section, so the Projects link is highlighted explicitly instead. */
function markActiveNav() {
    if (ROUTE.name === "home") return;
    var here = urlProjects();
    $$("#nav-links a").forEach(function (a) {
        a.classList.toggle("active", a.getAttribute("href") === here);
    });
}

// function socialHTML(featuredOnly) {
//     return SOCIAL.filter(function (s) {
//         return on2(s.show) && s.url && (!featuredOnly || on2(s.featured));
//     }).map(function (s) {
//         return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener" title="' + esc(s.platform) +
//             '" aria-label="' + esc(s.platform) + '"><i class="' + esc(icon(s.icon, "fa-solid fa-link")) + '"></i></a>';
//     }).join("");
// }

function socialHTML(featuredOnly) {
    return SOCIAL.filter(function (s) {
        return on2(s.show) && s.url && (!featuredOnly || on2(s.featured));
    }).map(function (s) {
        var iconHtml = renderIcon(s.icon, s.platform);
        return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener" title="' + esc(s.platform) +
            '" aria-label="' + esc(s.platform) + '">' + iconHtml + '</a>';
    }).join("");
}

/* Render an icon — supports Font Awesome classes OR image paths (SVG, PNG, ICO, etc.) */
function renderIcon(iconValue, altText) {
    var v = String(iconValue || "").trim();
    if (!v) return '<i class="fa-solid fa-link"></i>';
    
    // Check if it's an image file path (ends with .svg, .png, .ico, .jpg, .jpeg, .webp, .gif)
    if (/\.(svg|png|ico|jpg|jpeg|webp|gif)(\?.*)?$/i.test(v)) {
        var src = resolveAsset(v);
        return '<img src="' + esc(src) + '" alt="' + esc(altText || 'icon') + '" class="social-icon">';
    }
    
    // Otherwise treat as Font Awesome class
    return '<i class="' + esc(icon(v, "fa-solid fa-link")) + '"></i>';
}


/* Resolve asset paths to work from any URL depth. */
function resolveAsset(path) {
    if (!path) return "";
    // If it's already absolute (http, https, //, or starts with /), return as-is
    if (/^(https?:)?\/\//i.test(path) || path.charAt(0) === "/") return path;
    // If it's a relative path (./ or ../), resolve it against BASE
    if (path.indexOf("./") === 0 || path.indexOf("../") === 0) {
        return BASE + path.replace(/^\.\/?/, "/");
    }
    // Default: treat as root-relative
    return BASE + "/" + path;
}

/* ── HERO ─────────────────────────────────────────────────────────────── */
function heroHTML() {
    var avatars = listOf(cfg("trustAvatars")).slice(0, 4);
    var av = avatars.length
        ? '<div class="avatars">' + avatars.map(function (u, i) {
            return avatar(u, "Client " + (i + 1));
        }).join("") + '</div>'
        : "";

    var tl = lines(cfg("terminalLines"));
    var term = tl.length ? tl.map(function (l, i) {
        var m = l.match(/^\$\s*(.*)$/);
        var body = m ? m[1] : l;
        var last = i === tl.length - 1;
        return '<div class="term-line" style="animation-delay:' + (300 + i * 260) + 'ms">' +
            '<span class="p">$</span><span>' + esc(body) +
            (last ? '<span class="term-caret"></span>' : '') + '</span></div>';
    }).join("") : "";

    var badges = listOf(cfg("heroBadges")).map(function (b) {
        return '<span class="pill">' + esc(b) + '</span>';
    }).join("");

    return '<section id="hero" class="section"><div class="shell hero hero-grid">' +
        '<div data-reveal>' +
        (cfg("heroEyebrow") ? '<span class="hero-eyebrow"><i class="fa-solid fa-terminal"></i>' +
            esc(cfg("heroEyebrow")) + '</span>' : '') +
        '<h1>' + markup(cfg("heroTitle")) + '</h1>' +
        '<p class="hero-sub">' + markup(cfg("heroSubtitle")) + '</p>' +
        '<div class="hero-cta">' +
        (cfg("primaryButtonText") ? '<a class="btn btn-accent" href="' + esc(cfg("primaryButtonLink", "#contact")) +
            '">' + esc(cfg("primaryButtonText")) + '<i class="fa-solid fa-arrow-right"></i></a>' : '') +
        (cfg("secondaryButtonText") ? '<a class="btn btn-ghost" href="' + esc(cfg("secondaryButtonLink", "#projects")) +
            '">' + esc(cfg("secondaryButtonText")) + '</a>' : '') +
        '</div>' +
        (av || cfg("trustText") ? '<div class="hero-trust">' + av +
            '<p class="trust-txt">' + markup(cfg("trustText")).replace(/<em>/g, "<strong>").replace(/<\/em>/g, "</strong>") +
            '</p></div>' : '') +
        '</div>' +
        (term ? '<div data-reveal style="--d:160ms"><div class="term">' +
            '<div class="term-bar"><span class="term-dot"></span><span class="term-dot"></span>' +
            '<span class="term-dot"></span><span class="term-title">' + esc(cfg("terminalTitle", "~ terminal")) +
            '</span></div><div class="term-body">' + term + '</div></div>' +
            (badges ? '<div class="hero-badges">' + badges + '</div>' : '') + '</div>' : '') +
        '</div>' +
        '<div class="scroll-hint"><span class="rail"></span>scroll</div>' +
        '</section>';
}

/* ── STATS ────────────────────────────────────────────────────────────── */
function statsHTML() {
    if (!STATS.length) return "";
    var cards = STATS.filter(function (s) { return on2(s.show); }).map(function (s, i) {
        var down = String(s.delta || "").trim().charAt(0) === "-";
        return '<div class="stat" data-reveal style="--d:' + (i * 70) + 'ms">' +
            '<div class="stat-top"><i class="' + esc(icon(s.icon, "fa-solid fa-chart-simple")) + '"></i>' +
            (s.delta ? '<span class="stat-delta' + (down ? ' down' : '') + '">' + esc(s.delta) + '</span>' : '') +
            '</div>' +
            '<div class="stat-val" data-count="' + esc(s.value) + '">' + esc(s.value) + '</div>' +
            '<div class="stat-lbl">' + esc(s.label) + '</div>' +
            (s.sub ? '<div class="stat-sub">' + esc(s.sub) + '</div>' : '') +
            '</div>';
    }).join("");
    return '<section id="stats" class="section"><div class="shell"><div class="stats-grid">' + cards + '</div></div></section>';
}

/* ── ABOUT ────────────────────────────────────────────────────────────── */
function aboutHTML(n) {
    var marks = lines(cfg("aboutMarks")).map(function (m) {
        return '<div class="about-mark"><i class="fa-solid fa-circle-check"></i><span>' + esc(m) + '</span></div>';
    }).join("");

    var body = lines(cfg("aboutBody")).map(function (p) {
        return '<p>' + markup(p).replace(/<em>/g, "<strong>").replace(/<\/em>/g, "</strong>") + '</p>';
    }).join("");

    var img = cfg("aboutImageUrl");
    var media = '<figure class="about-media" data-reveal>' +
        (img ? '<img src="' + esc(img) + '" alt="' + esc(cfg("aboutName")) + '" loading="lazy">'
            : '<div style="aspect-ratio:4/5;display:grid;place-items:center;font-family:var(--ff-display);font-size:4rem;color:var(--accent)">' +
            esc(initials(cfg("aboutName"))) + '</div>') +
        '<figcaption><span class="rl">' + esc(cfg("aboutRole")) + '</span>' +
        '<span class="nm">' + esc(cfg("aboutName")) + '</span></figcaption></figure>';

    return '<section id="about" class="section"><div class="shell">' +
        secHead("about", n) +
        '<div class="about-grid">' + media +
        '<div class="about-body" data-reveal style="--d:120ms">' +
        (cfg("aboutHeading") ? '<h3>' + markup(cfg("aboutHeading")) + '</h3>' : '') +
        body +
        (marks ? '<div class="about-marks">' + marks + '</div>' : '') +
        '<div class="hero-cta" style="margin:0">' +
        (cfg("resumeUrl") ? '<a class="btn btn-ghost" href="' + esc(cfg("resumeUrl")) +
            '" target="_blank" rel="noopener"><i class="fa-solid fa-file-arrow-down"></i>Download CV</a>' : '') +
        '<a class="btn btn-accent" href="#contact">Work with me<i class="fa-solid fa-arrow-right"></i></a>' +
        '</div></div></div></div></section>';
}

/* ── VIDEO ────────────────────────────────────────────────────────────── */
function videoHTML(n) {
    var url = videoEmbed(cfg("videoEmbedUrl"));
    if (!url) return "";
    return '<section id="video" class="section"><div class="shell">' +
        secHead("video", n, true) +
        '<div class="video-frame" data-reveal><iframe src="' + esc(url) +
        '" title="Introduction video" allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture" ' +
        'allowfullscreen loading="lazy"></iframe></div></div></section>';
}

/* ── SKILLS ───────────────────────────────────────────────────────────── */
function skillsHTML(n) {
    var cards = SKILLS.filter(function (s) { return on2(s.show); }).map(function (s, i) {
        var lvl = Number(s.level) || 0;
        return '<article class="card skill-card" data-reveal style="--d:' + (i % 3 * 90) + 'ms">' +
            '<div class="skill-ico"><i class="' + esc(icon(s.icon, "fa-solid fa-layer-group")) + '"></i></div>' +
            '<h3>' + esc(s.category) + '</h3>' +
            '<ul class="skill-items">' + lines(s.items).map(function (it) {
                return '<li>' + esc(it) + '</li>';
            }).join("") + '</ul>' +
            (lvl ? '<div class="skill-meter"><span data-level="' + lvl + '"></span></div>' : '') +
            '</article>';
    }).join("");

    var tools = TOOLS.filter(function (t) { return on2(t.show); });
    var strip = "";
    if (tools.length && on("marqueeActive")) {
        var row = tools.map(function (t) {
            return '<span class="marquee-item"><i class="' + esc(icon(t.icon, "fa-solid fa-code")) + '"></i>' +
                esc(t.name) + '</span>';
        }).join("");
        strip = '<div class="marquee"><div class="marquee-track">' + row + row + '</div></div>';
    }

    return '<section id="skills" class="section"><div class="shell">' +
        secHead("skills", n, true) +
        '<div class="skills-grid">' + cards + '</div>' + strip +
        '</div></section>';
}

/* ── PROJECTS ───────────────────────────────────────────── */
/* ── PROJECTS ─────────────────────────────────────────────────────────── */
/* The home page shows a teaser of featured work with a link to the full
   list. /portfolio holds every project; /portfolio/<slug> holds one. The
   cards are ordinary anchors, so middle-click, "open in new tab" and
   crawlers all behave — the router only intercepts plain left clicks. */

function featuredOnly() { return on("projectsFeaturedOnly", "yes"); }

function previewCount() {
    var n = parseInt(cfg("projectsPreviewCount", 3), 10);
    return (isNaN(n) || n < 1) ? 3 : n;
}

function isFeatured(p) {
    var v = p.featured;
    if (v === true) return true;
    if (v === false || v === undefined || v === null || v === "") return false;
    return on2(v);
}

/* Everything the sheet says is visible. */
function shownProjects() {
    return PROJECTS.filter(function (p) { return on2(p.show); });
}

/* …narrowed by the active category chip (only used on /portfolio). */
function scopedProjects() {
    return shownProjects().filter(function (p) {
        return FILTER === "All" || p.category === FILTER;
    });
}

/* …and what the home page teaser should show. */
function homeProjects() {
    var all = shownProjects();
    if (!featuredOnly()) return all;
    var feat = all.filter(isFeatured);
    // Nobody ticked Featured? Show the first few rather than nothing.
    return feat.length ? feat : all.slice(0, previewCount());
}

function projCategories() {
    var cats = [];
    shownProjects().forEach(function (p) {
        if (p.category && cats.indexOf(p.category) === -1) cats.push(p.category);
    });
    return cats;
}

function projFiltersHTML() {
    var cats = ["All"].concat(projCategories());
    return cats.map(function (c) {
        return '<button type="button" class="filter-btn' + (c === FILTER ? ' on' : '') +
            '" data-filter="' + esc(c) + '">' + esc(c) + '</button>';
    }).join("");
}

function projectCards(list) {
    if (!list.length) return '<p class="empty-note">No projects in this category yet.</p>';

    return list.map(function (p, i) {
        return '<a class="card proj" href="' + esc(urlProject(p.slug)) + '" ' +
            'data-slug="' + esc(p.slug) + '" style="animation-delay:' + (i % 9 * 60) + 'ms">' +
            '<span class="proj-thumb">' +
            (p.image ? '<img src="' + esc(p.image) + '" alt="' + esc(p.title) + '" loading="lazy">' : '') +
            '<span class="veil"></span>' +
            (p.category ? '<span class="pill proj-cat">' + esc(p.category) + '</span>' : '') +
            (isFeatured(p) ? '<i class="fa-solid fa-star proj-star" title="Featured"></i>' : '') +
            (videoEmbed(p.video) ? '<span class="proj-play"><i class="fa-solid fa-play"></i>Video</span>' : '') +
            '<span class="proj-open"><i class="fa-solid fa-arrow-up-right-from-square"></i></span>' +
            '</span>' +
            '<span class="proj-body"><h3>' + esc(p.title) + '</h3>' +
            '<span class="proj-sum">' + esc(p.summary) + '</span>' +
            '<span class="tag-row">' + listOf(p.tags).slice(0, 3).map(function (t) {
                return '<span class="pill">' + esc(t) + '</span>';
            }).join("") + '</span>' +
            '<span class="proj-meta"><span>' + esc(p.client || p.role || "") + '</span>' +
            '<span>' + esc(p.year || "") + '</span></span>' +
            '</span></a>';
    }).join("");
}

/* ── Home teaser ──────────────────────────────────────────────────────── */
function projectsHTML(n) {
    var list = homeProjects();
    var total = shownProjects().length;

    var more = '<a class="btn btn-accent" href="' + esc(urlProjects()) + '" data-route>' +
        esc(cfg("projectsViewAllText", "View all projects")) +
        (total > list.length ? '<span class="proj-count">' + total + '</span>' : '') +
        '<i class="fa-solid fa-arrow-right"></i></a>';

    return '<section id="projects" class="section"><div class="shell">' +
        secHead("projects", n) +
        '<div class="proj-grid">' + projectCards(list) + '</div>' +
        '<div class="proj-actions" data-reveal>' + more +
        '<a class="btn btn-ghost" href="#contact">Have something similar in mind?' +
        '<i class="fa-solid fa-arrow-right"></i></a>' +
        '</div></div></section>';
}

/* ── /portfolio ───────────────────────────────────────────────────────── */
function pageProjects() {
    var meta = sec("projects");
    var chips = projCategories().length > 1
        ? '<div class="filter-row" id="proj-filters" data-reveal>' + projFiltersHTML() + '</div>'
        : '';

    return '<section class="section page-top"><div class="shell">' +
        crumbs([["Home", urlHome()], [pageLabel(), null]]) +
        '<header class="sec-head page-head" data-reveal>' +
        (meta.eyebrow ? '<span class="mono-label">' + esc(meta.eyebrow) + '</span>' : '') +
        '<h1 class="sec-title">' + markup(meta.title || "Projects") + '</h1>' +
        (meta.subtitle ? '<p class="sec-sub">' + markup(meta.subtitle) + '</p>' : '') +
        '<p class="page-count mono-label">' + shownProjects().length + ' projects</p>' +
        '</header>' +
        chips +
        '<div class="proj-grid" id="proj-grid" aria-live="polite">' +
        projectCards(scopedProjects()) + '</div>' +
        '<div class="proj-actions" data-reveal>' +
        '<a class="btn btn-ghost" href="' + esc(urlHome()) + '" data-route>' +
        '<i class="fa-solid fa-arrow-left"></i>Back home</a>' +
        '<a class="btn btn-accent" href="' + esc(urlHome()) + '#contact" data-route>' +
        'Start a project<i class="fa-solid fa-arrow-right"></i></a>' +
        '</div></div></section>';
}

function pageLabel() {
    return String(sec("projects").title || "Projects").replace(/\*/g, "");
}

/* Repaint just the grid when a category chip is clicked. */
function refreshProjects() {
    var grid = $("#proj-grid");
    if (!grid) return;
    var f = $("#proj-filters");
    if (f) f.innerHTML = projFiltersHTML();
    grid.innerHTML = projectCards(scopedProjects());
}

/* ── /portfolio/<slug> ────────────────────────────────────────────────── */
function pageProject(p) {
    var facts = [
        ["Client", p.client], ["Role", p.role], ["Year", p.year],
        ["Duration", p.duration], ["Category", p.category]
    ].filter(function (f) { return f[1]; }).map(function (f) {
        return '<div class="pp-fact"><span class="k">' + esc(f[0]) + '</span>' +
            '<span class="v">' + esc(f[1]) + '</span></div>';
    }).join("");

    var gallery = listOf(p.gallery).map(function (g) {
        return '<img src="' + esc(g) + '" alt="' + esc(p.title) + ' screenshot" loading="lazy">';
    }).join("");

    var video = videoEmbed(p.video);
    var videoBlock = video
        ? '<div class="pp-block">' +
        '<h3>' + esc(cfg("projectVideoHeading", "Walkthrough")) + '</h3>' +
        '<div class="video-frame pp-video">' +
        '<iframe src="' + esc(video) + '" title="' + esc(p.title) + ' walkthrough" ' +
        'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ' +
        'referrerpolicy="strict-origin-when-cross-origin" allowfullscreen loading="lazy"></iframe>' +
        '</div></div>'
        : "";

    var actions = "";
    if (p.liveUrl) actions += '<a class="btn btn-accent" href="' + esc(p.liveUrl) +
        '" target="_blank" rel="noopener">View live<i class="fa-solid fa-arrow-up-right-from-square"></i></a>';
    if (p.repoUrl) actions += '<a class="btn btn-ghost" href="' + esc(p.repoUrl) +
        '" target="_blank" rel="noopener"><i class="fa-brands fa-github"></i>Source</a>';
    actions += '<a class="btn btn-ghost" href="' + esc(urlHome()) + '#contact" data-route>' +
        'Build something like this<i class="fa-solid fa-arrow-right"></i></a>';

    // Previous / next walk the visible list in sheet order.
    var list = shownProjects();
    var at = -1;
    for (var i = 0; i < list.length; i++) if (list[i].slug === p.slug) { at = i; break; }
    var prev = at > 0 ? list[at - 1] : null;
    var next = at > -1 && at < list.length - 1 ? list[at + 1] : null;

    var pager = (prev || next)
        ? '<nav class="proj-pager" aria-label="More projects">' +
        (prev ? '<a class="pager-link prev" href="' + esc(urlProject(prev.slug)) + '" data-route>' +
            '<span class="mono-label"><i class="fa-solid fa-arrow-left"></i> Previous</span>' +
            '<b>' + esc(prev.title) + '</b></a>' : '<span></span>') +
        (next ? '<a class="pager-link next" href="' + esc(urlProject(next.slug)) + '" data-route>' +
            '<span class="mono-label">Next <i class="fa-solid fa-arrow-right"></i></span>' +
            '<b>' + esc(next.title) + '</b></a>' : '<span></span>') +
        '</nav>'
        : '';

    return '<article class="section page-top proj-page"><div class="shell">' +
        crumbs([["Home", urlHome()], [pageLabel(), urlProjects()], [p.title, null]]) +

        '<header class="pp-head page-head" data-reveal>' +
        (p.category ? '<span class="mono-label">' + esc(p.category) + '</span>' : '') +
        '<h1>' + esc(p.title) + '</h1>' +
        (p.summary ? '<p class="sec-sub">' + esc(p.summary) + '</p>' : '') +
        '<div class="tag-row">' + listOf(p.tags).map(function (t) {
            return '<span class="pill">' + esc(t) + '</span>';
        }).join("") + '</div>' +
        '</header>' +

        (p.image ? '<figure class="pp-hero pp-hero-page" data-reveal>' +
            '<img src="' + esc(p.image) + '" alt="' + esc(p.title) + '"></figure>' : '') +

        '<div class="pp-body">' +
        (facts ? '<div class="pp-facts">' + facts + '</div>' : '') +
        videoBlock +
        renderRich(p.description) +
        (gallery ? '<div class="pp-block"><h3>Gallery</h3><div class="pp-gallery">' + gallery + '</div></div>' : '') +
        '<div class="pp-actions">' + actions + '</div>' +
        '</div>' +

        pager +
        '</div></article>';
}

function pageMissing(slug) {
    return '<section class="section page-top"><div class="shell">' +
        crumbs([["Home", urlHome()], [pageLabel(), urlProjects()]]) +
        '<header class="sec-head page-head">' +
        '<span class="mono-label">404</span>' +
        '<h1 class="sec-title">No project called <em>' + esc(slug) + '</em></h1>' +
        '<p class="sec-sub">It may have been renamed or hidden in the sheet.</p>' +
        '</header>' +
        '<div class="proj-actions">' +
        '<a class="btn btn-accent" href="' + esc(urlProjects()) + '" data-route>' +
        'See all projects<i class="fa-solid fa-arrow-right"></i></a>' +
        '</div></div></section>';
}

/* ==========================================================================
   RÉSUMÉ  (the unlisted page — see resumePath() above)

   Every word comes from the workbook. 📄 Resume holds the page's own
   settings and copy; 🏅 Resume Extras holds the line-item blocks
   (recognition, interests, anything else the sheet invents); the rest is
   read from the same sheets that build the site — 🗓 Experience, 🚀
   Projects, 🧠 Skills, 🧰 Tools, 📊 Stats, 🔗 Social Links, ⚙ Config.

   Laid out as a document rather than a web page: one column, a header
   band, and sections that read top to bottom, so what prints is what the
   screen shows. Nothing links here from anywhere on the site.
   ========================================================================== */
function pageResume() {
    var name = rcfg("aboutName", cfg("brandName", "Résumé"));
    var headline = rcfg("headline", rcfg("aboutRole", cfg("role", "")));
    var tagline = rcfg("tagline", [cfg("role"), cfg("location")].filter(Boolean).join(" · "));
    var summary = rcfg("summary", cfg("aboutBody", ""));
    var photo = ron("showPhoto", "yes") ? rcfg("photoUrl", cfg("aboutImageUrl", "")) : "";

    var pdf = rcfg("pdfUrl", cfg("resumeUrl", ""));
    var note = rcfg("availabilityNote", cfg("availabilityStatus", ""));
    var updated = rcfg("updated", "");
    var mail = cfg("email", "");

    return '<article class="section page-top rz-page">' +
        '<div class="shell rz-shell">' +

        /* Screen-only controls, stripped from the printed sheet. */
        '<div class="rz-bar">' +
        '<span class="mono-label rz-flag"><i class="fa-solid fa-lock"></i> unlisted · not indexed</span>' +
        '<div class="rz-bar-actions">' +
        (pdf ? '<a class="btn btn-ghost btn-sm" href="' + esc(pdf) + '" target="_blank" rel="noopener">' +
            '<i class="fa-solid fa-file-arrow-down"></i>PDF</a>' : '') +
        '<button class="btn btn-ghost btn-sm" type="button" data-resume-print>' +
        '<i class="fa-solid fa-print"></i>Print / Save as PDF</button>' +
        '<a class="btn btn-accent btn-sm" href="' + esc(urlHome()) + '">' +
        '<i class="fa-solid fa-arrow-left"></i>Back to site</a>' +
        '</div></div>' +

        '<div class="rz-doc" id="resume-sheet">' +

        /* ── Header band ──────────────────────────────────────────── */
        '<header class="rz-head">' +
        (photo ? '<div class="rz-photo"><img src="' + esc(resolveAsset(photo)) + '" alt="' + esc(name) + '"></div>' : '') +
        '<div class="rz-ident">' +
        '<h1 class="rz-name">' + esc(name) + '</h1>' +
        (headline ? '<p class="rz-headline">' + esc(headline) + '</p>' : '') +
        (tagline ? '<p class="rz-tagline">' + esc(tagline) + '</p>' : '') +
        (summary ? '<p class="rz-summary">' + markup(summary) + '</p>' : '') +
        rzFigures() +
        '</div>' +
        '</header>' +

        '<div class="rz-contact">' + rzContact() + '</div>' +

        /* ── Body ─────────────────────────────────────────────────── */
        '<div class="rz-body">' +
        rzHistory() +
        rzProjects() +
        rzExpertise() +
        rzEducation() +
        rzExtras() +
        '</div>' +

        ((note || updated || mail) ? '<footer class="rz-foot">' +
            '<span>' + esc(note) +
            (note && mail ? ' · ' : '') +
            (mail ? '<a href="mailto:' + esc(mail) + '">Let\'s connect</a>' : '') + '</span>' +
            (updated ? '<span class="rz-updated">Updated ' + esc(updated) + '</span>' : '') +
            '</footer>' : '') +

        '</div></div></article>';
}

/* ── Section shell ────────────────────────────────────────────────────
   Dropped whole when its body came back empty, so an unfilled sheet
   leaves no orphan heading behind. */
function rzSec(title, body, cls) {
    if (!body) return "";
    return '<section class="rz-sec' + (cls ? ' ' + cls : '') + '">' +
        '<h2 class="rz-h">' + esc(title) + '</h2>' + body + '</section>';
}

/* ── Dates ────────────────────────────────────────────────────────────
   The sheet writes dates however it likes — "2019", "Mar 2023",
   "Present". Both forms are parsed so a tenure can be shown beside the
   range; anything unparseable simply shows no tenure rather than a
   wrong one. */
var RZ_MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function rzDate(v) {
    var s = String(v || "").trim();
    if (!s) return null;

    var now = new Date();
    if (/^(present|current|now|ongoing|to date)$/i.test(s)) {
        return { y: now.getFullYear(), m: now.getMonth(), coarse: false };
    }

    var md = s.match(/^([A-Za-z]{3,})\.?\s+(\d{4})$/);
    if (md) {
        var mi = RZ_MONTHS.indexOf(md[1].slice(0, 3).toLowerCase());
        if (mi > -1) return { y: parseInt(md[2], 10), m: mi, coarse: false };
    }

    var yd = s.match(/^(\d{4})$/);
    if (yd) return { y: parseInt(yd[1], 10), m: 0, coarse: true };

    return null;
}

function rzSpan(start, end) {
    var a = rzDate(start), b = rzDate(end);
    if (!a || !b) return "";

    // A year-only start can't honestly claim months: "2026 – Present" would
    // otherwise read "8 mos" purely because January was assumed.
    if (a.coarse) {
        var yrs = b.y - a.y;
        return yrs >= 1 ? yrs + " yr" + (yrs > 1 ? "s" : "") : "";
    }

    var months = (b.y - a.y) * 12 + (b.m - a.m) + 1;
    if (months < 1) return "";

    var y = Math.floor(months / 12), m = months % 12, out = [];
    if (y) out.push(y + " yr" + (y > 1 ? "s" : ""));
    if (m) out.push(m + " mo" + (m > 1 ? "s" : ""));
    return out.join(" ");
}

/* ── Experience ───────────────────────────────────────────────────────
   🗓 Experience split on its Type column. Education is peeled off into
   its own block further down; anything the sheet invents ("Volunteering")
   keeps its own label and gets its own block. */
function rzGroups() {
    var order = [], byLabel = {};

    EXP.filter(function (e) { return on2(e.show); }).forEach(function (e) {
        var raw = String(e.type || "").trim();
        var k = raw.toLowerCase();
        var label = (!raw || /^(work|job|employment|experience|career|freelance)/.test(k))
            ? "__work"
            : /^(edu|study|academic|school|degree)/.test(k) ? "__edu" : raw;

        if (!byLabel[label]) { byLabel[label] = { label: label, items: [] }; order.push(label); }
        byLabel[label].items.push(e);
    });

    return order.map(function (l) { return byLabel[l]; });
}

function rzHistory() {
    var out = "";

    rzGroups().forEach(function (g) {
        if (g.label === "__edu") return;
        var title = g.label === "__work" ? rcfg("experienceTitle", "Experience") : g.label;
        out += rzSec(title, '<div class="rz-entries">' + g.items.map(rzJob).join("") + '</div>');
    });

    return out;
}

function rzJob(e) {
    var when = [e.start, e.end].filter(Boolean).join(" – ");
    var span = rzSpan(e.start, e.end);
    var tags = listOf(e.tags);

    return '<article class="rz-entry">' +
        '<div class="rz-entry-head">' +
        '<div class="rz-entry-id">' +
        '<h3>' + esc(e.org || e.title) + '</h3>' +
        (e.org ? '<p class="rz-role-line">' + esc(e.title) + '</p>' : '') +
        '</div>' +
        '<div class="rz-entry-when">' +
        (when ? '<span class="rz-when">' + esc(when) + '</span>' : '') +
        (span ? '<span class="rz-span">' + esc(span) + '</span>' : '') +
        (e.location ? '<span class="rz-place">' + esc(e.location) + '</span>' : '') +
        '</div>' +
        '</div>' +
        (e.meta ? '<p class="rz-meta">' + esc(e.meta) + '</p>' : '') +
        rzBullets(e.description) +
        (tags.length ? '<div class="rz-tags rz-tags-inline">' +
            '<span class="rz-tags-label">Stack</span>' +
            tags.map(function (t) { return '<span class="rz-tag">' + esc(t) + '</span>'; }).join("") +
            '</div>' : '') +
        '</article>';
}

/* A description holding several lines reads as bullets; a single line
   stays a paragraph rather than a lone stranded bullet. */
function rzBullets(text) {
    var ls = lines(text);
    if (!ls.length) return "";
    if (ls.length === 1) return '<p class="rz-p">' + esc(ls[0]) + '</p>';

    return '<ul class="rz-ul">' + ls.map(function (l) {
        return '<li>' + esc(l.replace(/^[-•·*]\s*/, "")) + '</li>';
    }).join("") + '</ul>';
}

/* ── Selected projects ────────────────────────────────────────────── */
function rzProjects() {
    var all = PROJECTS.filter(function (p) { return on2(p.show) && p.title; });
    if (!all.length) return "";

    var n = parseInt(rcfg("projectsCount", "4"), 10);
    if (isNaN(n) || n < 1) n = 4;

    var list = all.filter(isFeatured)
        .concat(all.filter(function (p) { return !isFeatured(p); }))
        .slice(0, n);

    return rzSec(rcfg("projectsTitle", "Selected Projects"),
        '<div class="rz-projects">' + list.map(function (p) {
            var tags = listOf(p.tags).slice(0, 6);
            var meta = [p.client, p.year].filter(Boolean).join(" · ");
            return '<article class="rz-project">' +
                '<div class="rz-entry-head">' +
                '<h3>' + esc(p.title) + '</h3>' +
                (meta ? '<span class="rz-when">' + esc(meta) + '</span>' : '') +
                '</div>' +
                (tags.length ? '<p class="rz-stack">' + esc(tags.join(" · ")) + '</p>' : '') +
                (p.summary ? '<p class="rz-p">' + esc(p.summary) + '</p>' : '') +
                '</article>';
        }).join("") + '</div>');
}

/* ── Technical expertise ──────────────────────────────────────────────
   🧠 Skills categories become labelled tag rows; 🧰 Tools joins them as
   a final row so the whole stack reads in one block. */
function rzExpertise() {
    var rows = SKILLS.filter(function (s) { return on2(s.show) && s.category; }).map(function (s) {
        return { label: s.category, items: listOf(s.items) };
    });

    if (ron("showTools", "yes")) {
        var tools = TOOLS.filter(function (t) { return on2(t.show) && t.name; })
            .map(function (t) { return t.name; });
        if (tools.length) rows.push({ label: rcfg("toolsLabel", "Tools & Platforms"), items: tools });
    }

    rows = rows.filter(function (r) { return r.items.length; });
    if (!rows.length) return "";

    return rzSec(rcfg("skillsTitle", "Technical Expertise"),
        '<div class="rz-stack-grid">' + rows.map(function (r) {
            return '<div class="rz-stack-row">' +
                '<h4>' + esc(r.label) + '</h4>' +
                '<div class="rz-tags">' + r.items.map(function (i) {
                    return '<span class="rz-tag">' + esc(i) + '</span>';
                }).join("") + '</div>' +
                '</div>';
        }).join("") + '</div>');
}

/* ── Education ────────────────────────────────────────────────────── */
function rzEducation() {
    var g = null;
    rzGroups().forEach(function (x) { if (x.label === "__edu") g = x; });
    if (!g) return "";

    // Résumés normally list the degree, not an essay about it. The full
    // description stays in the sheet and on the site's Experience section;
    // 📄 Resume → "Education Detail: Yes" brings it back here.
    var detail = ron("educationDetail", "no");

    return rzSec(rcfg("educationTitle", "Education"),
        '<div class="rz-edu">' + g.items.map(function (e) {
            var when = [e.start, e.end].filter(Boolean).join(" – ");
            return '<article class="rz-edu-item">' +
                '<div class="rz-entry-head">' +
                '<h3>' + esc(e.title) + (e.meta ? '<span class="rz-gpa">' + esc(e.meta) + '</span>' : '') + '</h3>' +
                (when ? '<span class="rz-when">' + esc(when) + '</span>' : '') +
                '</div>' +
                (e.org ? '<p class="rz-role-line">' + esc([e.org, e.location].filter(Boolean).join(" · ")) + '</p>' : '') +
                (detail && e.description ? '<p class="rz-p">' + esc(lines(e.description).join(" ")) + '</p>' : '') +
                '</article>';
        }).join("") + '</div>');
}

/* ── 🏅 Resume Extras ─────────────────────────────────────────────────
   Whatever the sheet groups together becomes a block, in the order the
   groups first appear. Two blocks sit side by side on a wide screen. */
function rzExtras() {
    var order = [], byGroup = {};

    RXTRA.filter(function (r) { return on2(r.show) && r.item; }).forEach(function (r) {
        var g = String(r.group || "Highlights").trim();
        if (!byGroup[g]) { byGroup[g] = []; order.push(g); }
        byGroup[g].push(r);
    });

    if (!order.length) return "";

    return '<div class="rz-extras">' + order.map(function (g) {
        return rzSec(g, '<ul class="rz-ul rz-ul-plain">' + byGroup[g].map(function (r) {
            return '<li>' + esc(r.item) +
                (r.detail ? '<span class="rz-detail">' + esc(r.detail) + '</span>' : '') + '</li>';
        }).join("") + '</ul>', "rz-sec-extra");
    }).join("") + '</div>';
}

/* ── Header pieces ────────────────────────────────────────────────── */

/* 📊 Stats, printed as static figures — the animated counters used on the
   home page would land on a half-counted number inside a PDF. */
function rzFigures() {
    if (!ron("showStats", "yes")) return "";
    var list = STATS.filter(function (s) { return on2(s.show) && s.value; }).slice(0, 4);
    if (!list.length) return "";

    return '<div class="rz-figures">' + list.map(function (s) {
        return '<span class="rz-figure"><b>' + esc(s.value) + '</b> ' + esc(s.label || "") + '</span>';
    }).join("") + '</div>';
}

function rzContact() {
    var items = [];
    var loc = cfg("location"), mail = cfg("email"), wa = cfg("whatsappNumber"), site = cfg("siteUrl");

    if (loc) items.push(["fa-solid fa-location-dot", esc(loc), ""]);
    if (mail) items.push(["fa-solid fa-envelope", esc(mail), "mailto:" + mail]);
    if (wa) items.push(["fa-solid fa-phone", esc(wa), "tel:" + String(wa).replace(/[^\d+]/g, "")]);
    if (site) items.push(["fa-solid fa-globe", esc(rzHost(site)), site]);

    SOCIAL.filter(function (s) { return on2(s.show) && s.url; }).forEach(function (s) {
        items.push([icon(s.icon, "fa-solid fa-link"), esc(rzHost(s.url)), s.url, s.platform]);
    });

    return items.map(function (it) {
        var body = '<i class="' + esc(it[0]) + '" aria-hidden="true"></i><span>' + it[1] + '</span>';
        return it[2]
            ? '<a class="rz-c" href="' + esc(it[2]) + '"' +
            (/^https?:/i.test(it[2]) ? ' target="_blank" rel="noopener"' : '') +
            (it[3] ? ' title="' + esc(it[3]) + '"' : '') + '>' + body + '</a>'
            : '<span class="rz-c">' + body + '</span>';
    }).join("");
}

/* A printed résumé reads better as "github.com/name" than as a full URL. */
function rzHost(url) {
    return String(url || "").replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");
}

function crumbs(items) {
    return '<nav class="crumbs" aria-label="Breadcrumb">' + items.map(function (it, i) {
        var sep = i ? '<i class="fa-solid fa-angle-right"></i>' : '';
        return sep + (it[1]
            ? '<a href="' + esc(it[1]) + '" data-route>' + esc(it[0]) + '</a>'
            : '<span aria-current="page">' + esc(it[0]) + '</span>');
    }).join("") + '</nav>';
}

/* ── TESTIMONIALS ─────────────────────────────────────────────────────── */
// function tstHTML(n) {
//     var list = TSTS.filter(function (t) { return on2(t.show); });
//     if (!list.length) return "";

//     var cards = list.map(function (t, i) {
//         var r = Math.max(0, Math.min(5, Number(t.rating) || 5));
//         return '<article class="card tst" data-reveal style="--d:' + (i % 3 * 90) + 'ms">' +
//             '<span class="quote-mark">&ldquo;</span>' +
//             '<blockquote>' + esc(t.quote) + '</blockquote>' +
//             '<div class="tst-foot">' + avatar(t.avatar, t.name) +
//             '<div class="tst-who"><b>' + esc(t.name) + '</b><span>' + esc(t.role || t.project || "") + '</span></div>' +
//             starsHTML(r) +
//             '</div></article>';
//     }).join("");

//     return '<section id="testimonials" class="section"><div class="shell">' +
//         secHead("testimonials", n, true) +
//         '<div class="tst-grid">' + cards + '</div></div></section>';
// }


/* ── TESTIMONIALS ─────────────────────────────────────────────────────── */
/* Rating stars. Uses the same fa-solid fa-star proj-star icon as the
   Featured marker on a project card; .stars neutralises the absolute
   positioning that class carries there. */
function starsHTML(rating) {
    var r = Math.max(0, Math.min(5, Number(rating) || 0));
    var out = "";
    for (var i = 0; i < r; i++) out += '<i class="fa-solid fa-star proj-star"></i>';
    return '<span class="stars" aria-label="' + r + ' out of 5">' + out + '</span>';
}

/* ── TESTIMONIALS ─────────────────────────────────────────────────────── */
function tstHTML(n) {
    var list = TSTS.filter(function (t) { return on2(t.show); });
    if (!list.length) return "";

    // Duplicate the list for seamless infinite scroll
    var allCards = list.concat(list).concat(list);

    var cards = allCards.map(function (t, i) {
        var r = Math.max(0, Math.min(5, Number(t.rating) || 5));
        return '<article class="card tst" data-reveal style="--d:' + (i % 3 * 90) + 'ms">' +
            '<span class="quote-mark">&ldquo;</span>' +
            '<blockquote>' + esc(t.quote) + '</blockquote>' +
            '<div class="tst-foot">' + avatar(t.avatar, t.name) +
            '<div class="tst-who"><b>' + esc(t.name) + '</b><span>' + esc(t.role || t.project || "") + '</span></div>' +
            starsHTML(r) +
            '</div></article>';
    }).join("");

    // Check if motion preference is reduced
    var prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var scrollClass = prefersReduced ? 'tst-grid' : 'tst-scroll-container';
    var trackClass = prefersReduced ? '' : 'tst-scroll-track';

    // If reduced motion, show as grid instead
    if (prefersReduced) {
        return '<section id="testimonials" class="section"><div class="shell">' +
            secHead("testimonials", n, true) +
            '<div class="tst-grid">' + 
            list.map(function (t, i) {
                var r = Math.max(0, Math.min(5, Number(t.rating) || 5));
                return '<article class="card tst" data-reveal style="--d:' + (i * 70) + 'ms">' +
                    '<span class="quote-mark">&ldquo;</span>' +
                    '<blockquote>' + esc(t.quote) + '</blockquote>' +
                    '<div class="tst-foot">' + avatar(t.avatar, t.name) +
                    '<div class="tst-who"><b>' + esc(t.name) + '</b><span>' + esc(t.role || t.project || "") + '</span></div>' +
                    starsHTML(r) +
                    '</div></article>';
            }).join("") +
            '</div></div></section>';
    }

    // FULL WIDTH - no shell wrapper
    return '<section id="testimonials" class="section">' +
        '<div class="shell">' +
        secHead("testimonials", n, true) +
        '</div>' +
        '<div class="' + scrollClass + '">' +
        '<div class="' + trackClass + '">' + cards + '</div>' +
        '</div>' +
        '</section>';
}

/* ── SERVICES ─────────────────────────────────────────────────────────── */
function svcHTML(n) {
    var list = SVCS.filter(function (s) { return on2(s.show); });
    if (!list.length) return "";

    var cards = list.map(function (s, i) {
        var bl = lines(s.bullets).map(function (b) {
            return '<li><i class="fa-solid fa-check"></i><span>' + esc(b) + '</span></li>';
        }).join("");
        return '<article class="card svc" data-reveal style="--d:' + (i % 3 * 90) + 'ms">' +
            '<span class="svc-num">' + (i < 9 ? "0" : "") + (i + 1) + '</span>' +
            '<div class="svc-ico"><i class="' + esc(icon(s.icon, "fa-solid fa-gear")) + '"></i></div>' +
            '<h3>' + esc(s.title) + '</h3>' +
            '<p>' + esc(s.description) + '</p>' +
            (bl ? '<ul>' + bl + '</ul>' : '') +
            (s.price || s.buttonText ? '<div class="svc-foot">' +
                (s.price ? '<span class="svc-price">' + esc(s.price) + '</span>' : '<span></span>') +
                '<a class="btn btn-ghost btn-sm" href="' + esc(s.buttonLink || "#contact") + '">' +
                esc(s.buttonText || "Enquire") + '</a></div>' : '') +
            '</article>';
    }).join("");

    return '<section id="services" class="section"><div class="shell">' +
        secHead("services", n, true) +
        '<div class="svc-grid">' + cards + '</div></div></section>';
}

/* ── EXPERIENCE ───────────────────────────────────────────────────────── */
function expHTML(n) {
    var list = EXP.filter(function (e) { return on2(e.show); });
    if (!list.length) return "";

    var items = list.map(function (e, i) {
        var when = [e.start, e.end].filter(Boolean).join(" — ");
        return '<div class="tl-item" data-reveal style="--d:' + (i * 70) + 'ms">' +
            (when ? '<span class="tl-when">' + esc(when) + (e.type ? ' · ' + esc(e.type) : '') + '</span>' : '') +
            '<h3>' + esc(e.title) + '</h3>' +
            '<div class="tl-org">' + esc([e.org, e.location].filter(Boolean).join(" · ")) + '</div>' +
            (e.description ? '<p>' + esc(e.description) + '</p>' : '') +
            '</div>';
    }).join("");

    return '<section id="experience" class="section"><div class="shell">' +
        secHead("experience", n) +
        '<div class="tl">' + items + '</div></div></section>';
}

/* ── FAQ ──────────────────────────────────────────────────────────────── */
function faqHTML(n) {
    var list = FAQS.filter(function (f) { return on2(f.show); });
    if (!list.length) return "";

    var items = list.map(function (f, i) {
        return '<div class="faq-item" data-reveal style="--d:' + (i * 50) + 'ms">' +
            '<button class="faq-q" aria-expanded="false"><span class="qn">' + pad(i + 1) + '</span>' +
            '<span>' + esc(f.question) + '</span><i class="fa-solid fa-chevron-down chev"></i></button>' +
            '<div class="faq-a"><p>' + esc(f.answer) + '</p></div></div>';
    }).join("");

    return '<section id="faq" class="section"><div class="shell">' +
        secHead("faq", n, true) +
        '<div class="faq-wrap">' + items + '</div>' +
        '<div class="faq-cta" data-reveal><h3>Still have questions?</h3>' +
        '<p>Happy to answer anything specific about your project.</p>' +
        '<a class="btn btn-accent" href="#contact">Ask me anything<i class="fa-solid fa-arrow-right"></i></a>' +
        '</div></div></section>';
}

/* ── CONTACT ──────────────────────────────────────────────────────────── */
function contactHTML(n) {
    var linesHtml = "";
    function line(icn, k, v, href) {
        if (!v) return "";
        var inner = '<i class="' + icn + '"></i><span><span class="k">' + k + '</span>' +
            '<span class="v">' + esc(v) + '</span></span>';
        return href
            ? '<a class="contact-line" href="' + esc(href) + '" target="_blank" rel="noopener">' + inner + '</a>'
            : '<div class="contact-line">' + inner + '</div>';
    }

    var wa = String(cfg("whatsAppNumber", "")).replace(/[^\d]/g, "");
    linesHtml += line("fa-solid fa-envelope", "Email", cfg("email"), cfg("email") ? "mailto:" + cfg("email") : "");
    linesHtml += line("fa-brands fa-whatsapp", "WhatsApp", cfg("whatsAppNumber"), wa ? "https://wa.me/" + wa : "");
    linesHtml += line("fa-solid fa-location-dot", "Based in", cfg("location"));
    linesHtml += line("fa-solid fa-calendar-check", "Book a call", cfg("bookingLabel", "Schedule a slot"), cfg("bookingUrl"));

    var why = lines(cfg("whyList")).map(function (w) {
        return '<li><i class="fa-solid fa-circle-check"></i><span>' + esc(w) + '</span></li>';
    }).join("");

    function sel(id, label, key, required) {
        var opts = (FORMOPTS[key] || []).map(function (o) {
            return '<option value="' + esc(o) + '">' + esc(o) + '</option>';
        }).join("");
        if (!opts) return "";
        return '<div class="field"><label for="' + id + '">' + label +
            (required ? ' <span class="req">*</span>' : '') + '</label>' +
            '<select id="' + id + '"' + (required ? ' required' : '') + '>' +
            '<option value="">Select…</option>' + opts + '</select></div>';
    }

    return '<section id="contact" class="section"><div class="shell">' +
        secHead("contact", n) +
        '<div class="contact-grid">' +
        '<div class="contact-info" data-reveal>' +
        (cfg("contactHeading") ? '<h3>' + markup(cfg("contactHeading")) + '</h3>' : '') +
        (cfg("contactBody") ? '<p>' + esc(cfg("contactBody")) + '</p>' : '') +
        '<div class="contact-lines">' + linesHtml + '</div>' +
        (why ? '<div><span class="mono-label" style="margin-bottom:.8rem">Why work with me</span>' +
            '<ul class="why-list">' + why + '</ul></div>' : '') +
        // '<div class="social-row">' + socialHTML(false) + '</div>' +
        '</div>' +

        '<form class="form-card" id="contact-form" data-reveal style="--d:120ms" novalidate>' +
        '<div class="form-row">' +
        '<div class="field"><label for="f-name">Name <span class="req">*</span></label>' +
        '<input id="f-name" type="text" placeholder="Your name" required></div>' +
        '<div class="field"><label for="f-email">Email <span class="req">*</span></label>' +
        '<input id="f-email" type="email" placeholder="you@company.com" required></div>' +
        '</div>' +
        sel("f-type", "Project type", "projectType", true) +
        '<div class="form-row">' +
        sel("f-timeline", "Timeline", "timeline") +
        sel("f-budget", "Budget", "budget") +
        '</div>' +
        '<div class="field"><label for="f-msg">Message <span class="req">*</span></label>' +
        '<textarea id="f-msg" placeholder="What does the task look like today — what do you open, click and copy?" required></textarea></div>' +
        '<button type="submit" class="btn btn-accent btn-block" id="f-submit">' +
        'Send message<i class="fa-solid fa-arrow-right"></i></button>' +
        '<div class="form-note"><i class="fa-solid fa-shield-halved"></i>' +
        esc(cfg("responseNote", "I reply within 24 hours.")) + '</div>' +
        '</form>' +

        '</div></div></section>';
}

/* ── FOOTER ───────────────────────────────────────────────────────────── */
function renderFooter() {
    $("#site-footer").innerHTML = '<div class="shell">' +
        '<div class="foot-top">' +
        '<div class="foot-brand"><span class="fb-name">' + esc(cfg("brandName")) + '</span>' +
        '<span class="fb-tag">' + esc(cfg("footerTagline")) + '</span></div>' +
        '<div class="social-row">' + socialHTML(false) + '</div>' +
        '</div>' +
        '<div class="foot-bot">' +
        '<span>' + esc(cfg("copyrightText")) + '</span>' +
        '<span class="foot-status"><span class="status-dot"></span>' +
        esc(cfg("statusText", "")) + (cfg("versionLabel") ? ' · ' + esc(cfg("versionLabel")) : '') +
        '</span></div></div>';
}

/* ==========================================================================
   INTERACTION LAYER
   ========================================================================== */
/* Observers are per-page. Anything still watching the previous page's DOM is
   torn down before the new page wires itself up. */
var OBSERVERS = [];

function watch(io) { OBSERVERS.push(io); return io; }

function resetObservers() {
    OBSERVERS.forEach(function (o) { try { o.disconnect(); } catch (e) { } });
    OBSERVERS = [];
    REVEAL_IO = null;
}

/* deferReveal is used on first paint only: the preloader fires revealer()
   itself as the curtain lifts. Route changes call initUI() bare. */
function initUI(deferReveal) {
    resetObservers();
    initSmoothScroll();
    if (!deferReveal) revealer();
    counters();
    meters();
    scrollSpy();
    wireFaq();
    wireForm();
}

/* ── Smooth scrolling (Lenis) ─────────────────────────────── */
/* Scoped deliberately tightly:
     • only the window scroller is virtualised
     • anything marked [data-lenis-prevent] (project panel, drawer) keeps
       its own native scrolling
     • Lenis is stopped outright while an overlay is open
     • the native "scroll" event still fires, so the progress bar, sticky
       header, scroll-spy and every IntersectionObserver are untouched
     • skipped entirely for prefers-reduced-motion, or Smooth Scroll: No  */

function initSmoothScroll(attempt) {
    if (LENIS) return;
    if (!on("smoothScroll", "yes")) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // The CDN may still be in flight if the sheet responded from cache.
    if (typeof Lenis === "undefined") {
        var n = attempt || 0;
        if (n < 20) setTimeout(function () { initSmoothScroll(n + 1); }, 100);
        return;
    }

    var dur = parseFloat(cfg("smoothScrollDuration", 1.1));
    if (isNaN(dur) || dur <= 0) dur = 1.1;

    LENIS = new Lenis({
        duration: dur,
        easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
        smoothWheel: true,
        syncTouch: false,      // leave native momentum alone on touch devices
        touchMultiplier: 1.6,
        prevent: function (node) {
            return !!(node && node.hasAttribute && node.hasAttribute("data-lenis-prevent"));
        }
    });

    function frame(time) {
        LENIS.raf(time);
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}

/* One place that knows how to freeze the page behind an overlay. */
function scrollLock(locked) {
    document.body.classList.toggle("locked", !!locked);
    if (!LENIS) return;
    if (locked) LENIS.stop(); else LENIS.start();
}

/* scroll-padding-top is already declared in the stylesheet and, unlike the
   live header height, does not change when the header shrinks on scroll. */
function headerOffset() {
    var pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop);
    if (!isNaN(pad) && pad > 0) return pad;
    var h = $("#site-header");
    return (h ? h.offsetHeight : 72) + 18;
}

/* Resolve the destination to an absolute pixel value from the real scroll
   position rather than letting Lenis resolve the element itself — that keeps
   it correct even if something else moved the page mid-flight. */
function scrollToEl(target) {
    if (!target) return;
    var y = Math.max(0, target.getBoundingClientRect().top +
        (window.scrollY || window.pageYOffset) - headerOffset());

    if (LENIS) LENIS.scrollTo(y, { duration: 1.2, force: true });
    else window.scrollTo({ top: y, behavior: "smooth" });
}

function scrollToTop() {
    if (LENIS) LENIS.scrollTo(0, { duration: 1.2, force: true });
    else window.scrollTo({ top: 0, behavior: "smooth" });
}


/* ── Scroll reveal ───────────────────────────────────────────────────── */
var REVEAL_IO = null;
function revealer() {
    if (!("IntersectionObserver" in window)) {
        $$("[data-reveal]").forEach(function (el) { el.classList.add("in"); });
        return;
    }
    if (!REVEAL_IO) {
        REVEAL_IO = watch(new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                if (en.isIntersecting) {
                    en.target.classList.add("in");
                    REVEAL_IO.unobserve(en.target);
                }
            });
        }, { rootMargin: "0px 0px -8% 0px", threshold: .08 }));
    }
    $$("[data-reveal]:not(.in)").forEach(function (el) { REVEAL_IO.observe(el); });
}

/* ── Animated stat counters ──────────────────────────────────────────── */
function counters() {
    if (!("IntersectionObserver" in window)) return;

    var io = watch(new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
            if (!en.isIntersecting) return;
            io.unobserve(en.target);

            var el = en.target;
            var raw = String(el.getAttribute("data-count") || "");
            var num = parseFloat(raw.replace(/[^0-9.]/g, ""));
            if (isNaN(num)) return;

            // Keep whatever decoration the sheet used (<, +, %, k, h …)
            var pre = raw.slice(0, raw.search(/[0-9]/));
            var post = raw.slice(raw.search(/[0-9]/)).replace(/^[0-9.,]+/, "");
            var dec = (raw.split(".")[1] || "").replace(/[^0-9]/g, "").length;
            var start = performance.now(), dur = 1400;

            function tick(now) {
                var t = Math.min(1, (now - start) / dur);
                var eased = 1 - Math.pow(1 - t, 3);
                var v = num * eased;
                el.textContent = pre + (dec ? v.toFixed(dec) : Math.round(v).toLocaleString("en-US")) + post;
                if (t < 1) requestAnimationFrame(tick);
            }
            requestAnimationFrame(tick);
        });
    }, { threshold: .5 }));

    $$("[data-count]").forEach(function (el) { io.observe(el); });
}

/* ── Skill meters ────────────────────────────────────────────────────── */
function meters() {
    if (!("IntersectionObserver" in window)) return;
    var io = watch(new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
            if (!en.isIntersecting) return;
            io.unobserve(en.target);
            en.target.style.width = Math.max(0, Math.min(100, Number(en.target.getAttribute("data-level")))) + "%";
        });
    }, { threshold: .4 }));
    $$("[data-level]").forEach(function (el) { io.observe(el); });
}

/* ── Active nav link ─────────────────────────────────────────────────── */
function scrollSpy() {
    // Only the home page has sections to spy on; elsewhere the Projects link
    // is highlighted by markActiveNav() instead.
    if (ROUTE.name !== "home") return;

    var sections = $$("main section[id]");
    if (!sections.length || !("IntersectionObserver" in window)) return;

    var io = watch(new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
            if (!en.isIntersecting) return;
            var id = "#" + en.target.id;
            $$("#nav-links a").forEach(function (a) {
                a.classList.toggle("active", a.getAttribute("href") === id);
            });
        });
    }, { rootMargin: "-45% 0px -50% 0px" }));

    sections.forEach(function (s) { io.observe(s); });
}

/* ── Header, progress bar, back-to-top ───────────────────────────────── */
function onScroll() {
    var y = window.scrollY || document.documentElement.scrollTop;
    $("#site-header").classList.toggle("stuck", y > 24);
    $("#to-top").classList.toggle("show", y > 700);
    $("#to-top").hidden = false;

    var h = document.documentElement.scrollHeight - window.innerHeight;
    $("#scroll-progress").style.width = (h > 0 ? (y / h) * 100 : 0) + "%";
}

/* ── Drawer ──────────────────────────────────────────────────────────── */
function drawer(open) {
    var d = $("#drawer"), v = $("#drawer-veil");
    if (open) {
        d.hidden = false; v.hidden = false;
        requestAnimationFrame(function () { d.classList.add("show"); v.classList.add("show"); });
        scrollLock(true);
    } else {
        d.classList.remove("show"); v.classList.remove("show");
        scrollLock(false);
        setTimeout(function () { d.hidden = true; v.hidden = true; }, 420);
    }
    $("#nav-burger").setAttribute("aria-expanded", open ? "true" : "false");
}

/* ── Project lookup ──────────────────────────────────────────────────── */
function findProject(slug) {
    for (var i = 0; i < PROJECTS.length; i++) if (PROJECTS[i].slug === slug) return PROJECTS[i];
    return null;
}

/* ── FAQ accordion ───────────────────────────────────────────────────── */
function wireFaq() {
    $$(".faq-q").forEach(function (btn) {
        btn.addEventListener("click", function () {
            var item = btn.parentElement;
            var body = item.querySelector(".faq-a");
            var isOpen = item.classList.contains("open");

            $$(".faq-item.open").forEach(function (o) {
                o.classList.remove("open");
                o.querySelector(".faq-a").style.maxHeight = "";
                o.querySelector(".faq-q").setAttribute("aria-expanded", "false");
            });

            if (!isOpen) {
                item.classList.add("open");
                body.style.maxHeight = body.scrollHeight + "px";
                btn.setAttribute("aria-expanded", "true");
            }
        });
    });
}

/* ── Contact form ────────────────────────────────────────────────────── */
function wireForm() {
    var form = $("#contact-form");
    if (!form) return;

    form.addEventListener("submit", function (e) {
        e.preventDefault();

        var payload = {
            action: "contact",
            name: $("#f-name").value.trim(),
            email: $("#f-email").value.trim(),
            projectType: $("#f-type") ? $("#f-type").value : "",
            timeline: $("#f-timeline") ? $("#f-timeline").value : "",
            budget: $("#f-budget") ? $("#f-budget").value : "",
            message: $("#f-msg").value.trim(),
            page: location.href
        };

        // Validate before anything leaves the browser.
        var bad = [];
        if (!payload.name) bad.push("f-name");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) bad.push("f-email");
        if ($("#f-type") && $("#f-type").required && !payload.projectType) bad.push("f-type");
        if (payload.message.length < 10) bad.push("f-msg");

        $$(".field").forEach(function (f) { f.classList.remove("bad"); });
        if (bad.length) {
            bad.forEach(function (id) {
                var el = document.getElementById(id);
                if (el) el.parentElement.classList.add("bad");
            });
            toast("Please check the highlighted fields.", "err");
            document.getElementById(bad[0]).focus();
            return;
        }

        var btn = $("#f-submit");
        btn.disabled = true;
        btn.innerHTML = '<span class="spin"></span> Sending…';

        if (!API_URL) {
            setTimeout(function () { formDone("DEMO-MODE"); }, 700);
            return;
        }

        // text/plain keeps this a "simple" request — Apps Script web apps
        // don't answer the CORS preflight that application/json would trigger.
        fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload)
        })
            .then(function (r) { return r.json(); })
            .then(function (res) {
                if (res && res.error) throw new Error(res.error);
                formDone(res && res.ref ? res.ref : "");
            })
            .catch(function (err) {
                console.error(err);
                btn.disabled = false;
                btn.innerHTML = 'Send message<i class="fa-solid fa-arrow-right"></i>';
                toast("Couldn't send that. Please email me directly.", "err");
            });
    });
}

function formDone(ref) {
    $("#contact-form").innerHTML =
        '<div class="form-done">' +
        '<span class="tick"><i class="fa-solid fa-check"></i></span>' +
        '<h3>Message sent</h3>' +
        '<p>' + esc(cfg("formSuccessMessage", "Thanks — I'll get back to you shortly.")) + '</p>' +
        (ref ? '<span class="ref">Ref: ' + esc(ref) + '</span>' : '') +
        '</div>';
    toast("Message sent successfully.", "ok");
}

/* ── Toast ───────────────────────────────────────────────────────────── */
var TOAST_T = null;
function toast(msg, kind) {
    var t = $("#toast");
    t.className = kind || "";
    t.innerHTML = '<i class="fa-solid ' + (kind === "err" ? "fa-circle-exclamation" : "fa-circle-check") +
        '"></i><span>' + esc(msg) + '</span>';
    t.hidden = false;
    requestAnimationFrame(function () { t.classList.add("show"); });
    clearTimeout(TOAST_T);
    TOAST_T = setTimeout(function () {
        t.classList.remove("show");
        setTimeout(function () { t.hidden = true; }, 400);
    }, 4200);
}

/* ==========================================================================
   GLOBAL LISTENERS
   ========================================================================== */
window.addEventListener("scroll", onScroll, { passive: true });

/* A plain left click with no modifier keys — anything else (new tab,
   new window, download) is left to the browser. */
function plainClick(e) {
    return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t || !t.closest) return;

    if (t.closest("#nav-burger")) { drawer(true); return; }
    if (t.closest("#drawer-close") || t.closest("#drawer-veil")) { drawer(false); return; }
    if (t.closest("#to-top")) { e.preventDefault(); scrollToTop(); return; }

    if (t.closest("[data-resume-print]")) { e.preventDefault(); window.print(); return; }

    // Category chips repaint the grid in place; no navigation involved.
    var chip = t.closest(".filter-btn");
    if (chip) {
        FILTER = chip.getAttribute("data-filter");
        refreshProjects();
        return;
    }

    var a = t.closest("a[href]");
    if (!a) return;

    var closing = false;
    if (a.hasAttribute("data-close-drawer")) { drawer(false); closing = true; }

    if (!plainClick(e) || a.target === "_blank" || a.hasAttribute("download")) return;

    var raw = a.getAttribute("href") || "";
    if (!raw || raw.charAt(0) === "?") return;

    // ── Same-page section anchor ────────────────────────────────────────
    if (raw.charAt(0) === "#") {
        if (raw.length < 2 || raw.indexOf("#project/") === 0) return;

        // On a project page the section lives on the home page.
        if (ROUTE.name !== "home") {
            e.preventDefault();
            go(urlHome(), raw);
            return;
        }
        var target = document.getElementById(raw.slice(1));
        if (!target) return;
        e.preventDefault();
        setTimeout(function () { scrollToEl(target); }, closing ? 140 : 0);
        if (history.replaceState) history.replaceState(null, "", raw);
        return;
    }

    // ── Internal navigation ─────────────────────────────────────────────
    var url;
    try { url = new URL(a.href, location.href); } catch (err) { return; }
    if (url.origin !== location.origin) return;

    var here = location.pathname + location.hash;
    if (url.pathname + url.hash === here) { e.preventDefault(); return; }

    e.preventDefault();
    setTimeout(function () {
        go(url.pathname + url.search, url.hash);
    }, closing ? 140 : 0);
});

/* Back / forward buttons. */
window.addEventListener("popstate", function () {
    enterRoute(location.hash);
});

document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if ($("#drawer") && $("#drawer").classList.contains("show")) drawer(false);
});

/* ── The typed way in ─────────────────────────────────────────────────
   Watches for the ⚙ Config trigger word being typed on any page. Only
   bare printable keys count, and never while a form field has focus, so
   writing "resume" into the contact message does nothing. The buffer is
   only as long as the word itself and clears after a pause, which keeps
   it from firing on text that merely happens to contain it. */
var RZ_BUF = "", RZ_TIMER = null;

document.addEventListener("keydown", function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (typeof e.key !== "string" || e.key.length !== 1) return;

    var t = e.target;
    if (t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName || ""))) return;

    var want = resumeTrigger();
    if (!want) return;

    RZ_BUF = (RZ_BUF + e.key.toLowerCase()).slice(-want.length);

    clearTimeout(RZ_TIMER);
    RZ_TIMER = setTimeout(function () { RZ_BUF = ""; }, 1600);

    if (RZ_BUF !== want) return;
    RZ_BUF = "";
    if (ROUTE.name !== "resume") go(urlResume());
});

/* Pointer glow — desktop only, and never when the user prefers less motion. */
if (window.matchMedia && window.matchMedia("(hover:hover) and (pointer:fine)").matches &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var glow = $("#cursor-glow"), gx = 0, gy = 0, cx = 0, cy = 0, running = false;

    window.addEventListener("mousemove", function (e) {
        gx = e.clientX; gy = e.clientY;
        if (!document.body.classList.contains("cursor-on") && on("cursorGlow")) {
            document.body.classList.add("cursor-on");
        }
        if (!running) { running = true; requestAnimationFrame(glide); }
    }, { passive: true });

    function glide() {
        cx += (gx - cx) * .12;
        cy += (gy - cy) * .12;
        glow.style.transform = "translate(" + cx + "px," + cy + "px) translate(-50%,-50%)";
        if (Math.abs(gx - cx) > .5 || Math.abs(gy - cy) > .5) requestAnimationFrame(glide);
        else running = false;
    }
}

/* Links shared before the move to real URLs still land in the right place. */
window.addEventListener("load", function () {
    var m = location.hash.match(/^#project\/(.+)$/);
    if (m) go(urlProject(decodeURIComponent(m[1])), "", true);
});

/* Re-measure an open FAQ answer when the viewport changes width. */
window.addEventListener("resize", function () {
    var open = $(".faq-item.open");
    if (open) open.querySelector(".faq-a").style.maxHeight = open.querySelector(".faq-a").scrollHeight + "px";
});

/* ── Go ──────────────────────────────────────────────────────────────── */
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
