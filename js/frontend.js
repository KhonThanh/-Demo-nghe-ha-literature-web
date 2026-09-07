// ----------- Vùng chức năng -------------
// 🧩 1️⃣ Include HTML Components
function includeHTML(callback) {
  const elements = document.querySelectorAll("[data-include]");
  if (!elements.length) {
    if (callback) callback();
    return;
  }

  let loaded = 0;

  Promise.all([...elements].map(async (el) => {
    const file = el.getAttribute("data-include");
    if (!file) return;

    // Sử dụng versioning thay vì cache-busting bằng Date.now() để tận dụng cache trình duyệt
    const version = "1.0.0"; // Thay đổi version này khi có cập nhật component
    const cacheKey = `comp-${file}-${version}`;
    let html = sessionStorage.getItem(cacheKey);

    if (!html) {
      // Xóa cache cũ của component này nếu có
      Object.keys(sessionStorage).forEach(key => { if (key.startsWith(`comp-${file}`)) sessionStorage.removeItem(key); });
      const res = await fetch(file, { cache: "reload" }); // Tải lại file mới nhất từ server
      html = await res.text();
      sessionStorage.setItem(cacheKey, html);
    }

    el.innerHTML = html;
    if (typeof initResponsive === "function") initResponsive(el);

    if (++loaded === elements.length) {
      document.dispatchEvent(new Event("includesLoaded"));
      if (callback) callback();
    }
  }));
}

// js thêm active
function initToggleSystem(configs = []) {
  if (!window._toggleSystemState) {
    window._toggleSystemState = { docKeys: new Set(), keyKeys: new Set() };
  }
  const state = window._toggleSystemState;

  configs.forEach((cfg, cfgIndex) => {
    if (!cfg || !cfg.trigger) return;

    const activeClass = cfg.activeClass || "active";
    const behavior = cfg.behavior || "toggle";
    const closeOnOutside = !!cfg.closeOnOutside;
    const closeOnEsc = !!cfg.closeOnEsc;
    const overlayCloses = !!cfg.overlayCloses;
    const innerSelector = cfg.innerSelector || null;
    const closeBtnSelector = cfg.closeBtn || null;
    const groupSelector = cfg.groupSelector || null;

    const triggers = Array.from(document.querySelectorAll(cfg.trigger));
    if (!triggers.length) return;

    const targets = cfg.target ? Array.from(document.querySelectorAll(cfg.target)) : [];

    const closeAll = () => {
      targets.forEach(t => t.classList.remove(activeClass));
      triggers.forEach(t => t.classList.remove(activeClass));
    };

    // bind sự kiện click cho từng trigger (chỉ bind 1 lần)
    triggers.forEach((trigger, idx) => {
      if (trigger.dataset._toggleBound === "true") return;
      trigger.dataset._toggleBound = "true";

      trigger.addEventListener("click", (e) => {
        e.stopPropagation();

        // Tìm target element ứng với trigger (nếu có)
        let targetEl = null;
        if (cfg.target) {
          if (trigger.dataset && trigger.dataset.target) {
            targetEl = document.querySelector(trigger.dataset.target);
          } else {
            targetEl = targets[idx] || targets[0] || null;
          }
        }

        // ---- behavior activate (tab-like) ----
        // ---- behavior activate (tab-like: chỉ mở, không tắt khi bấm lại) ----
        if (behavior === "activate") {
          const scope = groupSelector ? document.querySelectorAll(groupSelector) : triggers;
          scope.forEach(el => el.classList.remove(activeClass));
          trigger.classList.add(activeClass);
          if (targetEl) {
            targets.forEach(t => t.classList.remove(activeClass));
            targetEl.classList.add(activeClass);
          }
        }
        // ---- radio mode (bấm mở, bấm lại tắt, các cái khác tắt) ----
        else if (behavior === "radio") {
          const isCurrentlyActive = trigger.classList.contains(activeClass);

          // Luôn dọn dẹp nhóm trước
          const scope = groupSelector ? document.querySelectorAll(groupSelector) : triggers;
          scope.forEach(el => el.classList.remove(activeClass));
          targets.forEach(t => t.classList.remove(activeClass));

          // Nếu nó chưa active thì bật lên, còn đã active rồi thì thôi (tự tắt)
          if (!isCurrentlyActive) {
            trigger.classList.add(activeClass);
            if (targetEl) targetEl.classList.add(activeClass);
          }
        }
        // ---- toggle mode ----
        else {
          if (targetEl) targetEl.classList.toggle(activeClass);
          else trigger.classList.toggle(activeClass);
        }

        // callback onToggle (nếu có)
        if (typeof cfg.onToggle === "function") {
          try { cfg.onToggle(trigger, idx); } catch (err) { /* ignore */ }
        }

        // -> GỌI onActiveChange bất kể có target hay không
        if (typeof cfg.onActiveChange === "function") {
          const isActive = targetEl ? targetEl.classList.contains(activeClass) : trigger.classList.contains(activeClass);
          try { cfg.onActiveChange(isActive, trigger, targetEl, idx); } catch (err) { /* ignore */ }
        }
      });
    });

    // bind nút đóng (nhiều selector)
    if (closeBtnSelector) {
      Array.from(document.querySelectorAll(closeBtnSelector)).forEach(btn => {
        if (btn.dataset._toggleCloseBound === "true") return;
        btn.dataset._toggleCloseBound = "true";
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          closeAll();
        });
      });
    }

    // click outside để đóng
    if (closeOnOutside) {
      const docKey = `doc_${cfg.trigger}|${cfg.target || ""}|${cfgIndex}`;
      if (!state.docKeys.has(docKey)) {
        state.docKeys.add(docKey);
        document.addEventListener("click", (e) => {
          const currTriggers = Array.from(document.querySelectorAll(cfg.trigger));
          const currTargets = cfg.target ? Array.from(document.querySelectorAll(cfg.target)) : [];

          const clickedOnTrigger = currTriggers.some(t => t.contains(e.target));
          const clickedOnOverlay = overlayCloses && currTargets.some(t => e.target === t);

          const clickedInsideTarget = currTargets.some(t => {
            const inner = innerSelector ? t.querySelector(innerSelector) : t;
            return inner && inner.contains(e.target);
          });

          if (clickedOnOverlay) {
            currTargets.forEach(t => t.classList.remove(activeClass));
            currTriggers.forEach(t => t.classList.remove(activeClass));
            return;
          }

          if (!clickedInsideTarget && !clickedOnTrigger) {
            currTargets.forEach(t => t.classList.remove(activeClass));
            currTriggers.forEach(t => t.classList.remove(activeClass));
          }
        });
      }
    }

    // ESC để đóng
    if (closeOnEsc) {
      const escKey = `esc_${cfg.trigger}|${cfg.target || ""}|${cfgIndex}`;
      if (!state.keyKeys.has(escKey)) {
        state.keyKeys.add(escKey);
        document.addEventListener("keydown", (e) => {
          if (e.key === "Escape") {
            const currTargets = cfg.target ? Array.from(document.querySelectorAll(cfg.target)) : [];
            const currTriggers = Array.from(document.querySelectorAll(cfg.trigger));
            currTargets.forEach(t => t.classList.remove(activeClass));
            currTriggers.forEach(t => t.classList.remove(activeClass));
          }
        });
      }
    }

    // === gọi onActiveChange cho trạng thái ban đầu (nếu có active sẵn trong DOM) ===
    if (typeof cfg.onActiveChange === "function") {
      // delay một tick để đảm bảo các class có sẵn đã gán xong (nếu include động)
      setTimeout(() => {
        Array.from(document.querySelectorAll(cfg.trigger)).forEach((tr, i) => {
          const targetEl = cfg.target ? (document.querySelectorAll(cfg.target)[i] || document.querySelectorAll(cfg.target)[0]) : null;
          const isActive = targetEl ? targetEl.classList.contains(activeClass) : tr.classList.contains(activeClass);
          if (isActive) {
            try { cfg.onActiveChange(true, tr, targetEl, i); } catch (err) { }
          }
        });
      }, 0);
    }
  });
}

// 🖼️ 2️⃣ Lazy Load + Set Dimensions
function applyImageEnhancements(root = document) {
  root.querySelectorAll("img").forEach(img => {
    // Lazy load
    if (!img.hasAttribute("loading")) img.setAttribute("loading", "lazy");

    // Alt text
    if (!img.hasAttribute("alt") || img.alt.trim() === "") {
      const fileName = img.src.split("/").pop().split(".")[0] || "image";
      img.setAttribute("alt", fileName.replace(/[-_]/g, " "));
    }

    // Hàm set kích thước an toàn
    const setDim = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        if (!img.hasAttribute("width")) img.setAttribute("width", img.naturalWidth);
        if (!img.hasAttribute("height")) img.setAttribute("height", img.naturalHeight);
      }
    };

    // Nếu ảnh đã load sẵn (cache hoặc render sớm)
    if (img.complete) setTimeout(setDim, 50);
    else img.addEventListener("load", setDim);

    // Chỉ xử lý khi xuất hiện trong viewport
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setDim();
          obs.unobserve(entry.target);
        }
      });
    }, { rootMargin: "200px 0px" });
    io.observe(img);
  });
}

// ✨ 3️⃣ Scroll Reveal Effect
function initRevealEffect() {
  const sections = document.querySelectorAll("section, footer");
  if (!sections.length) return;
  sections.forEach(sec => sec.classList.add("hidden-section"));
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        el.classList.add("show-up");
        observer.unobserve(el);
      }
    });
  }, {
    threshold: 0,
    rootMargin: "0px 0px -100px 0px"
  });
  sections.forEach(sec => observer.observe(sec));
}

function extractHeadingData(contentSelector, headingTags = "h1, h2, h3, h4, h5, h6") {
  const content = contentSelector === "all" ? document : document.querySelector(contentSelector);

  if (!content) {
    console.warn(`Không tìm thấy vùng quét: ${contentSelector}`);
    return [];
  }

  const headings = content.querySelectorAll(headingTags);
  if (!headings.length) return [];

  const toSlug = str => str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d").replace(/Đ/g, "D")
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]/g, "")
    .toLowerCase();

  const data = [];

  headings.forEach((h, i) => {
    const text = h.textContent.trim();

    let id = h.id || toSlug(text) || `heading-${i}`;

    if (document.getElementById(id) && document.getElementById(id) !== h) {
      let baseId = id;
      let counter = 1;
      while (document.getElementById(`${baseId}-${counter}`) && document.getElementById(`${baseId}-${counter}`) !== h) {
        counter++;
      }
      id = `${baseId}-${counter}`;
    }

    h.id = id;
    data.push({
      id: id,
      text: text,
      tag: h.tagName.toLowerCase()
    });
  });

  return data;
}

// HÀM 2: NHÂN BẢN TEMPLATE VÀ ĐỔ DỮ LIỆU
function renderDynamicList(headingData, targetSelector) {
  if (!headingData || headingData.length === 0) return;

  const targetContainer = document.querySelector(targetSelector);
  if (!targetContainer) {
    console.log('Không tìm thấy menu');
    return;
  }

  const template = targetContainer.firstElementChild;
  if (!template) {
    console.warn(`Vui lòng để lại 1 thẻ con trong ${targetSelector} để làm mẫu!`);
    return;
  }

  targetContainer.innerHTML = "";

  headingData.forEach(item => {
    const clone = template.cloneNode(true);
    const aTag = clone.querySelector("a");

    if (aTag) {
      aTag.href = `#${item.id}`;
      let rawText = item.text;
      let formattedText = rawText.charAt(0).toUpperCase() + rawText.slice(1).toLowerCase();
      aTag.textContent = formattedText;

      aTag.addEventListener("click", e => {
        e.preventDefault();
        const targetSection = document.getElementById(item.id);

        if (targetSection) {
          const headerHeight = 300;
          const elementPosition = targetSection.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.scrollY - headerHeight;

          window.scrollTo({
            top: offsetPosition,
            behavior: "smooth"
          });
        }
      });
    }

    targetContainer.appendChild(clone);
  });
}

// 🧩 2️⃣ Hàm dùng chung cho tất cả Swiper
// FUNCTION KHỞI TẠO SWIPER (PHIÊN BẢN CHỐNG ĐỤNG ĐỘ - XÀI MÃI MÃI)
function initSwiperSlider({
  mainSelector,
  wrapperSelector = null,
  minSlides = 0,
  autoplay = false,
  spaceBetween = 0,
  slidesPerView = 1,
  slidesPerGroup = 1,
  loop = false,
  autoGroupRows = 1,
  navigation = { nextEl: null, prevEl: null },
  pagination = { el: null, clickable: true },
  breakpoints = null,
  ...extraOptions
}) {
  const swiperContainers = document.querySelectorAll(mainSelector);
  if (swiperContainers.length === 0) return;

  let finalOptions = { ...extraOptions };
  let finalBreakpoints = breakpoints ? { ...breakpoints } : null;
  let finalLoop = loop;

  if (autoGroupRows > 1) {
    delete finalOptions.grid; // Xoá grid ở cấp ngoài
    if (finalBreakpoints) {
      Object.keys(finalBreakpoints).forEach(key => {
        delete finalBreakpoints[key].grid;
      });
    }
  } else {
    let hasGrid = finalOptions.grid && finalOptions.grid.rows > 1;
    if (finalBreakpoints && !hasGrid) {
      hasGrid = Object.values(finalBreakpoints).some(bp => bp.grid && bp.grid.rows > 1);
    }
    if (hasGrid && finalLoop) {
      finalLoop = false;
    }
  }

  swiperContainers.forEach(container => {
    const wrapper = container.querySelector('.swiper-wrapper');
    if (!wrapper) return;

    // ==============================================================
    // 1. MA THUẬT GOM NHÓM (DÙNG FRAGMENT CHỐNG FORCED REFLOW)
    // ==============================================================
    if (autoGroupRows > 1 && !container.classList.contains('js-grouped')) {
      const originalSlides = Array.from(wrapper.children);
      wrapper.innerHTML = '';

      const fragment = document.createDocumentFragment(); // TẠO KHO TẠM

      for (let i = 0; i < originalSlides.length; i += autoGroupRows) {
        const chunk = originalSlides.slice(i, i + autoGroupRows);
        const groupSlide = document.createElement('div');
        groupSlide.className = 'swiper-slide flex flex-col gap-20';

        chunk.forEach(slide => {
          slide.classList.remove('swiper-slide', 'col-3', 'col-4', 'col-2', 'col-6'); // Tháo class chia cột ngang
          slide.style.width = '100%';
          groupSlide.appendChild(slide);
        });
        fragment.appendChild(groupSlide); // NHÉT VÀO KHO TẠM
      }

      wrapper.appendChild(fragment); // ỤP KHO TẠM RA GIAO DIỆN 1 LẦN DUY NHẤT
      container.classList.add('js-grouped');
    }

    // ==============================================================
    // 2. LOGIC HACK LOOP NHÂN BẢN (CŨNG DÙNG FRAGMENT LUÔN)
    // ==============================================================
    if (finalLoop && wrapper) {
      const currentSlides = Array.from(wrapper.children);
      const totalSlides = currentSlides.length;
      // Tìm số slidesPerView lớn nhất trong breakpoints để clone cho đủ
      let maxView = slidesPerView;
      if (finalBreakpoints) {
        Object.values(finalBreakpoints).forEach(bp => {
          if (bp.slidesPerView > maxView) maxView = bp.slidesPerView;
        });
      }
      const threshold = Math.max(minSlides, maxView * 2);
      if (totalSlides > 0 && totalSlides < threshold) {
        const times = Math.ceil(threshold / totalSlides) - 1;

        const cloneFragment = document.createDocumentFragment(); // TẠO KHO TẠM CLONE

        for (let i = 0; i < times; i++) {
          currentSlides.forEach(s => cloneFragment.appendChild(s.cloneNode(true)));
        }

        wrapper.appendChild(cloneFragment); // ỤP KHO TẠM RA GIAO DIỆN
      }
    }

    // 3. KHOANH VÙNG NAVIGATION & PAGINATION
    const scope = wrapperSelector ? container.closest(wrapperSelector) : container.parentElement;
    const nav = navigation && (navigation.nextEl || navigation.prevEl) ? {
      nextEl: scope && navigation.nextEl ? scope.querySelector(navigation.nextEl) : navigation.nextEl,
      prevEl: scope && navigation.prevEl ? scope.querySelector(navigation.prevEl) : navigation.prevEl,
    } : false;

    const pag = pagination && pagination.el ? {
      ...pagination,
      el: scope && pagination.el ? scope.querySelector(pagination.el) : pagination.el,
    } : false;

    // ==============================================================
    // 4. KHỞI TẠO SWIPER KÈM SETTIMEOUT CHO TRÌNH DUYỆT THỞ
    // ==============================================================
    const swiperOptions = {
      slidesPerView: slidesPerView,
      slidesPerGroup: slidesPerGroup,
      spaceBetween: spaceBetween,
      loop: finalLoop,
      navigation: nav,
      pagination: pag,
      breakpoints: finalBreakpoints,
      autoplay: autoplay ? {
        delay: 2500,
        disableOnInteraction: false,
        ...(typeof autoplay === 'object' ? autoplay : {})
      } : false,
      ...finalOptions
    };

    // Bọc trong setTimeout 0ms để tách việc DOM Rendering ra khỏi việc Swiper đo đạc
    setTimeout(() => {
      new Swiper(container, swiperOptions);
    }, 0);

  });
}

// js roll to top
function initScrollToTop(btnId = "btnToTop", showOffset = 1000) {
  const scrollBtn = document.getElementById(btnId);
  if (!scrollBtn) return;

  window.addEventListener("scroll", () => {
    if (window.scrollY > showOffset) {
      scrollBtn.classList.add("show");
    } else {
      scrollBtn.classList.remove("show");
    }
  });

  scrollBtn.addEventListener("click", () => {
    window.scroll({
      top: 0,
      behavior: "smooth",
    });
  });
}

// js validate form
function validateField(input) {
  const group = input.closest(".form-group");
  const error = group?.querySelector(".error-msg");
  let message = "";

  const value = input.value.trim();

  if (input.hasAttribute("required") && !value) {
    message = input.dataset.msg || "Vui lòng không để trống";
  }

  if (!message && input.type === "email" && value) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) message = "Email không hợp lệ";
  }

  if (!message && input.hasAttribute("minlength")) {
    const min = +input.getAttribute("minlength");
    if (value.length < min) {
      message = input.dataset.msg || `Tối thiểu ${min} ký tự`;
    }
  }

  if (!message && input.tagName === "SELECT" && input.required) {
    if (!input.value) message = "Vui lòng chọn một giá trị";
  }

  if (!message && input.type === "checkbox" && input.required) {
    if (!input.checked) message = "Vui lòng xác nhận";
  }

  if (!message && input.pattern && input.value) {
    const regex = new RegExp(input.pattern);
    if (!regex.test(input.value)) {
      message = input.dataset.msg || "Giá trị không hợp lệ";
    }
  }

  if (group) group.classList.toggle("error", !!message);
  if (error) error.textContent = message;

  return !message;
}

function validateForm(form) {
  let isValid = true;
  form.querySelectorAll("input, textarea").forEach(input => {
    if (!validateField(input)) isValid = false;
  });
  return isValid;
}

function initFormValidation(root = document) {
  root.querySelectorAll(".js-validate-form").forEach(form => {
    if (form.dataset._validated) return;
    form.dataset._validated = "true";

    form.querySelectorAll("input, textarea").forEach(input => {
      input.addEventListener("input", () => validateField(input));
    });

    form.addEventListener("submit", e => {
      if (!validateForm(form)) e.preventDefault();
    });
  });
}

// js add active định vị ở menu
function initUniversalActiveMenu(menuSelector = '', activeClassName = 'active') {
  const currentUrl = window.location.href.split(/[?#]/)[0];

  const menuLinks = document.querySelectorAll(`${menuSelector} a`);
  let bestMatch = null;
  let longestMatchLength = 0;

  menuLinks.forEach(link => {
    const hrefAttr = link.getAttribute('href');
    if (!hrefAttr || hrefAttr.startsWith('#') || hrefAttr.startsWith('javascript')) return;
    const linkUrl = link.href.split(/[?#]/)[0];

    // ==========================================
    // VŨ KHÍ MỚI: Bắt theo keyword từ data-match
    // ==========================================
    const matchKeyword = link.getAttribute('data-match');
    if (matchKeyword && currentUrl.includes(matchKeyword)) {
      bestMatch = link;
      longestMatchLength = 9999; // Cấp quyền ưu tiên tuyệt đối, khỏi check mấy cái dưới
      return;
    }

    // Logic cũ (Vẫn giữ để chạy cho các trang bình thường không có data-match)
    if (currentUrl === linkUrl) {
      bestMatch = link;
      longestMatchLength = linkUrl.length;
    } else if (currentUrl.startsWith(linkUrl)) {
      const isHomePage = linkUrl.endsWith('/') || linkUrl.endsWith('index.html') || linkUrl.endsWith('/en') || linkUrl.endsWith('/kn');

      if (!isHomePage && linkUrl.length > longestMatchLength) {
        bestMatch = link;
        longestMatchLength = linkUrl.length;
      }
    }
  });

  if (bestMatch) {
    bestMatch.classList.add(activeClassName);
    const parentMenu = bestMatch.closest(menuSelector);
    if (parentMenu) parentMenu.classList.add(activeClassName);
  } else {
    const homeLink = Array.from(menuLinks).find(link => {
      const lUrl = link.href.split(/[?#]/)[0];
      return lUrl.endsWith('/') || lUrl.endsWith('index.html') || lUrl.endsWith('/en') || lUrl.endsWith('/kn');
    });

    if (homeLink) {
      homeLink.classList.add(activeClassName);
      const parentMenu = homeLink.closest(menuSelector);
      if (parentMenu) parentMenu.classList.add(activeClassName);
    }
  }
}

// Hàm tự động quét và gắn hiệu ứng Zoom
function initAutoImageZoom(gallerySelector, zoomScale = 1.5) {
  const galleries = document.querySelectorAll(gallerySelector);
  if (galleries.length === 0) return;

  galleries.forEach(gallery => {
    const items = gallery.querySelectorAll('.product-main__item');

    items.forEach(item => {
      const img = item.querySelector('img');
      const video = item.querySelector('iframe, video');
      if (video) {
        item.classList.add('is-video-item');
        return;
      }

      if (img) {
        item.classList.add('js-zoom-container', 'pos-rel', 'overflow-hidden');

        item.addEventListener('mousemove', function (e) {

          if (gallery.swiper && gallery.swiper.autoplay) {
            gallery.swiper.autoplay.stop();
          }

          const rect = item.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * 100;
          const y = ((e.clientY - rect.top) / rect.height) * 100;

          img.style.transformOrigin = `${x}% ${y}%`;
          img.style.transform = `scale(${zoomScale})`; // Xài biến zoomScale (1.5)
        });

        item.addEventListener('mouseleave', function () {

          img.style.transformOrigin = 'center';
          img.style.transform = 'scale(1)';

          if (gallery.swiper && gallery.swiper.autoplay) {
            gallery.swiper.autoplay.start();
          }
        });
      }
    });
  });
}

function initStarRating(containerSelector = '.rate-stars', starSelector = '.star', activeClass = 'active') {
  const containers = document.querySelectorAll(containerSelector);
  if (!containers.length) return;
  containers.forEach(container => {
    const stars = Array.from(container.querySelectorAll(starSelector));
    if (!stars.length) return;
    const defaultActiveCount = container.querySelectorAll(`.${activeClass}`).length;
    container.dataset.rating = defaultActiveCount || 0;
    stars.forEach((star, index) => {
      if (star.dataset._ratingBound === "true") return;
      star.dataset._ratingBound = "true";
      star.style.cursor = 'pointer';
      star.addEventListener('click', () => {
        const currentRating = index + 1;
        container.dataset.rating = currentRating;
        stars.forEach((s, i) => {
          if (i < currentRating) {
            s.classList.add(activeClass);
          } else {
            s.classList.remove(activeClass);
          }
        });

      });
    });
  });
}

// js chống cls lưới sản phẩm
function initSkeletonLoader(options = {}) {
  const skeletonContainer = document.getElementById(options.skeletonId || 'skeleton-data');
  const realContainer = document.getElementById(options.realDataId || 'real-data');
  const delay = options.delay || 2000;

  if (!skeletonContainer || !realContainer) return;

  const firstSkeleton = skeletonContainer.firstElementChild;

  if (firstSkeleton && options.count) {
    const template = firstSkeleton.outerHTML;
    skeletonContainer.innerHTML = template.repeat(options.count - 1);
    skeletonContainer.insertAdjacentHTML('afterbegin', template);
  }

  setTimeout(() => {
    skeletonContainer.classList.add('is-hidden');
    realContainer.classList.remove('is-hidden');
  }, delay);
}

// ----------- Vùng gọi biến --------------
document.addEventListener("DOMContentLoaded", () => {
  includeHTML(() => {
    initSwiperSlider({
      mainSelector: '.js-slider-banner', // Tên class dùng chung
      wrapperSelector: '.js-slider-wrapper', // BẮT BUỘC có thẻ bọc ngoài chung class này
      minSlides: 3,
      slidesPerView: 1,
      spaceBetween: 0,
      loop: true,
      autoplay: { delay: 3000, disableOnInteraction: false },
      navigation: {
        nextEl: '.swiper-button-next', // Tự động tìm nút trong wrapper
        prevEl: '.swiper-button-prev',
      },
      pagination: {
        el: '.swiper-pagination',
        clickable: true,
      },
    });

    // 2. SLIDER 3 CỘT (Dùng cho Dự án, Bình luận, Dịch vụ...)
    initSwiperSlider({
      mainSelector: '.js-slider-3cols',
      wrapperSelector: '.js-slider-wrapper',
      minSlides: 6,
      loop: true,
      autoplay: { delay: 3000, disableOnInteraction: false },
      navigation: {
        nextEl: '.swiper-button-next', // Tự động tìm nút trong wrapper
        prevEl: '.swiper-button-prev',
      },
      pagination: { el: '.custom-dots', clickable: true },
      breakpoints: {
        320: { slidesPerView: 1, spaceBetween: 10 },
        768: { slidesPerView: 2, spaceBetween: 15 },
        1024: { slidesPerView: 3, spaceBetween: 20 }
      }
    });

    // 3. SLIDER 4 CỘT (Dùng cho Tin tức, Sản phẩm...)
    initSwiperSlider({
      mainSelector: '.js-slider-4cols',
      wrapperSelector: '.js-slider-wrapper',
      minSlides: 6,
      loop: true,
      autoplay: { delay: 3000, disableOnInteraction: false },
      navigation: {
        nextEl: '.swiper-button-next',
        prevEl: '.swiper-button-prev',
      },
      pagination: {
        el: '.swiper-pagination', // ĐÃ SỬA CHUẨN
        clickable: true
      },
      breakpoints: {
        320: { slidesPerView: 2, spaceBetween: 10 },
        768: { slidesPerView: 3, spaceBetween: 15 },
        1024: { slidesPerView: 4, spaceBetween: 20 }
      }
    });

    // 4. SLIDER LOGO / THƯƠNG HIỆU (Dạng lưới Grid chia hàng)
    initSwiperSlider({
      mainSelector: '.js-slider-logo',
      wrapperSelector: '.js-slider-wrapper',
      minSlides: 18,
      loop: true,
      autoGroupRows: 2,
      autoplay: { delay: 3000, disableOnInteraction: false },
      navigation: {
        nextEl: '.swiper-button-next', // Tự động tìm nút trong wrapper
        prevEl: '.swiper-button-prev',
      },
      pagination: { el: '.swiper-pagination', clickable: true },
      breakpoints: {
        500: {
          slidesPerView: 2, spaceBetween: 20, slidesPerGroup: 2,
          grid: { rows: 2, fill: 'row' }
        },
        900: {
          slidesPerView: 4, spaceBetween: 20, slidesPerGroup: 4,
          grid: { rows: 2, fill: 'row' }
        },
        1200: {
          slidesPerView: 5, spaceBetween: 20, slidesPerGroup: 5,
          grid: { rows: 3, fill: 'row' }
        },
      }
    });

    // 5. SLIDER lúc đầu là tỉnh khi xuống mobile thì thành slide

    initSwiperSlider({
      mainSelector: '.js-slider-grid-to-slide',
      wrapperSelector: '.js-slider-wrapper',
      minSlides: 6,

      loop: false,
      autoplay: false, 

      navigation: { nextEl: '.custom-next-btn', prevEl: '.custom-prev-btn' },
      pagination: { el: '.custom-dots', clickable: true },

      breakpoints: {
        320: {
          slidesPerView: 2, // Mobile: Trượt ngang 2 sản phẩm
          spaceBetween: 10,
          grid: { rows: 1, fill: 'row' } // Trả về 1 hàng ngang
        },
        768: {
          slidesPerView: 3, // Tablet: Trượt ngang 3 sản phẩm
          spaceBetween: 15,
          grid: { rows: 1, fill: 'row' } // Trả về 1 hàng ngang
        },
        1024: {
          slidesPerView: 3, // PC: Chia 3 cột
          spaceBetween: 20,
          grid: {
            rows: 2, // KẾT HỢP VỚI 3 CỘT = LƯỚI 6 SẢN PHẨM / TRANG
            fill: 'row' // Ưu tiên xếp từ trái sang phải, rồi mới rớt dòng
          }
        }
      }
    });

    initToggleSystem([
      {
        trigger: ".menu-container__bar",
        target: ".m-menu",
        behavior: "toggle",
        activeClass: "active",
        closeOnOutside: true,
        closeOnEsc: true,
        innerSelector: ".m-menu__link"
      },
      {
        trigger: ".pagination-wrapper .pagination-btn",
        behavior: "activate",
        activeClass: "active",
        groupSelector: ".pagination-wrapper .pagination-btn",
      },
      {
        trigger: ".btn-write-review",
        target: ".popup-comment__container",
        behavior: "toggle",
        activeClass: "active",
        closeOnOutside: true,
        closeOnEsc: true,
        innerSelector: ".popup-comment__content",
        closeBtn: ".popup-comment__close"
      },
      {
        trigger: ".ssl-faq__item .ssl-faq__btn",
        target: ".ssl-faq__des",
        behavior: "radio",
        activeClass: "active",
      },

    ]);

    // 🟡 roll to the top
    initScrollToTop();
    // ✨ 4️⃣ HIỆU ỨNG ẢNH & REVEAL
    applyImageEnhancements();
    initRevealEffect();
    initFormValidation();
    initUniversalActiveMenu('.header-bottom__item', 'active');

    initStarRating('.popup-comment__content .rate-stars', '.star', 'active');
  });
});

// 🔁 Cập nhật khi include hoặc slick load lại
document.addEventListener("includesLoaded", () => applyImageEnhancements());
$(document).on("init reInit afterChange", ".slick-slider", function () {
  applyImageEnhancements(this);
});
