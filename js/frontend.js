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
      if (trigger._toggleBound) return;
      trigger._toggleBound = true;

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
    const isBannerImg = img.closest(".js-slider-banner, .hero, .banner");
    const isHeaderImg = img.closest("header, .header, #header, [class*='header'], .head");

    if (isBannerImg) {
      img.removeAttribute("loading");
      img.setAttribute("fetchpriority", "high");
    } else if (isHeaderImg) {
      img.removeAttribute("loading");
      img.removeAttribute("fetchpriority");
    } else {
      if (!img.hasAttribute("loading")) {
        img.setAttribute("loading", "lazy");
      }
    }

    if (!img.hasAttribute("alt") || img.alt.trim() === "") {
      const fileName = img.src.split("/").pop().split(".")[0] || "image";
      img.setAttribute("alt", fileName.replace(/[-_]/g, " "));
    }

    const setDim = () => {
      if (img.naturalWidth > 30 && img.naturalHeight > 30) {
        if (!img.hasAttribute("width")) img.setAttribute("width", img.naturalWidth);
        if (!img.hasAttribute("height")) img.setAttribute("height", img.naturalHeight);
      }
    };

    if (img.complete) setDim();
    else img.addEventListener("load", setDim, { once: true });
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
  autoplay = false,
  spaceBetween = 0,
  slidesPerView = 1,
  slidesPerGroup = 1,
  loop = false,
  rewind = false,
  autoGroupRows = 1,
  isThumb = false,
  navigation = { nextEl: null, prevEl: null },
  pagination = { el: null, clickable: true },
  breakpoints = null,
  ...extraOptions
}) {
  const swiperContainers = document.querySelectorAll(mainSelector);
  if (swiperContainers.length === 0) return null;

  const instances = [];
  let finalOptions = { ...extraOptions };
  let finalBreakpoints = breakpoints ? { ...breakpoints } : null;

  // Dọn dẹp option grid nếu dùng autoGroupRows thủ công
  if (autoGroupRows > 1) {
    delete finalOptions.grid;
    if (finalBreakpoints) {
      Object.keys(finalBreakpoints).forEach(key => {
        if (finalBreakpoints[key]) finalBreakpoints[key] = { ...finalBreakpoints[key] };
        delete finalBreakpoints[key].grid;
      });
    }
  }

  swiperContainers.forEach(container => {
    // 1. Dọn dẹp instance Swiper cũ
    if (container.swiper && typeof container.swiper.destroy === 'function') {
      container.swiper.destroy(true, true);
      container.swiper = null;
    }
    container.classList.remove('js-grouped');

    const wrapper = container.querySelector('.swiper-wrapper');
    if (!wrapper) return;

    // 2. Khôi phục DOM gốc (phục vụ Re-init hoặc Resize)
    if (!container.dataset.originalHtml) {
      container.dataset.originalHtml = wrapper.innerHTML;
    } else {
      wrapper.innerHTML = container.dataset.originalHtml;
    }

    // 3. Grid layout thủ công (autoGroupRows) nếu có
    if (autoGroupRows > 1) {
      const originalSlides = Array.from(wrapper.children);
      wrapper.innerHTML = '';
      const fragment = document.createDocumentFragment();

      for (let i = 0; i < originalSlides.length; i += autoGroupRows) {
        const chunk = originalSlides.slice(i, i + autoGroupRows);
        const groupSlide = document.createElement('div');
        groupSlide.className = 'swiper-slide flex flex-col gap-20';

        chunk.forEach(slide => {
          slide.classList.remove('swiper-slide', 'col-3', 'col-4', 'col-2', 'col-6');
          slide.style.width = '100%';
          groupSlide.appendChild(slide);
        });
        fragment.appendChild(groupSlide);
      }
      wrapper.appendChild(fragment);
      container.classList.add('js-grouped');
    }

    // 4. Tính toán số lượng slide thực tế và slidesPerView tối đa
    const realSlideCount = wrapper.children.length;
    let maxSlidesPerView = Number(slidesPerView) || 1;

    if (finalBreakpoints) {
      Object.values(finalBreakpoints).forEach(bp => {
        if (bp.slidesPerView && Number(bp.slidesPerView) > maxSlidesPerView) {
          maxSlidesPerView = Number(bp.slidesPerView);
        }
      });
    }

    // 5. Điều kiện kích hoạt Slide: Nếu số item <= số slidesPerView tối đa thì TẮT loop & autoplay
    const isEnoughSlides = realSlideCount > maxSlidesPerView;
    let finalLoop = isThumb ? false : (loop && isEnoughSlides);
    let finalRewind = isThumb ? false : (rewind && isEnoughSlides);
    let localAutoplay = isEnoughSlides ? autoplay : false;

    // Kiểm tra cờ chặn auto-slide từ HTML
    const scope = wrapperSelector ? container.closest(wrapperSelector) : container.parentElement;
    if (container.classList.contains('no-auto-slide') || (scope && scope.classList.contains('no-auto-slide'))) {
      localAutoplay = false;
    }

    // Hàm tìm selector theo scope
    const findEl = (selector) => {
      if (!selector) return null;
      if (typeof selector !== 'string') return selector;
      return (scope && scope.querySelector(selector)) || document.querySelector(selector);
    };

    // Swiper Navigation
    const nav = navigation && (navigation.nextEl || navigation.prevEl) ? {
      ...navigation,
      nextEl: findEl(navigation.nextEl),
      prevEl: findEl(navigation.prevEl),
    } : false;

    // Swiper Pagination
    let pag = false;
    if (pagination && pagination.el) {
      const pagEl = findEl(pagination.el);
      if (pagEl) {
        pag = {
          ...pagination,
          el: pagEl
        };
      }
    }

    // 6. Khởi tạo Swiper
    const swiperOptions = {
      slidesPerView: slidesPerView,
      slidesPerGroup: slidesPerGroup,
      spaceBetween: spaceBetween,
      loop: finalLoop,
      rewind: finalRewind,
      watchOverflow: true, // Tự động khóa slide & ẩn Nav/Pagination khi số item <= slidesPerView
      navigation: nav,
      pagination: pag,
      breakpoints: finalBreakpoints,
      autoplay: localAutoplay ? {
        delay: 2500,
        disableOnInteraction: false,
        ...(typeof localAutoplay === 'object' ? localAutoplay : {})
      } : false,
      ...finalOptions
    };

    const swiperInstance = new Swiper(container, swiperOptions);
    container.swiper = swiperInstance;
    instances.push(swiperInstance);
  });

  return instances.length === 1 ? instances[0] : instances;
}

function watchScrollTrigger({
  target,
  triggerPx = 100,
  offTriggerPx = null, // Thêm ngưỡng tắt tùy chỉnh (Vùng đệm)
  className = 'active',
  scrollTo = null
}) {
  const element = typeof target === 'string' ? document.querySelector(target) : target;
  if (!element) return;

  // Nếu không truyền offTriggerPx, tự động tạo vùng đệm 40px
  const thresholdOn = triggerPx;
  const thresholdOff = offTriggerPx !== null ? offTriggerPx : Math.max(0, triggerPx - 40);

  let ticking = false;
  const handleScroll = () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        const currentY = window.scrollY;

        // Logic Hysteresis: Chỉ bật khi >= thresholdOn, chỉ tắt khi < thresholdOff
        if (currentY >= thresholdOn) {
          element.classList.add(className);
        } else if (currentY < thresholdOff) {
          element.classList.remove(className);
        }

        ticking = false;
      });
      ticking = true;
    }
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();

  if (scrollTo !== null) {
    element.addEventListener('click', (e) => {
      e.preventDefault();

      if (typeof scrollTo === 'number') {
        window.scrollTo({ top: scrollTo, behavior: 'smooth' });
      } else if (typeof scrollTo === 'string') {
        document.querySelector(scrollTo)?.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }
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
    if (form._validated) return;
    form._validated = true;

    form.querySelectorAll("input, textarea").forEach(input => {
      input.addEventListener("input", () => validateField(input));
    });

    form.addEventListener("submit", e => {
      if (!validateForm(form)) e.preventDefault();
    });
  });
}

// js add active định vị ở menu
function initUniversalActiveMenu(containerSelector, activeClass = 'active') {
  const containers = document.querySelectorAll(containerSelector);
  if (!containers.length) return;

  // Lấy tên file hiện tại từ URL (vd: literature.html hoặc index.html)
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';

  containers.forEach(container => {
    const links = container.querySelectorAll('a');
    let matched = false;

    links.forEach(link => {
      const href = link.getAttribute('href') || '';

      // Bỏ qua các link javascript:void(0) hoặc rỗng
      if (!href || href.startsWith('javascript')) {
        link.classList.remove(activeClass);
        return;
      }

      const linkPath = href.split('/').pop();

      if (linkPath === currentPath) {
        link.classList.add(activeClass);
        matched = true;
      } else {
        link.classList.remove(activeClass);
      }
    });

    // Nếu ở trang chủ hoặc không khớp link nào, tự active link index.html
    if (!matched) {
      links.forEach(link => {
        const href = link.getAttribute('href') || '';
        if (href.includes('index.html')) {
          link.classList.add(activeClass);
        }
      });
    }
  });
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

function disableGlobalCopy() {
  // Các sự kiện liên quan tới việc chọn, kéo rê và copy chữ
  const blockedEvents = ['copy', 'cut', 'contextmenu', 'selectstart', 'dragstart'];

  blockedEvents.forEach(eventType => {
    document.addEventListener(eventType, (e) => {
      e.preventDefault();
    }, true); // UseCapture = true giúp chặn ngay từ tầng ngoài cùng
  });

  // Chặn các tổ hợp phím tắt chọn & copy toàn trang
  window.addEventListener('keydown', (e) => {
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();

    if (isCtrlOrCmd && ['c', 'a'].includes(key)) {
      e.preventDefault();
    }
  }, true);
}

/**
 * COMPREHENSIVE DEV AUDIT TOOL (SEO & ACCESSIBILITY)
 * Bật/Tắt chế độ kiểm tra: Đổi ENABLE_DEV_AUDIT = false khi up lên Production.
 */
const ENABLE_DEV_AUDIT = true;

if (ENABLE_DEV_AUDIT) {
  window.addEventListener("DOMContentLoaded", () => {
    console.log(
      "%c🚀 [FULL SYSTEM AUDIT] Đang quét toàn bộ tiêu chuẩn SEO & Accessibility...",
      "color: #00e676; font-size: 15px; font-weight: bold;"
    );

    auditHeadAndMeta();
    auditHeadingsHierarchy();
    auditImagesAndMedia();
    auditFormsAndInputs();
    auditLinksAndAnchors();
    auditDOMIntegrity();
  });
}

// 1. KIỂM TRA THẺ META & HEAD (SEO & A11Y TOÀN TRANG)
function auditHeadAndMeta() {
  // Thẻ html lang
  const htmlLang = document.documentElement.getAttribute("lang");
  if (!htmlLang) {
    console.warn("♿ [A11Y] Thẻ <html> thiếu thuộc tính 'lang'\n👉 Cách fix: Thêm lang='vi' (hoặc 'en') vào thẻ <html> gốc.");
  }

  // Thẻ <title>
  const title = document.querySelector("title");
  if (!title || !title.innerText.trim()) {
    console.warn("❌ [SEO METADATA] Trang web KHÔNG có thẻ <title> hoặc title bị rỗng!\n👉 Cách fix: Thêm <title>Tên Trang - Thương Hiệu</title> vào thẻ <head>.");
  } else if (title.innerText.length < 30 || title.innerText.length > 60) {
    console.warn(`⚠️ [SEO METADATA] Độ dài <title> (${title.innerText.length} ký tự) chưa tối ưu SEO (Chuẩn: 30-60 ký tự).\n👉 Tiêu đề hiện tại: "${title.innerText}"`);
  }

  // Meta Description
  const metaDesc = document.querySelector('meta[name="description"]');
  if (!metaDesc || !metaDesc.getAttribute("content")?.trim()) {
    console.warn("❌ [SEO METADATA] Thiếu thẻ <meta name=\"description\">\n👉 Cách fix: Thêm mô tả ngắn gọn nội dung trang (120 - 160 ký tự) vào <head>.");
  }

  // Viewport & Pinch Zoom Accessibility
  const viewport = document.querySelector('meta[name="viewport"]');
  if (!viewport) {
    console.warn("❌ [MOBILE SEO] Thiếu thẻ meta viewport.\n👉 Cách fix: Thêm <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">");
  } else {
    const content = viewport.getAttribute("content") || "";
    if (content.includes("user-scalable=no") || content.includes("maximum-scale=1")) {
      console.warn("♿ [A11Y VIEWPORT] Khóa tính năng phóng to màn hình (user-scalable=no hoặc maximum-scale=1)\n👉 Cách fix: Xóa bỏ thuộc tính này để người khiếm thị có thể phóng to trang bằng tay.", viewport);
    }
  }

  // Canonical Tag
  if (!document.querySelector('link[rel="canonical"]')) {
    console.warn("⚠️ [SEO CANONICAL] Trang web chưa có thẻ link canonical.\n👉 Cách fix: Thêm <link rel=\"canonical\" href=\"https://domain.com/url-hien-tai\"> vào <head>.");
  }
}

// 2. KIỂM TRA CẤU TRÚC THẺ HÀNH VĂN (H1 - H6 HIERARCHY)
function auditHeadingsHierarchy() {
  const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6"));
  const h1s = headings.filter(h => h.tagName === "H1");

  // Kiểm tra H1
  if (h1s.length === 0) {
    console.warn("❌ [SEO HEADING] Trang web KHÔNG có thẻ <h1> nào!\n👉 Cách fix: Thêm 1 thẻ <h1> duy nhất chứa từ khóa chính của trang.");
  } else if (h1s.length > 1) {
    console.warn(`⚠️ [SEO HEADING] Tìm thấy ${h1s.length} thẻ <h1>! Chuẩn SEO chỉ nên có 1 thẻ <h1>.`, h1s);
  }

  // Kiểm tra nhảy cấp Heading (Ví dụ H2 nhảy thẳng lên H4)
  let prevLevel = 0;
  headings.forEach((h) => {
    const currentLevel = parseInt(h.tagName.replace("H", ""));
    if (prevLevel > 0 && currentLevel > prevLevel + 1) {
      console.warn(`♿ [A11Y HEADING] Cấu trúc thẻ tiêu đề bị nhảy cấp từ H${prevLevel} lên H${currentLevel}.\n👉 Cách fix: Đảm bảo thứ tự tiêu đề tăng dần (H1 -> H2 -> H3...).`, h);
    }
    prevLevel = currentLevel;

    // Kiểm tra thẻ H bị rỗng
    if (!h.innerText.trim() && !h.querySelector("img")) {
      console.warn(`⚠️ [SEO HEADING] Thẻ ${h.tagName} bị rỗng nội dung!`, h);
    }
  });
}

// 3. KIỂM TRA ẢNH & MULTIMEDIA (PERFORMANCE + A11Y)
function auditImagesAndMedia() {
  document.querySelectorAll("img").forEach((img, i) => {
    const src = img.getAttribute("src") || "";

    // 1. Kiểm tra Alt text (Dùng Regex \b để không bị bắt nhầm từ như "âm thanh", "chi nhánh")
    if (!img.hasAttribute("alt")) {
      console.warn(`❌ [A11Y IMG #${i + 1}] Thiếu thẻ 'alt'\n👉 Cách fix: Thêm alt="Mô tả ảnh" vào HTML.`, img);
    } else {
      const altText = img.getAttribute("alt").toLowerCase();
      if (/\b(image|picture|anh|hinh)\b/i.test(altText)) {
        console.warn(`⚠️ [A11Y IMG #${i + 1}] Chữ alt chứa từ dư thừa ("image", "hình", "ảnh").`, img);
      }
    }

    // 2. Lazy load
    if (!img.hasAttribute("loading")) {
      console.warn(`⚡ [PERFORMANCE IMG #${i + 1}] Thiếu loading="lazy"`, img);
    }

    // 3. Kiểm tra Size / CLS (Nối thêm điều kiện khung bọc tỉ lệ)
    const hasParentWrapper = img.closest('.js-slider-ratio, [class*="ratio"], .fill-view, .pos-rel');
    const hasDimensions = img.hasAttribute("width") && img.hasAttribute("height");

    if (!hasDimensions && !hasParentWrapper) {
      console.warn(`📐 [CLS LAYOUT IMG #${i + 1}] Thiếu width/height tĩnh VÀ không có khung bọc giữ tỉ lệ!`, img);
    }
  });

  // 4. Kiểm tra đường dẫn srcset bị thiếu dấu /
  document.querySelectorAll("picture source").forEach((source) => {
    const srcset = source.getAttribute("srcset") || "";
    if (srcset && !srcset.startsWith("/") && !srcset.startsWith("http") && !srcset.startsWith("data:")) {
      console.warn(`❌ [PATH ERROR] srcset trong <picture> thiếu dấu '/' ở đầu: "${srcset}"`, source);
    }
  });
}

// 4. KIỂM TRA FORM & TRUY CẬP (A11Y ACCESSIBILITY)
function auditFormsAndInputs() {
  document.querySelectorAll("input, textarea, select").forEach((input) => {
    // Thiếu name
    if (!input.hasAttribute("name") && input.type !== "submit" && input.type !== "button") {
      console.warn("❌ [FORM ERROR] Thẻ input thiếu thuộc tính 'name' (Backend sẽ không lấy được data):", input);
    }

    // Nối Label - Input
    const id = input.getAttribute("id");
    let hasAssociatedLabel = false;

    if (id) {
      hasAssociatedLabel = !!document.querySelector(`label[for="${id}"]`);
    }
    // Hoặc input nằm bên trong label
    if (!hasAssociatedLabel && input.closest("label")) {
      hasAssociatedLabel = true;
    }
    // Hoặc có aria-label
    if (!hasAssociatedLabel && (input.hasAttribute("aria-label") || input.hasAttribute("aria-labelledby"))) {
      hasAssociatedLabel = true;
    }

    if (!hasAssociatedLabel) {
      console.warn(`♿ [A11Y FORM] Ô input này thiếu thẻ <label> gắn liền hoặc thiếu thuộc tính 'for' / 'aria-label':`, input);
    }
  });

  // Nút button không có Text
  document.querySelectorAll("button").forEach((btn) => {
    if (!btn.innerText.trim() && !btn.hasAttribute("aria-label") && !btn.querySelector("img, svg")) {
      console.warn("♿ [A11Y BUTTON] Thẻ <button> không có nội dung chữ hoặc aria-label (Trình đọc màn hình không thể đọc được công dụng nút).", btn);
    }
  });
}

// 5. KIỂM TRA THẺ LINK & ANCHOR TEXT (SEO LINKING)
function auditLinksAndAnchors() {
  const genericTexts = ["click here", "xem thêm", "tai day", "tại đây", "read more", "link"];

  document.querySelectorAll("a").forEach((a) => {
    const href = a.getAttribute("href") || "";
    const text = a.innerText.trim().toLowerCase();

    // Link rỗng / Giả
    if (href === "javascript:void()" || href === "javascript:void(0)" || href === "#") {
      console.warn(`🔗 [SEO LINK] Thẻ <a> sử dụng href giả "${href}". Đổi thành <button> nếu chỉ dùng kích hoạt JS event.`, a);
    }

    // Anchor Text kém chất lượng
    if (genericTexts.includes(text)) {
      console.warn(`⚠️ [SEO ANCHOR TEXT] Neo liên kết quá chung chung ("${text}"). Hãy thay bằng từ khóa cụ thể (Ví dụ: "Xem chi tiết dịch vụ thiết kế").`, a);
    }

    // Security & Performance với target="_blank"
    if (a.getAttribute("target") === "_blank") {
      const rel = a.getAttribute("rel") || "";
      if (!rel.includes("noopener") && !rel.includes("noreferrer")) {
        console.warn(`🛡️ [SECURITY LINK] Link mở tab mới (target="_blank") thiếu rel="noopener noreferrer".`, a);
      }
    }
  });
}

// 6. KIỂM TRA TOÀN VẸN CẤU TRÚC DOM (DUPLICATE ID, TABINDEX)
function auditDOMIntegrity() {
  // Trùng lặp ID (Lỗi cực nghiêm trọng ảnh hưởng A11y & JS)
  const ids = new Set();
  document.querySelectorAll("[id]").forEach((el) => {
    const id = el.id.trim();
    if (id) {
      if (ids.has(id)) {
        console.error(`💥 [CRITICAL DUPLICATE ID] Trùng lặp ID "${id}" trong HTML! ID phải là duy nhất trên toàn trang.`, el);
      } else {
        ids.add(id);
      }
    }
  });

  // Tabindex > 0 (Được coi là anti-pattern trong Accessibility keyboard navigation)
  document.querySelectorAll('[tabindex]:not([tabindex="-1"]):not([tabindex="0"])').forEach((el) => {
    console.warn(`♿ [A11Y KEYBOARD] Thuộc tính tabindex > 0 (${el.getAttribute("tabindex")}) phá vỡ luồng phím Tab tự nhiên của bàn phím. Nên chuyển về tabindex="0".`, el);
  });
}


// ----------- Vùng gọi biến --------------
document.addEventListener("DOMContentLoaded", () => {
  includeHTML(() => {
    // 1. SLIDER BANNER (1 Cột - Hero LCP)
    initSwiperSlider({
      mainSelector: '.js-slider-banner',
      wrapperSelector: '.js-slider-wrapper',
      slidesPerView: 1,
      spaceBetween: 0,
      loop: true,
      autoplay: { delay: 4000, disableOnInteraction: false },
      navigation: {
        nextEl: '.swiper-button-next',
        prevEl: '.swiper-button-prev',
      },
      pagination: {
        el: '.swiper-pagination',
        clickable: true,
      },
    });

    // 2. SLIDER 3 CỘT (Dự án, Bình luận, Dịch vụ)
    initSwiperSlider({
      mainSelector: '.js-slider-3cols',
      wrapperSelector: '.js-slider-wrapper',
      loop: true,
      autoplay: { delay: 3000, disableOnInteraction: false },
      navigation: {
        nextEl: '.swiper-button-next',
        prevEl: '.swiper-button-prev',
      },
      pagination: {
        el: '.custom-dots',
        clickable: true,
      },
      breakpoints: {
        320: { slidesPerView: 1, spaceBetween: 10 },
        768: { slidesPerView: 2, spaceBetween: 15 },
        1024: { slidesPerView: 3, spaceBetween: 20 },
      },
    });

    // 3. SLIDER 4 CỘT (Tin tức, Sản phẩm, Video)
    initSwiperSlider({
      mainSelector: '.js-slider-4cols',
      wrapperSelector: '.js-slider-wrapper',
      loop: true,
      autoplay: { delay: 3500, disableOnInteraction: false },
      navigation: {
        nextEl: '.video-dialogue__nav .swiper-button-next',
        prevEl: '.video-dialogue__nav .swiper-button-prev',
      },
      pagination: {
        el: '.swiper-pagination',
        clickable: true,
      },
      breakpoints: {
        320: { slidesPerView: 2, spaceBetween: 10 },
        768: { slidesPerView: 3, spaceBetween: 15 },
        1024: { slidesPerView: 4, spaceBetween: 20 },
      },
    });

    // 4. SLIDER LOGO / THƯƠNG HIỆU (Chia 2 hàng thủ công)
    initSwiperSlider({
      mainSelector: '.js-slider-logo',
      wrapperSelector: '.js-slider-wrapper',
      loop: false,
      autoGroupRows: 2,
      autoplay: { delay: 3000, disableOnInteraction: false },
      navigation: {
        nextEl: '.swiper-button-next',
        prevEl: '.swiper-button-prev',
      },
      pagination: {
        el: '.swiper-pagination',
        clickable: true,
      },
      breakpoints: {
        320: { slidesPerView: 2, spaceBetween: 15 },
        768: { slidesPerView: 4, spaceBetween: 20 },
        1024: { slidesPerView: 5, spaceBetween: 20 },
      },
    });

    // 5. SLIDER GRID TO SLIDE (Tự động biến Grid thành Slide trên Mobile)
    initSwiperSlider({
      mainSelector: '.js-slider-grid-to-slide',
      wrapperSelector: '.js-slider-wrapper',
      loop: false,
      autoplay: false,
      navigation: {
        nextEl: '.custom-next-btn',
        prevEl: '.custom-prev-btn',
      },
      pagination: {
        el: '.custom-dots',
        clickable: true,
      },
      breakpoints: {
        320: { slidesPerView: 2, spaceBetween: 10 },
        768: { slidesPerView: 3, spaceBetween: 15 },
        1024: { slidesPerView: 3, spaceBetween: 20 },
      },
    });

    initToggleSystem([
      {
        trigger: ".menu-toggle__button",
        target: ".menu-navigation__content",
        behavior: "toggle",
        activeClass: "active",
        closeOnOutside: true,
        closeOnEsc: true,
        innerSelector: ".m-menu__link"
      },
      {
        trigger: ".btn-filter",
        behavior: "activate",
        activeClass: "active",
      },
      {
        trigger: ".pagination-btn",
        behavior: "activate",
        activeClass: "active",
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
    watchScrollTrigger({
      target: '.btntotop__container',
      triggerPx: 1200,
      offTriggerPx: 1000,
      scrollTo: 0,
    });
    watchScrollTrigger({
      target: '.menu-top__logo',
      triggerPx: 300,
      offTriggerPx: 150,
      className: 'active'
    });
    watchScrollTrigger({
      target: '.menu-top__container',
      triggerPx: 300,
      offTriggerPx: 150,
      className: 'active'
    });
    // ✨ 4️⃣ HIỆU ỨNG ẢNH & REVEAL
    applyImageEnhancements();
    initRevealEffect();
    initFormValidation();
    initUniversalActiveMenu('.menu-bottom__nav, .menu-navigation__content', 'active');
    initStarRating('.popup-comment__content .rate-stars', '.star', 'active');
    disableGlobalCopy();
  });
});

// 🔁 Cập nhật khi include hoặc slick load lại
document.addEventListener("includesLoaded", () => applyImageEnhancements());
$(document).on("init reInit afterChange", ".slick-slider", function () {
  applyImageEnhancements(this);
});
