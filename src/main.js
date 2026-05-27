import "./style.css";

// 데이터를 읽어올 구글 시트 ID. .env 의 VITE_SHEET_ID 로 관리하며,
// 값이 없으면 아래 기본값을 사용합니다.
const SHEET_ID =
  import.meta.env.VITE_SHEET_ID || "13MDrpeSlfAryNCFf1T3tATxC7UnA9EZqK10qUj_zerg";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv`;

const PAGE_SIZE = 20; // 페이지당 표시 개수

let prompts = []; // 전체 데이터 { name, text }
let filtered = []; // 검색 필터 적용된 목록
let currentPage = 1;

const $search = document.getElementById("search");
const $content = document.getElementById("content");
const $count = document.getElementById("count");
const $pagination = document.getElementById("pagination");

// RFC4180 방식 CSV 파서: 따옴표, 내부 콤마, 줄바꿈 처리
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (c === "\r") {
        // 무시 (\r\n 처리)
      } else {
        field += c;
      }
    }
  }
  // 마지막 필드/행 처리
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function render() {
  if (prompts.length === 0) {
    $content.innerHTML =
      '<div class="state-msg">표시할 프롬프트가 없습니다.</div>';
    $count.hidden = true;
    $pagination.hidden = true;
    return;
  }
  if (filtered.length === 0) {
    $content.innerHTML = '<div class="state-msg">검색 결과가 없습니다.</div>';
    $count.hidden = false;
    $count.textContent = "0개 결과";
    $pagination.hidden = true;
    return;
  }

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  $count.hidden = false;
  $count.textContent = `총 ${filtered.length}개 · ${currentPage} / ${totalPages} 페이지`;

  const rowsHtml = pageItems
    .map((p, idx) => {
      return `
        <tr>
          <td class="col-name">${escapeHtml(p.name)}</td>
          <td class="col-prompt"><pre class="prompt-text" data-idx="${idx}" title="클릭하면 전체 보기">${escapeHtml(
            p.text
          )}</pre></td>
          <td class="col-copy">
            <button class="copy-btn" data-idx="${idx}">복사</button>
          </td>
        </tr>`;
    })
    .join("");

  $content.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>프롬프트 이름</th>
            <th>프롬프트</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>`;

  // 복사 버튼 바인딩 (현재 페이지 항목 기준)
  $content.querySelectorAll(".copy-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const p = pageItems[Number(btn.dataset.idx)];
      copyText(p.text, btn);
    });
  });

  // 프롬프트 클릭 시 모달로 전문 보기
  $content.querySelectorAll(".prompt-text").forEach((el) => {
    el.addEventListener("click", () => {
      openModal(pageItems[Number(el.dataset.idx)]);
    });
  });

  renderPagination(totalPages);
}

// 표시할 페이지 번호 목록 계산 (양 끝 + 현재 주변, 생략은 '...')
function pageNumbers(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages = [1];
  if (current > 3) pages.push("...");
  const s = Math.max(2, current - 1);
  const e = Math.min(total - 1, current + 1);
  for (let i = s; i <= e; i++) pages.push(i);
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}

function goToPage(p) {
  currentPage = p;
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderPagination(totalPages) {
  if (totalPages <= 1) {
    $pagination.hidden = true;
    $pagination.innerHTML = "";
    return;
  }
  $pagination.hidden = false;
  $pagination.innerHTML = "";

  const makeBtn = (label, page, opts = {}) => {
    const btn = document.createElement("button");
    btn.className = "page-btn" + (opts.active ? " active" : "");
    btn.textContent = label;
    if (opts.disabled) {
      btn.disabled = true;
    } else {
      btn.addEventListener("click", () => goToPage(page));
    }
    return btn;
  };

  $pagination.appendChild(
    makeBtn("이전", currentPage - 1, { disabled: currentPage === 1 })
  );

  pageNumbers(currentPage, totalPages).forEach((p) => {
    if (p === "...") {
      const span = document.createElement("span");
      span.className = "page-ellipsis";
      span.textContent = "…";
      $pagination.appendChild(span);
    } else {
      $pagination.appendChild(
        makeBtn(String(p), p, { active: p === currentPage })
      );
    }
  });

  $pagination.appendChild(
    makeBtn("다음", currentPage + 1, {
      disabled: currentPage === totalPages,
    })
  );
}

async function copyText(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    // 클립보드 API 실패 시 폴백
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch (_) {}
    document.body.removeChild(ta);
  }
  const original = btn.textContent;
  btn.textContent = "복사됨";
  btn.classList.add("copied");
  setTimeout(() => {
    btn.textContent = original;
    btn.classList.remove("copied");
  }, 1500);
}

function applyFilter() {
  const q = $search.value.trim().toLowerCase();
  if (!q) {
    filtered = prompts;
  } else {
    filtered = prompts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) || p.text.toLowerCase().includes(q)
    );
  }
  currentPage = 1; // 검색하면 첫 페이지로
  render();
}

async function load() {
  try {
    const res = await fetch(CSV_URL);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const csv = await res.text();
    const rows = parseCSV(csv);
    if (rows.length === 0) {
      prompts = [];
    } else {
      // 첫 행은 헤더로 간주, 나머지를 데이터로
      prompts = rows
        .slice(1)
        .map((r) => ({
          name: (r[0] || "").trim(),
          text: (r[1] || "").trim(),
        }))
        .filter((p) => p.name !== "" || p.text !== "");
    }
    filtered = prompts;
    currentPage = 1;
    $search.disabled = false;
    render();
  } catch (e) {
    $content.innerHTML = `
      <div class="state-msg error">
        데이터를 불러오지 못했습니다.
        <span class="hint">구글 시트가 '링크가 있는 모든 사용자' 보기 가능으로 공유되어 있는지 확인해 주세요. (${escapeHtml(
          String(e.message || e)
        )})</span>
      </div>`;
  }
}

// 모달 제어
const $modal = document.getElementById("modal");
const $modalTitle = document.getElementById("modal-title");
const $modalBody = document.getElementById("modal-body");
const $modalCopy = document.getElementById("modal-copy");
const $modalClose = document.getElementById("modal-close");
let modalText = "";

function openModal(item) {
  $modalTitle.textContent = item.name;
  $modalBody.textContent = item.text;
  modalText = item.text;
  $modalCopy.textContent = "복사";
  $modalCopy.classList.remove("copied");
  $modal.hidden = false;
  document.body.style.overflow = "hidden"; // 배경 스크롤 잠금
}

function closeModal() {
  $modal.hidden = true;
  document.body.style.overflow = "";
}

$modalClose.addEventListener("click", closeModal);
$modal.addEventListener("click", (e) => {
  if (e.target === $modal) closeModal(); // 바깥 영역 클릭 시 닫기
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$modal.hidden) closeModal();
});
$modalCopy.addEventListener("click", () => copyText(modalText, $modalCopy));

// 테마 토글 (초기값은 index.html 의 head 스크립트에서 이미 적용됨)
document.getElementById("theme-toggle").addEventListener("click", () => {
  const next =
    document.documentElement.getAttribute("data-theme") === "dark"
      ? "light"
      : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
});

$search.addEventListener("input", applyFilter);
load();
