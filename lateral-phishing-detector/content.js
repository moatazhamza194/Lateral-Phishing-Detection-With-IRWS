(() => {
  const icon = (name, color = "#333") =>
    `<span class="material-icons" style="color:${color}; vertical-align: middle;">${name}</span>`;

  const emailData = {
    from: document.querySelector('.sender-row strong')?.innerText || '(No sender)',
    to: document.querySelector('#email-details p:nth-child(2)')?.innerText.replace('to:', '').trim() || '(No recipient)',
    date: document.querySelector('#email-details p:nth-child(3)')?.innerText.replace('date:', '').trim() || '(No date)',
    subject: document.querySelector(".subject")?.innerText || "no subject",
    body: document.querySelector(".email-body")?.innerText || "no body",
    receiver_name: document.querySelector(".receiver-name")?.innerText.replace('to', '').trim() || "no name",
  };

  /**
 * Extract domains from an email body/string.
 * - Removes email addresses first.
 * - Parses <a href="..."> links from HTML (DOMParser when available).
 * - Finds raw URLs that start with http(s):// or www.
 * - Cleans/unwraps and extracts the domain, normalizes it, dedupes.
 *
 * Returns a Set of domains (lowercased, leading "www." removed).
 */

function extractDomainsFromEmail(text) {
  const domains = new Set();

  // 1) Strip email addresses entirely (avoid confusing URL detection)
  //    Equivalent to: r'\b[\w\.-]+@[\w\.-]+\.\w+\b'
  text = text.replace(/\b[\w.-]+@[\w.-]+\.\w+\b/g, '');

  // 2) Collect href links from HTML (if any)
  const hrefLinks = extractHrefLinks(text);

  // 3) Find raw URLs in text
  //    Equivalent to: r'\b(?:https?://|www\.)[^\s<>"\'@]+'
  const urlPattern = /\b(?:https?:\/\/|www\.)[^\s<>"'@]+/gi;
  const rawUrls = text.match(urlPattern) || [];

  // 4) Combine, clean, and extract domains
  const allUrls = [...hrefLinks, ...rawUrls];
  for (const url of allUrls) {
    const domain = cleanAndExtractDomain(url);
    if (domain) domains.add(domain);
  }

  return domains;
}

/**
 * Clean and extract a domain from a URL-ish string.
 */
function cleanAndExtractDomain(originalUrl) {
  try {
    let url = (originalUrl || '').trim();

    // Strip leading/trailing wrappers/punctuation:
    
    url = url.replace(/^[<\["'(\s]+|[>\]"' )\s.,;:=]+$/g, '');

    // Chop at first comma (note: this mirrors original behavior)
    const commaIdx = url.indexOf(',');
    if (commaIdx !== -1) {
      url = url.slice(0, commaIdx);
    }

    // Unwrap embedded URLs (take first http(s):// inside the string)
    
    const embeddedMatch = url.match(/https?:\/\/[^\s<>"'\])]+/i);
    if (embeddedMatch) {
      url = embeddedMatch[0];
    }

    // Parse URL: prefer WHATWG URL; if missing scheme, try to salvage later
    let parsed;
    try {
      // If it lacks a scheme but starts with "www.", give it "http://"
      if (!/^[a-z][a-z0-9+\-.]*:\/\//i.test(url) && /^www\./i.test(url)) {
        parsed = new URL('http://' + url);
      } else {
        parsed = new URL(url);
      }
    } catch {
      // Fallback: allow things like plain "example.com/path"
      // We'll try to parse as "http://..."
      try {
        parsed = new URL('http://' + url);
      } catch {
        parsed = null;
      }
    }

    // Domain from parsed.host (includes hostname[:port])
    let domain = parsed ? (parsed.host || '') : '';

    // Fallback for bare domain in "path" (when URL parsing failed above in Python)
    // Python check: r'^[\w.-]+\.[a-z]{2,}$' against parsed.path
    if (!domain && parsed) {
      const path = parsed.pathname || '';
      if (/^[\w.-]+\.[a-z]{2,}$/i.test(path)) {
        domain = path;
      }
    }

    // Remove trailing ":port"
    domain = domain.replace(/:\d+$/i, '');

    // Lowercase
    domain = domain.toLowerCase();

    // Remove a single leading "www." 
    // we keep behavior semantically intended by the Python and avoid the lstrip bug)
    domain = domain.replace(/^(www\.)/i, '');

    // Drop any trailing non [\w.-]
    domain = domain.replace(/[^\w.-]+$/g, '');

    // Final sanity: must contain a dot and no '@'
    if (domain.includes('.') && !domain.includes('@')) {
      return domain;
    }
  } catch {
    // swallow and return null (like the Python `except: pass`)
  }
  return null;
}

/** Utility: Extract hrefs from <a> tags in possible HTML.
 *  - Uses DOMParser in browsers.
 *  - Falls back to a conservative regex if DOM not available (Node).
 */
function extractHrefLinks(htmlish) {
  // Browser path: DOMParser available
  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(String(htmlish), 'text/html');
      const links = Array.from(doc.querySelectorAll('a[href]')).map(a => a.getAttribute('href'));
      return links.filter(Boolean);
    } catch {
      // fall through to regex fallback
    }
  }

  // Fallback: quick-and-dirty regex for href="..."/href='...'/href=...
  // This won’t resolve relative URLs (same as Python—relative links are ignored later anyway).
  const hrefs = [];
  const re = /<a\b[^>]*\bhref\s*=\s*(?:"([^"]+)"|'([^']+)'|([^>\s]+))[^>]*>/gi;
  let m;
  while ((m = re.exec(String(htmlish))) !== null) {
    hrefs.push(m[1] || m[2] || m[3] || '');
  }
  return hrefs.filter(Boolean);
}

const phishyKeywords = [
  "verify", "reset your password", "confirm your identity", "sign in", "unauthorized login",
  "your account", "update your account", "security alert", "click here", "login attempt",
  "secure message", "reactivate", "reset password", "confirm account", "your credentials",
  "important notice", "urgent", "immediate action", "unusual activity", "suspicious login",
  "account locked", "account suspended", "you must", "action required", "follow the link",
  "verify your email", "check the attachment", "shared document", "document has been shared",
  "view document", "dropbox", "onedrive", "sharepoint", "google drive", "view attachment",
  "encrypted message", "compliance notice", "security update", "new device", "you have received a message"
];


function containsPhishyKeyword(body, subject) {
  const text = (body + " " + subject).toLowerCase();
  return phishyKeywords.some(keyword => text.includes(keyword.toLowerCase()));
}

const be_emailData = {
  from : emailData.from,
  to : emailData.to,
  date : emailData.date,
  has_phishy_keywords: containsPhishyKeyword(emailData.body, emailData.subject),
  domains: Array.from(extractDomainsFromEmail(emailData.body))
}
  fetch("http://localhost:5000/predict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(be_emailData)
  })
    .then(res => res.json())
    .then(data => {
      console.log(data)
      if (!data || data.label !== 1) return;

      const senderEmail = emailData.from;
      const domain = data.domain;
      const receiver_name = emailData.receiver_name;

      const backdrop = document.createElement("div");
      backdrop.className = "phish-overlay-backdrop";
      document.body.appendChild(backdrop);

      const modal = document.createElement("div");
      modal.className = "phish-overlay-modal";
      document.body.appendChild(modal);

      

      const userAnswers = {};

      const askQuestions = [
        {
          key: "senderKnown",
          icon: icon("person"),
          question: `Hey <span style="color: #3a88c8;"><b>${receiver_name}</b></span>, do you usually get emails from <span style="color: #3a88c8;"><b>${senderEmail}</b></span>?`
        },
        {
          key: "volumeNormal",
          icon: icon("groups"),
          question: `Does it make sense for this message to be sent to <span style="color: #3a88c8;"><b>${data.features_used.NumRecipients}</b></span> people?`
        },
        {
          key: "domainFamiliar",
          icon: icon("language"),
          question: `Is the domain <span style="color: #3a88c8;"><b>${domain}</b></span> familiar to you?`
        }
      ];

      
const renderIntro = () => {
  modal.innerHTML = `
    <div class="summary-box summary-box--panel">
      <h2 style="margin-bottom: 12px;">${icon("warning", "#fbbc04")} Quick Security Check</h2>
      <p style="margin: 8px 0 14px; color:#555; font-size:13px; line-height:1.4;">
        This message looks <b>unusual</b> based on your organization’s email patterns.
        Before you continue, please answer a few quick questions to confirm if it’s safe.
      </p>
      <ul style="margin: 0 0 0 18px; padding:0; color:#444; font-size:13px; line-height:1.6; list-style-type:none;">
        <li><b>${icon("check_circle", "#3a88c8")} Yes</b>: You recognize it as normal.</li>
        <li><b>${icon("cancel", "#d93025")} No</b>: It feels suspicious.</li>
        <li><b>${icon("help", "#fbbc04")} Not sure</b>: You’re unsure — we’ll guide you cautiously.</li>
      </ul>
    </div>

    <div style="display:flex; gap:8px; justify-content:flex-end; margin-top: 12px;">
      <button class="btn btn--start">${icon("play_arrow", " #3a88c8")} Start</button>
      <button class="btn btn--dismiss">${icon("warning_amber", " #d93025")} Proceed Anyway</button>
    </div>
  `;

  
  modal.querySelector(".btn--start").addEventListener("click", renderQuestion);
  modal.querySelector(".btn--dismiss").addEventListener("click", () => {
    backdrop.remove();
    modal.remove();
  });
};


      let current = 0;

      const renderQuestion = () => {
        const q = askQuestions[current];
        const progressPercent = ((current + 1) / askQuestions.length) * 100;

        const isSecondQuestion = current === 1;

        const censorLinks = (text) => {
          const urlRegex = /https?:\/\/[^\s)>\],;]+[^\s)>\],;.!?]/gi;
          return text.replace(urlRegex, "[link censored]");
        };

       modal.innerHTML = `
        <div class="summary-box summary-box--panel">
          <h2 style="margin-bottom: 12px;">${icon("warning", "#fbbc04")} Quick Security Check</h2>

          <div style="background: #e6eef9; border-radius: 3px; overflow: hidden; margin-bottom: 6px; height: 4px;">
            <div style="width:${progressPercent}%; background: var(--brand-blue); height: 4px; transition: width 0.3s;"></div>
          </div>
          <p style="font-size: 12px; color: #555; margin-bottom: 12px;">Question ${current + 1} of ${askQuestions.length}</p>

          <div style="display: flex; gap: 16px; align-items: flex-start; flex-wrap: wrap;">
            <p style="flex: 1 1 300px; margin:0;">${q.icon} ${q.question}</p>
            ${
              isSecondQuestion
                ? `<pre class="nocopy" style="
                      flex: 1 1 300px;
                      max-height: 150px;
                      overflow-y: auto;
                      border: 1px solid rgba(0,0,0,.08);
                      border-radius: 6px;
                      padding: 12px;
                      font-family: monospace;
                      font-size: 13px;
                      background:#f8fafc;
                      box-shadow: 0 0 6px rgba(0,0,0,0.06);
                      white-space: pre-wrap;
                      word-wrap: break-word;
                    ">${censorLinks(emailData.body)}</pre>`
                : ''
            }
          </div>
        </div>

        <div style="margin-top: 12px;">
          <button class="btn answer" data-value="yes">${icon("check_circle", "#3a88c8")} Yes</button>
          <button class="btn answer" data-value="no">${icon("cancel", "#d93025")} No</button>
          <button class="btn answer" data-value="unsure">${icon("help", "#fbbc04")} Not sure</button>
        </div>
      `;
        hookResponses();
      };

      const hookResponses = () => {
        modal.querySelectorAll(".answer").forEach(btn => {
          btn.addEventListener("click", () => {
            const key = askQuestions[current].key;
            userAnswers[key] = btn.dataset.value;
            current++;
            if (current < askQuestions.length) {
              renderQuestion();
            } else {
              showSummary();
            }
          });
        });
      };


      function openFollowupPanel({ title, messageHTML, autoDismissMs = null, onClose = null }) {
        // Create fresh overlay (same classes/design)
        const backdrop2 = document.createElement("div");
        backdrop2.className = "phish-overlay-backdrop";
        document.body.appendChild(backdrop2);

        const modal2 = document.createElement("div");
        modal2.className = "phish-overlay-modal";
        document.body.appendChild(modal2);

        modal2.innerHTML = `
          <div class="summary-box summary-box--panel">
            <h2 style="margin-top:0;">${icon("info", "#3a88c8")} ${title}</h2>
            <div style="margin-top:8px; color:#444; font-size:13px; line-height:1.5;">
              ${messageHTML}
            </div>
          </div>
          <div class="action-buttons" style="margin-top:12px; display:flex; gap:8px; justify-content:flex-end;">
            <button class="btn btn--close">${icon("close", "#555")} Close</button>
          </div>
        `;

        const closeAll = () => {
          backdrop2.remove();
          modal2.remove();
          if (typeof onClose === "function") onClose();
        };

        modal2.querySelector(".btn--close").addEventListener("click", closeAll);

        if (autoDismissMs && Number.isFinite(autoDismissMs)) {
          setTimeout(closeAll, autoDismissMs);
        }

        return { backdrop2, modal2, closeAll };
      }

      const showSummary = () => {
        const statements = [];

        if (userAnswers.senderKnown === "no") {
          statements.push(`${icon("cancel", "red")} You don’t usually get emails from <span style="color: #3a88c8;"><b>${senderEmail}</b></span>`);
        } else if (userAnswers.senderKnown === "unsure") {
          statements.push(`${icon("help", "#fbbc04")} Not sure about the sender <span style="color: #3a88c8;"><b>${senderEmail}</b></span>`);
        }

        if (userAnswers.volumeNormal === "no") {
          statements.push(`${icon("groups", "red")} This message was sent to many people unexpectedly`);
        } else if (userAnswers.volumeNormal === "unsure") {
          statements.push(`${icon("groups", "#fbbc04")} Not sure about the recipient volume`);
        }

        if (userAnswers.domainFamiliar === "no") {
          statements.push(`${icon("language", "red")} The domain <span style="color: #3a88c8;"><b>${domain}</b></span> is unfamiliar`);
        } else if (userAnswers.domainFamiliar === "unsure") {
          statements.push(`${icon("language", "#fbbc04")} Not sure about the domain <span style="color: #3a88c8;"><b>${domain}</b></span>`);
        }

        if (
              userAnswers.domainFamiliar === "yes" &&
              userAnswers.senderKnown === "yes" &&
              userAnswers.volumeNormal === "yes"
            ) {
                statements.push(`${icon("info","#fbbc04" )} Please stay cautious and double-check before taking action`);
              }

        modal.innerHTML = `
          <div class="summary-box summary-box--panel">
            <h2 style="color: #d93025; margin-top:0;">${icon("report_problem", "#d93025")} Potential Risk Identified</h2>
            <div>
              ${statements.map(s => `<p style="margin:8px 0;">${s}</p>`).join("")}
            </div>
          </div>

          <div class="action-buttons">
            <button class="btn btn--verify">${icon("search", "#3a88c8")} Verify with Sender</button>
            <button class="btn btn--report">${icon("flag", "#fbbc04")} Report to Security</button>
            <button class="btn btn--proceed">${icon("warning_amber", "#d93025")} Proceed Anyway</button>
          </div>
        `;

      modal.querySelector(".btn--verify").addEventListener("click", () => {
        // Close the current panel
        backdrop.remove();
        modal.remove();

        // Open non-auto-dismissing verification panel
        const { backdrop2, modal2 } = openFollowupPanel({
          title: "Verify with Sender",
          messageHTML: `
            <p>Please verify this request out-of-band before clicking links or sharing information.</p>
            <div style="display:flex; flex-direction:column; gap:8px; margin-top:10px;">
              <div>
                <label style="font-size:12px; color:#666;">Sender</label><br/>
                <code style="font-size:13px;">${senderEmail}</code>
              </div>
              <div>
                <div style="margin-top:8px; display:flex; gap:8px;">
                  <button class="btn btn--call">${icon("call", "#3a88c8")} Call</button>
                  <button class="btn btn--mailto">${icon("mail", "#3a88c8")} Email</button>
                </div>
                <p style="font-size:12px; color:#888; margin-top:8px;">
                  Tip: use a known-good number (directory/contacts), not one in the email.
                </p>
              </div>
            </div>
          `,
        });

        // Attach listeners to the new modal
        modal2.querySelector(".btn--call").addEventListener("click", () => {
          backdrop2.remove();
          modal2.remove();
        });

        modal2.querySelector(".btn--mailto").addEventListener("click", () => {
          backdrop2.remove();
          modal2.remove();
        });
      });

      
      modal.querySelector(".btn--report").addEventListener("click", () => {
        // Close current panel
        backdrop.remove();
        modal.remove();

        // Open auto-dismissing confirmation (10s)
        openFollowupPanel({
          title: "Report Sent to Security",
          messageHTML: `
            <p>Your report has been sent to the organisation's security team.</p>
            <p style="font-size:12px; color:#888;">
              Reference: ${new Date().toLocaleString()}
            </p>
            <p style="font-size:12px; color:#666; margin-top:8px;">
              This window will close automatically in 10 seconds.
            </p>
          `,
          autoDismissMs: 10000
        });
      });
        modal.querySelector(".btn--proceed").addEventListener("click", () => {
          backdrop.remove();
          modal.remove();
        });
      };

      renderIntro();
    })
    .catch(err => console.error("Phishing check error:", err));
})();

