// 섹션 관리 및 애니메이션 로직
let currentSectionIndex = 0;
let sectionState = 'svg'; // 'svg', 'typing', 'pageTurn'
let svgPaths = [];
let totalPathLength = 0;
let typingText = '';
let typingIndex = 0;
let typingComplete = false;
let isPageTurning = false; // 페이지 넘김 중인지 확인
let brushDrawingShown = false; // 브러쉬 드로잉이 표시되었는지
let brushDrawingScrollY = 0; // 브러쉬 드로잉이 나타난 시점의 스크롤 위치

// 오디오 관리
let pencilWritingAudio = null; // 텍스트 타이핑 사운드
let pageTurnAudio = null; // 페이지 넘김 사운드
let drawingAudio = null; // SVG 드로잉 사운드
let lastSvgProgress = 0; // 이전 SVG 진행률 (역재생 감지용)

// 상수 설정
const SVG_START = 0.85; // 책 줌인 이후 드로잉 시작 지점
const TEXT_START_PROGRESS = 0.5; // SVG가 절반 그려진 뒤 텍스트 시작
const DRAW_EASE_POWER = 0.5; // 수치가 높을수록 초반이 더 느려짐 (낮추면 더 빠름) - SVG 그리기 빠르게
const TEXT_EASE_POWER = 1.4; // 텍스트 초반 타이핑을 천천히
const SECTION_SCROLL_RANGE = 800; // 각 섹션당 스크롤 범위 (vh 단위) - 감도 빠르게
const BRUSH_DRAWING_SCROLL_DELAY = 200; // 브러쉬 드로잉 후 페이지 넘김까지 필요한 스크롤 거리 (px)

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const easeInOutCubic = (t) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// 섹션 상태 관리
const SectionState = {
    SVG: 'svg',
    TYPING: 'typing',
    PAGE_TURN: 'pageTurn'
};

// 각 섹션의 스크롤 시작/끝 위치 계산
function getSectionScrollRange(sectionIndex) {
    const BOOK_ANIMATION_HEIGHT = 600; // 책 애니메이션 구간 (600vh) - book.js와 동일
    const bookAnimationEnd = window.innerHeight * (BOOK_ANIMATION_HEIGHT / 100) * SVG_START;
    
    if (sectionIndex === 0) {
        // 첫 번째 섹션 (인트로): 책 애니메이션 구간 이후부터 시작
        const sectionStart = bookAnimationEnd;
        const sectionEnd = sectionStart + window.innerHeight * (SECTION_SCROLL_RANGE / 100);
        return { start: sectionStart, end: sectionEnd, range: sectionEnd - sectionStart };
    } else {
        // 나머지 섹션들: 각각 독립적인 스크롤 구간
        const firstSectionEnd = bookAnimationEnd + window.innerHeight * (SECTION_SCROLL_RANGE / 100);
        const sectionStart = firstSectionEnd + (sectionIndex - 1) * window.innerHeight * (SECTION_SCROLL_RANGE / 100);
        const sectionEnd = sectionStart + window.innerHeight * (SECTION_SCROLL_RANGE / 100);
        return { start: sectionStart, end: sectionEnd, range: sectionEnd - sectionStart };
    }
}

// 현재 스크롤 위치에 따라 활성 섹션 인덱스 반환
function getActiveSectionIndex() {
    if (!sections || sections.length === 0) return -1;
    
    const scrollY = window.scrollY;
    const BOOK_ANIMATION_HEIGHT = 600; // 책 애니메이션 구간 (600vh) - book.js와 동일
    const bookAnimationEnd = window.innerHeight * (BOOK_ANIMATION_HEIGHT / 100) * SVG_START;
    
    // 책 애니메이션 구간에서는 -1 반환
    if (scrollY < bookAnimationEnd) return -1;
    
    // 각 섹션의 구간 확인
    for (let i = 0; i < sections.length; i++) {
        const range = getSectionScrollRange(i);
        if (scrollY >= range.start && scrollY <= range.end) {
            return i;
        }
    }
    
    // 마지막 섹션 이후
    return sections.length - 1;
}

// 현재 섹션의 스크롤 진행률 계산 (0 ~ 1)
function getCurrentSectionProgress(sectionIndex) {
    if (sectionIndex < 0) return 0;
    
    const sectionRange = getSectionScrollRange(sectionIndex);
    const currentScrollY = window.scrollY;
    
    if (currentScrollY < sectionRange.start) return 0;
    if (currentScrollY > sectionRange.end) return 1;
    
    return (currentScrollY - sectionRange.start) / sectionRange.range;
}

// 전체 스크롤 높이 동적 계산
function updateScrollHeight() {
    // sections가 아직 로드되지 않았으면 기본값 사용
    const totalSections = sections && sections.length > 0 ? sections.length : 1;
    const BOOK_ANIMATION_HEIGHT = 600; // 책 애니메이션 구간 (600vh) - book.js와 동일
    const bookAnimationHeight = window.innerHeight * (BOOK_ANIMATION_HEIGHT / 100);
    const sectionsHeight = window.innerHeight * (SECTION_SCROLL_RANGE / 100) * totalSections;
    const totalHeight = bookAnimationHeight + sectionsHeight;
    
    const scrollContainer = document.getElementById('scroll-container');
    if (scrollContainer) {
        scrollContainer.style.height = `${totalHeight}px`;
    }
}

function initContourDrawing() {
    // 스크롤 높이 업데이트
    updateScrollHeight();
    
    // 첫 번째 섹션 시작 (스크롤 위치와 관계없이 항상 첫 번째 섹션 로드)
    const activeIndex = getActiveSectionIndex();
    
    // 활성 섹션이 없거나 첫 번째 섹션 이전이면 첫 번째 섹션 강제 로드
    if (activeIndex >= 0) {
        loadSection(activeIndex);
    } else {
        // 스크롤 위치가 첫 번째 섹션 이전이면 첫 번째 섹션 로드
        loadSection(0);
    }
}

function loadSection(index, isNextPage = false) {
    if (index >= sections.length) return;
    
    const section = sections[index];
    const bookContent = document.querySelector('.book-content');
    if (!bookContent) return;
    
    // 페이지 레이어 선택 (다음 페이지면 .next, 아니면 .current)
    let pageLayer = bookContent.querySelector(isNextPage ? '.page-layer.next' : '.page-layer.current');
    
    // 페이지 레이어가 없으면 생성
    if (!pageLayer) {
        pageLayer = document.createElement('div');
        pageLayer.className = `page-layer ${isNextPage ? 'next' : 'current'}`;
        bookContent.appendChild(pageLayer);
    }
    
    // 현재 페이지를 다시 로드할 때는 기존 내용을 완전히 초기화
    if (!isNextPage) {
        // 기존 내용 완전히 제거
        pageLayer.innerHTML = '';
        
        // 페이지 넘김 인디케이터 제거
        const pageTurnIndicator = pageLayer.querySelector('.page-turn-indicator');
        if (pageTurnIndicator) {
            pageTurnIndicator.remove();
        }
        
        // 브러쉬 드로잉 제거
        const brushDrawing = pageLayer.querySelector('.brush-drawing');
        if (brushDrawing) {
            brushDrawing.remove();
        }
        
        // 상태 완전히 초기화
        sectionState = SectionState.SVG;
        svgPaths = [];
        totalPathLength = 0;
        typingText = section.text;
        typingIndex = 0;
        typingComplete = false;
        currentSectionIndex = index;
        pageTurnTriggered = false;
        isPageTurning = false;
        brushDrawingShown = false;
    } else {
        // 다음 페이지일 때는 기존 내용 제거 (새로 로드하기 위해)
        pageLayer.innerHTML = '';
    }
    
    // SVG가 없는 경우 (텍스트만)
    if (!section.svgPath && !section.svgPath01) {
        pageLayer.innerHTML = `
            <div class="section-container" data-section-id="${section.id}">
                <div class="svg-container"></div>
                <div class="text-container"></div>
            </div>
        `;
        // 텍스트 위치 설정
        const textContainer = pageLayer.querySelector('.text-container');
        if (textContainer) {
            const textPosition = section.textPosition || 'bottom-center';
            setTextPosition(textContainer, textPosition);
        }
        // 텍스트만 표시하는 섹션은 바로 타이핑 시작 (다음 페이지가 아닐 때만)
        if (!isNextPage) {
            sectionState = SectionState.TYPING;
            startSectionAnimation();
        }
        return;
    }
    
    // 여러 SVG가 있는 경우 (Final-Semester02)
    if (section.svgPath01) {
        const svgPathsToLoad = [
            section.svgPath01,
            section.svgPath02,
            section.svgPath03,
            section.svgPath04
        ].filter(path => path); // undefined 제거
        
        const imgPathsToLoad = [
            section.imgPath01,
            section.imgPath02,
            section.imgPath03,
            section.imgPath04
        ].filter(path => path); // undefined 제거
        
        pageLayer.innerHTML = `
            <div class="section-container" data-section-id="${section.id}">
                <div class="image-container"></div>
                <div class="svg-container"></div>
                <div class="text-container"></div>
            </div>
        `;
        
        // 텍스트 위치 설정
        const textContainer = pageLayer.querySelector('.text-container');
        if (textContainer) {
            const textPosition = section.textPosition || 'bottom-center';
            setTextPosition(textContainer, textPosition);
        }
        
        const svgContainer = pageLayer.querySelector('.svg-container');
        svgContainer.style.position = 'absolute';
        svgContainer.style.top = '0';
        svgContainer.style.left = '0';
        svgContainer.style.width = '100%';
        svgContainer.style.height = '100%';
        svgContainer.style.overflow = 'visible'; // 넘치는 부분도 보이도록
        
        // 이미지 컨테이너 설정
        const imageContainer = pageLayer.querySelector('.image-container');
        if (imageContainer && imgPathsToLoad.length > 0) {
            imageContainer.style.position = 'absolute';
            imageContainer.style.top = '0';
            imageContainer.style.left = '0';
            imageContainer.style.width = '100%';
            imageContainer.style.height = '100%';
            imageContainer.style.zIndex = '1';
            imageContainer.style.overflow = 'visible'; // 넘치는 부분도 보이도록
            
            imgPathsToLoad.forEach((imgPath, i) => {
                const imgWrapper = document.createElement('div');
                imgWrapper.style.position = 'absolute'; // 절대 위치로 겹치게 배치
                const img = document.createElement('img');
                img.src = imgPath;
                img.style.opacity = '0';
                img.style.pointerEvents = 'none';
                img.onload = () => {
                    // 이미지의 실제 크기 가져오기
                    const naturalWidth = img.naturalWidth;
                    const naturalHeight = img.naturalHeight;
                    const aspectRatio = naturalWidth / naturalHeight;
                    
                    // 컨테이너 크기 기준 (화면 너비의 약 40%를 기준으로, 비율 유지)
                    const baseWidth = window.innerWidth * 0.4; // 화면 너비의 40%
                    const containerWidth = baseWidth;
                    const containerHeight = containerWidth / aspectRatio;
                    
                    // 컨테이너 크기 설정 (각 이미지의 실제 비율에 맞춤)
                    imgWrapper.style.width = `${containerWidth}px`;
                    imgWrapper.style.height = `${containerHeight}px`;
                    
                    // 겹치게 배치하기 위해 약간씩 오프셋 적용
                    const offsetX = (i % 2) * (containerWidth * 0.1); // 좌우 약간씩 오프셋
                    const offsetY = Math.floor(i / 2) * (containerHeight * 0.1); // 상하 약간씩 오프셋
                    const centerX = (window.innerWidth - containerWidth) / 2;
                    const centerY = (window.innerHeight - containerHeight) / 2;
                    
                    imgWrapper.style.left = `${centerX + offsetX}px`;
                    imgWrapper.style.top = `${centerY + offsetY}px`;
                    
                    // 이미지가 컨테이너를 꽉 채우도록
                    img.style.width = '100%';
                    img.style.height = '100%';
                    img.style.objectFit = 'contain';
                };
                img.onerror = () => {
                };
                imgWrapper.appendChild(img);
                imageContainer.appendChild(imgWrapper);
            });
        }
        
        // 모든 SVG 로드
        Promise.all(svgPathsToLoad.map(path => 
            fetch(path).then(response => response.text())
        )).then(svgTexts => {
            svgTexts.forEach((svgText, i) => {
                const svgWrapper = document.createElement('div');
                svgWrapper.style.position = 'absolute'; // 절대 위치로 겹치게 배치
                svgWrapper.innerHTML = svgText;
                const svg = svgWrapper.querySelector('svg');
                if (svg) {
                    // SVG의 실제 크기 가져오기 (viewBox 또는 width/height 속성)
                    let svgWidth = svg.getAttribute('width');
                    let svgHeight = svg.getAttribute('height');
                    const viewBox = svg.getAttribute('viewBox');
                    
                    // viewBox가 있으면 그것을 사용
                    if (viewBox) {
                        const viewBoxValues = viewBox.split(/\s+/);
                        if (viewBoxValues.length >= 4) {
                            svgWidth = parseFloat(viewBoxValues[2]);
                            svgHeight = parseFloat(viewBoxValues[3]);
                        }
                    }
                    
                    // 숫자가 아니면 기본값 사용
                    svgWidth = parseFloat(svgWidth) || 1000;
                    svgHeight = parseFloat(svgHeight) || 1000;
                    
                    const aspectRatio = svgWidth / svgHeight;
                    
                    // 컨테이너 크기 기준 (화면 너비의 약 40%를 기준으로, 비율 유지)
                    const baseWidth = window.innerWidth * 0.4; // 화면 너비의 40%
                    const containerWidth = baseWidth;
                    const containerHeight = containerWidth / aspectRatio;
                    
                    // 컨테이너 크기 설정 (각 SVG의 실제 비율에 맞춤)
                    svgWrapper.style.width = `${containerWidth}px`;
                    svgWrapper.style.height = `${containerHeight}px`;
                    
                    // 겹치게 배치하기 위해 약간씩 오프셋 적용 (이미지와 동일한 위치)
                    const offsetX = (i % 2) * (containerWidth * 0.1); // 좌우 약간씩 오프셋
                    const offsetY = Math.floor(i / 2) * (containerHeight * 0.1); // 상하 약간씩 오프셋
                    const centerX = (window.innerWidth - containerWidth) / 2;
                    const centerY = (window.innerHeight - containerHeight) / 2;
                    
                    svgWrapper.style.left = `${centerX + offsetX}px`;
                    svgWrapper.style.top = `${centerY + offsetY}px`;
                    
                    // SVG가 컨테이너를 꽉 채우도록
                    svg.style.width = '100%';
                    svg.style.height = '100%';
                    svg.style.zIndex = '2';
                    
                    // SVG에 마스크 ID 추가
                    if (!isNextPage && imgPathsToLoad[i]) {
                        svg.setAttribute('data-mask-id', `mask-${section.id}-${i}`);
                    }
                }
                svgContainer.appendChild(svgWrapper);
            });
            
            // Path 초기화 (모든 SVG의 path 수집)
            // 다음 페이지가 아닐 때만 svgPaths에 추가
            if (!isNextPage) {
                svgPaths = [];
                totalPathLength = 0;
            }
            
            const allSvgs = svgContainer.querySelectorAll('svg');
            allSvgs.forEach(svg => {
                const paths = Array.from(svg.querySelectorAll('path'));
                paths.forEach((path) => {
                    // 먼저 transition 제거하여 즉시 적용되도록
                    path.style.transition = 'none';
                    
                    const length = path.getTotalLength();
                    if (length > 0) {
                        // 즉시 숨김 상태로 초기화 (다음 페이지도 확실하게 숨김)
                        path.style.strokeDasharray = `${length}`;
                        path.style.strokeDashoffset = `${length}`;
                        
                        if (!isNextPage) {
                            totalPathLength += length;
                            svgPaths.push(path);
                        }
                    }
                });
            });
            
            // 초기화 후 transition 설정 (다음 페이지가 아닐 때만)
            if (!isNextPage) {
                requestAnimationFrame(() => {
                    svgPaths.forEach((path) => {
                        path.style.transition = 'stroke-dashoffset 0.1s linear';
                    });
                });
                startSectionAnimation();
            }
        }).catch(error => {
        });
        return;
    }
    
    // 단일 SVG 로드
    fetch(section.svgPath)
        .then(response => response.text())
        .then(svgText => {
            // SVG를 DOM에 삽입
            pageLayer.innerHTML = `
                <div class="section-container" data-section-id="${section.id}">
                    <div class="image-container"></div>
                    <div class="svg-container"></div>
                    <div class="text-container"></div>
                </div>
            `;
            
            // 이미지 컨테이너 설정 (SVG 뒤에 배치)
            const imageContainer = pageLayer.querySelector('.image-container');
            if (imageContainer && section.imgPath) {
                const img = document.createElement('img');
                img.src = section.imgPath;
                img.style.width = 'auto';
                img.style.height = '60%';
                img.style.objectFit = 'contain';
                img.style.position = 'absolute';
                img.style.top = '50%';
                img.style.left = '50%';
                img.style.transform = 'translate(-50%, -50%)';
                img.style.opacity = '0';
                img.style.pointerEvents = 'none';
                imageContainer.appendChild(img);
            }
            
            // 텍스트 위치 설정
            const textContainer = pageLayer.querySelector('.text-container');
            if (textContainer) {
                const textPosition = section.textPosition || 'bottom-center';
                setTextPosition(textContainer, textPosition);
            }
            
            const svgContainer = pageLayer.querySelector('.svg-container');
            svgContainer.innerHTML = svgText;
            
            const svg = svgContainer.querySelector('svg');
            if (!svg) return;
            
            // SVG 스타일 설정
            svg.style.width = 'auto';
            svg.style.height = '60%';
            svg.style.display = 'block';
            svg.style.margin = '0 auto';
            svg.style.position = 'absolute';
            svg.style.top = '50%';
            svg.style.left = '50%';
            svg.style.transform = 'translate(-50%, -50%)';
            svg.style.zIndex = '2';
            
            // SVG에 마스크 ID 추가 (드래그로 지울 때 사용)
            if (!isNextPage && section.imgPath) {
                svg.setAttribute('data-mask-id', `mask-${section.id}`);
            }
            
            // Path 초기화 - 먼저 모든 path를 숨김
            // 다음 페이지가 아닐 때만 svgPaths에 추가
            if (!isNextPage) {
                svgPaths = [];
                totalPathLength = 0;
            }
            
            const paths = Array.from(svg.querySelectorAll('path'));
            paths.forEach((path) => {
                // 먼저 transition 제거하여 즉시 적용되도록
                path.style.transition = 'none';
                
                const length = path.getTotalLength();
                if (length > 0) {
                    // 즉시 숨김 상태로 초기화 (다음 페이지도 확실하게 숨김)
                    path.style.strokeDasharray = `${length}`;
                    path.style.strokeDashoffset = `${length}`;
                    
                    if (!isNextPage) {
                        totalPathLength += length;
                        svgPaths.push(path);
                    }
                }
            });
            
            // 초기화 후 transition 설정 (다음 페이지가 아닐 때만)
            if (!isNextPage) {
                requestAnimationFrame(() => {
                    svgPaths.forEach((path) => {
                        path.style.transition = 'stroke-dashoffset 0.1s linear';
                    });
                });
                startSectionAnimation();
            }
        })
        .catch(error => {
        });
}

let scrollEventListenerAdded = false; // 스크롤 이벤트 리스너 중복 방지
let updateSVGAnimation = null; // updateSVGAnimation 함수 참조

function startSectionAnimation() {
    // SVG 그리기 애니메이션 시작
    animateSVGPaths();
}

function animateSVGPaths() {
    function updateSVGAnimationInner() {
        // 섹션이 로드되지 않았으면 리턴
        if (!sections || sections.length === 0) return;
        
        // 현재 활성 섹션 확인
        const activeIndex = getActiveSectionIndex();
        
        // 책 애니메이션 구간이거나 활성 섹션이 없으면 리턴
        if (activeIndex < 0) {
            const bookContent = document.querySelector('.book-content');
            const currentPageLayer = bookContent?.querySelector('.page-layer.current');
            if (currentPageLayer && currentPageLayer.querySelector('.svg-container')) {
                const svgPaths = currentPageLayer.querySelectorAll('path');
                svgPaths.forEach(path => {
                    const length = path.getTotalLength();
                    path.style.strokeDashoffset = length;
                });
                const textContainer = currentPageLayer.querySelector('.text-container');
                if (textContainer) {
                    textContainer.textContent = '';
                }
            }
            return;
        }
        
        // 페이지 넘김 중이면 업데이트하지 않음
        if (isPageTurning) {
            console.log(`[DEBUG] 페이지 넘김 중 - activeIndex: ${activeIndex}, currentSectionIndex: ${currentSectionIndex}, sectionState: ${sectionState}`);
            return;
        }
        
        // 페이지 넘김 상태일 때는 완전히 차단
        if (sectionState === SectionState.PAGE_TURN) {
            // 스크롤로 인한 섹션 변경 시도 차단
            if (activeIndex !== currentSectionIndex) {
                console.log(`[DEBUG] 페이지 넘김 상태에서 스크롤로 인한 섹션 변경 시도 차단 - activeIndex: ${activeIndex}, currentSectionIndex: ${currentSectionIndex}`);
            }
            return;
        }
        
        // 스크롤로 인한 자동 섹션 변경 완전히 차단 (클릭으로만 페이지 넘김 가능)
        // 단, 애니메이션은 계속 진행되어야 하므로 loadSection만 호출하지 않음
        if (activeIndex !== currentSectionIndex) {
            console.log(`[DEBUG] 스크롤로 인한 섹션 변경 시도 차단 - activeIndex: ${activeIndex}, currentSectionIndex: ${currentSectionIndex}, sectionState: ${sectionState}, isPageTurning: ${isPageTurning}`);
            // loadSection을 호출하지 않지만, 현재 섹션의 애니메이션은 계속 진행
            // activeIndex를 currentSectionIndex로 고정하여 현재 섹션의 진행률만 계산
        }
        
        // 현재 섹션이 SVG 또는 TYPING 상태가 아니면 리턴
        if (sectionState !== SectionState.SVG && sectionState !== SectionState.TYPING) return;
        
        // 현재 섹션의 스크롤 진행률 계산 (현재 섹션 인덱스 사용)
        const sectionProgress = getCurrentSectionProgress(currentSectionIndex);
        
        // 섹션 시작 지점 확인 (빠르게 시작)
        const SECTION_START = 0.02;
        
        // SVG가 없는 섹션 (텍스트만) - 바로 다음 페이지로 넘어감
        if (svgPaths.length === 0) {
            if (!typingComplete) {
                typingComplete = true;
                sectionState = SectionState.PAGE_TURN;
                showPageTurnIndicator();
            }
            return;
        }
        
        if (sectionProgress < SECTION_START) {
            // SVG 시작 전에는 모든 path 숨김
            svgPaths.forEach(path => {
                const length = path.getTotalLength();
                path.style.strokeDashoffset = length;
            });
            // 텍스트도 숨김
            const bookContent = document.querySelector('.book-content');
            const currentPageLayer = bookContent?.querySelector('.page-layer.current');
            const textContainer = currentPageLayer?.querySelector('.text-container');
            if (textContainer) {
                textContainer.textContent = '';
            }
            return;
        }
        
        // 초반은 천천히, 끝에서 완주하도록 이징 적용
        const rawProgress = clamp01((sectionProgress - SECTION_START) / (1 - SECTION_START));
        const easedProgress = easeInOutCubic(rawProgress);
        const svgProgress = Math.pow(easedProgress, DRAW_EASE_POWER);
        
        // SVG 드로잉 사운드 재생 (루프) - 진행률 0.1 이상일 때 시작, 0.9 이상일 때 종료
        const DRAWING_SOUND_START = 0.1;
        const DRAWING_SOUND_END = 0.9;
        
        if (svgProgress >= DRAWING_SOUND_START && svgProgress < DRAWING_SOUND_END) {
            if (!drawingAudio) {
                drawingAudio = new Audio('audio/drawing.mp3');
                drawingAudio.loop = true;
                drawingAudio.volume = 0.1;
                drawingAudio.play().catch(error => {
                    console.error('드로잉 사운드 재생 실패:', error);
                });
            }
        } else {
            // 진행률이 0.1 미만이거나 0.9 이상이면 사운드 정지
            if (drawingAudio) {
                drawingAudio.pause();
                drawingAudio.currentTime = 0;
                drawingAudio = null;
            }
        }
        
        // 역재생 감지 (svgProgress가 감소하는 경우)
        const isReversing = svgProgress < lastSvgProgress;
        if (isReversing && svgProgress >= DRAWING_SOUND_START && svgProgress < DRAWING_SOUND_END) {
            // 역재생 중에도 사운드 재생 (진행률 범위 내에서만)
            if (!drawingAudio) {
                drawingAudio = new Audio('audio/drawing.mp3');
                drawingAudio.loop = true;
                drawingAudio.volume = 0.4;
                drawingAudio.play().catch(error => {
                    console.error('드로잉 사운드 재생 실패:', error);
                });
            }
        }
        lastSvgProgress = svgProgress;
        
        const pathCount = svgPaths.length;
        const progressPerPath = 1 / pathCount;
        
        svgPaths.forEach((path, index) => {
            const length = path.getTotalLength();
            const pathStartProgress = index * progressPerPath;
            const pathEndProgress = (index + 1) * progressPerPath;
            
            let pathProgress = 0;
            if (svgProgress >= pathEndProgress) {
                pathProgress = 1;
            } else if (svgProgress > pathStartProgress) {
                pathProgress = (svgProgress - pathStartProgress) / progressPerPath;
            }
            
            path.style.strokeDashoffset = length * (1 - pathProgress);
        });
        
        // 텍스트 타이핑: SVG 진행률 50%부터 시작
        if (svgProgress >= TEXT_START_PROGRESS) {
            sectionState = SectionState.TYPING;
            animateTextTyping(svgProgress);
        }
    }
    
    // updateSVGAnimation 함수 참조 저장
    updateSVGAnimation = updateSVGAnimationInner;
    
    // 스크롤 이벤트 리스너가 없으면 추가 (한 번만)
    if (!scrollEventListenerAdded) {
        window.addEventListener('scroll', updateSVGAnimation);
        scrollEventListenerAdded = true;
    }
    
    // 초기 실행
    updateSVGAnimation();
}

// 텍스트 위치 설정 함수
function setTextPosition(textContainer, position) {
    if (!textContainer) return;
    
    // 기존 위치 클래스 제거
    textContainer.classList.remove('text-top-left', 'text-top-right', 'text-bottom-left', 'text-bottom-right', 'text-bottom-center');
    
    // 위치에 따른 클래스 추가
    switch(position) {
        case 'top-left':
            textContainer.classList.add('text-top-left');
            break;
        case 'top-right':
            textContainer.classList.add('text-top-right');
            break;
        case 'bottom-left':
            textContainer.classList.add('text-bottom-left');
            break;
        case 'bottom-right':
            textContainer.classList.add('text-bottom-right');
            break;
        default: // 기본값: 하단 중앙
            textContainer.classList.add('text-bottom-center');
    }
}

function animateTextTyping(svgProgress) {
    const bookContent = document.querySelector('.book-content');
    const currentPageLayer = bookContent?.querySelector('.page-layer.current');
    const textContainer = currentPageLayer?.querySelector('.text-container');
    if (!textContainer || !typingText) return;
    
    // 텍스트 컨테이너 스타일 설정 (한 번만)
    if (!textContainer.style.position || textContainer.style.position === '') {
        const section = sections[currentSectionIndex];
        const textPosition = section.textPosition || 'bottom-center'; // 기본값
        setTextPosition(textContainer, textPosition);
    }
    
    // SVG 진행률 0.5 ~ 1.0 구간을 텍스트 길이로 매핑
    const textProgressRange = 1.0 - TEXT_START_PROGRESS; // 0.5
    const normalizedProgress = clamp01((svgProgress - TEXT_START_PROGRESS) / textProgressRange);
    
    // 초반 속도를 늦추는 이징 적용
    const easedTextProgress = Math.pow(easeInOutCubic(normalizedProgress), TEXT_EASE_POWER);
    
    // 표시할 글자 수 계산
    const totalChars = typingText.length;
    const charsToShow = Math.floor(easedTextProgress * totalChars);
    
    // 텍스트 타이핑 시작 시 사운드 재생 (한 번만)
    if (charsToShow > 0 && !pencilWritingAudio) {
        pencilWritingAudio = new Audio('audio/pencil-writing.mp3');
        pencilWritingAudio.loop = true;
        pencilWritingAudio.volume = 1;
        pencilWritingAudio.play().catch(error => {
            console.error('펜슬 사운드 재생 실패:', error);
        });
    }
    
    // 텍스트 업데이트
    textContainer.textContent = typingText.substring(0, charsToShow);
    
    // 텍스트 타이핑 완료 체크
    if (charsToShow >= totalChars && !typingComplete) {
        typingComplete = true;
        sectionState = SectionState.PAGE_TURN;
        
        // 타이핑 사운드 정지
        if (pencilWritingAudio) {
            pencilWritingAudio.pause();
            pencilWritingAudio.currentTime = 0;
            pencilWritingAudio = null;
        }
        
        // 페이지 넘김 가능 표시 (오른쪽 가장자리 접힘 효과)
        showPageTurnIndicator();
    }
}

// SVG가 없는 섹션용 텍스트 타이핑 함수
function animateTextTypingForTextOnly(textProgress) {
    const bookContent = document.querySelector('.book-content');
    const currentPageLayer = bookContent?.querySelector('.page-layer.current');
    const textContainer = currentPageLayer?.querySelector('.text-container');
    if (!textContainer || !typingText) return;
    
    // 텍스트 컨테이너 위치 설정 (한 번만)
    if (!textContainer.classList.contains('text-top-left') && 
        !textContainer.classList.contains('text-top-right') && 
        !textContainer.classList.contains('text-bottom-left') && 
        !textContainer.classList.contains('text-bottom-right') && 
        !textContainer.classList.contains('text-bottom-center')) {
        const section = sections[currentSectionIndex];
        const textPosition = section.textPosition || 'bottom-center'; // 기본값
        setTextPosition(textContainer, textPosition);
    }
    
    // 초반 속도를 늦추는 이징 적용
    const easedTextProgress = Math.pow(easeInOutCubic(textProgress), TEXT_EASE_POWER);
    
    // 표시할 글자 수 계산
    const totalChars = typingText.length;
    const charsToShow = Math.floor(easedTextProgress * totalChars);
    
    // 텍스트 업데이트
    textContainer.textContent = typingText.substring(0, charsToShow);
    
    // 텍스트 타이핑 완료 체크
    if (charsToShow >= totalChars && !typingComplete) {
        typingComplete = true;
        sectionState = SectionState.PAGE_TURN;
        // 페이지 넘김 가능 표시 (오른쪽 가장자리 접힘 효과)
        showPageTurnIndicator();
    }
}

// 페이지 넘김 가능 표시 (오른쪽 가장자리 접힘 효과)
function showPageTurnIndicator() {
    const bookContent = document.querySelector('.book-content');
    if (!bookContent) {
        return;
    }
    
    const currentPageLayer = bookContent.querySelector('.page-layer.current');
    if (!currentPageLayer) {
        return;
    }
    
    // 페이지 넘김 중이면 표시하지 않음
    if (isPageTurning) {
        return;
    }
    
    // 페이지 넘김 인디케이터가 이미 있으면 제거
    let pageTurnIndicator = currentPageLayer.querySelector('.page-turn-indicator');
    if (pageTurnIndicator) {
        pageTurnIndicator.remove();
    }
    
    // Brush-Drawing.svg가 이미 있으면 제거
    let brushDrawing = currentPageLayer.querySelector('.brush-drawing');
    if (brushDrawing) {
        brushDrawing.remove();
    }
    
    // 페이지 넘김 인디케이터 생성
    pageTurnIndicator = document.createElement('div');
    pageTurnIndicator.className = 'page-turn-indicator';
    currentPageLayer.appendChild(pageTurnIndicator);
    
    // 클릭 이벤트 추가
    pageTurnIndicator.addEventListener('click', () => {
        turnPage();
    });
    
    // 마우스 오버 시 시각적 피드백
    pageTurnIndicator.style.opacity = '1';
    
    // Brush-Drawing.svg 표시
    showBrushDrawing(currentPageLayer);
    
    // 스크롤 막기 (body와 html 모두 막기)
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    console.log('스크롤 막힘');
}

// Brush-Drawing.svg 표시 함수
function showBrushDrawing(pageLayer) {
    if (!pageLayer) {
        return;
    }
    
    // Brush-Drawing.svg 로드
    fetch('svg/Brush-Drawing.svg')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.text();
        })
        .then(svgText => {
            // Brush-Drawing 컨테이너 생성
            const brushContainer = document.createElement('div');
            brushContainer.className = 'brush-drawing';
            brushContainer.innerHTML = svgText;
            
            // SVG 스타일 설정
            const svg = brushContainer.querySelector('svg');
            if (svg) {
                svg.style.width = '15.625vw'; // 2배 크기 (7.813vw * 2)
                svg.style.height = 'auto';
                svg.style.display = 'block';
                svg.style.opacity = '1';
                svg.style.filter = 'none';
                svg.style.imageRendering = 'crisp-edges'; // 선명하게
            }
            
            // 브러쉬 컨테이너도 opacity 확인
            brushContainer.style.opacity = '1';
            
            pageLayer.appendChild(brushContainer);
            
            // 브러쉬 드로잉이 나타난 시점의 스크롤 위치 저장
            brushDrawingShown = true;
            brushDrawingScrollY = window.scrollY;
            
            // 드래그 기능 추가
            initBrushDrawingDrag(brushContainer, pageLayer);
        })
        .catch(error => {
        });
}

// Brush-Drawing 드래그 기능 초기화
function initBrushDrawingDrag(brushContainer, pageLayer) {
    let isDragging = false;
    const sectionContainer = pageLayer.querySelector('.section-container');
    if (!sectionContainer) return;
    
    // 브러쉬 SVG의 viewBox: "0 0 1802 1599"
    // 붓 끝 위치 조정 (viewBox 내 좌표)
    const BRUSH_TIP_X = 400; // x 좌표 (0~1802)
    const BRUSH_TIP_Y = 320; // y 좌표 (0~1599)
    const BRUSH_SVG_WIDTH = 1802;
    const BRUSH_SVG_HEIGHT = 1599;
    
    // 비율 계산
    const brushTipRatioX = BRUSH_TIP_X / BRUSH_SVG_WIDTH;
    const brushTipRatioY = BRUSH_TIP_Y / BRUSH_SVG_HEIGHT;
    
    const svgContainer = sectionContainer.querySelector('.svg-container');
    const imageContainer = sectionContainer.querySelector('.image-container');
    if (!svgContainer || !imageContainer) return;
    
    // 모든 SVG와 이미지 찾기
    const svgs = svgContainer.querySelectorAll('svg');
    const imgs = imageContainer.querySelectorAll('img');
    
    if (svgs.length === 0 || imgs.length === 0) return;
    
    // 이미지 표시
    imgs.forEach(img => {
        img.style.opacity = '1';
    });
    
    // SVG 컨테이너에 불투명한 배경 추가 (초기 상태: 이미지가 안 보임)
    svgContainer.style.backgroundColor = '#fff';
    svgContainer.style.backgroundImage = 'url(img/paper_texture2.png)';
    svgContainer.style.backgroundSize = 'cover';
    svgContainer.style.backgroundPosition = 'center';
    
    // 마스크용 SVG 생성 (SVG 컨테이너와 같은 크기)
    const maskSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    maskSvg.setAttribute('class', 'mask-svg');
    maskSvg.style.position = 'absolute';
    maskSvg.style.top = '0';
    maskSvg.style.left = '0';
    maskSvg.style.width = '100%';
    maskSvg.style.height = '100%';
    maskSvg.style.pointerEvents = 'none';
    maskSvg.style.zIndex = '3';
    
    const updateMaskSvgSize = () => {
        const rect = svgContainer.getBoundingClientRect();
        maskSvg.setAttribute('width', rect.width);
        maskSvg.setAttribute('height', rect.height);
        maskSvg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
    };
    
    updateMaskSvgSize();
    
    // 마스크 정의 생성
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const mask = document.createElementNS('http://www.w3.org/2000/svg', 'mask');
    mask.setAttribute('id', `mask-${Date.now()}`);
    
    // 흰색 배경 (초기 상태: 모두 보임 = SVG 컨테이너가 불투명)
    const whiteRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    whiteRect.setAttribute('width', '100%');
    whiteRect.setAttribute('height', '100%');
    whiteRect.setAttribute('fill', 'white');
    mask.appendChild(whiteRect);
    
    defs.appendChild(mask);
    maskSvg.appendChild(defs);
    svgContainer.appendChild(maskSvg);
    
    // SVG 컨테이너에 마스크 적용 (검은색 부분이 투명해짐)
    const maskId = mask.getAttribute('id');
    svgContainer.style.mask = `url(#${maskId})`;
    svgContainer.style.webkitMask = `url(#${maskId})`;
    
    const brushRadius = window.innerWidth / 100; // 1vw를 픽셀 단위로
    let lastX = null;
    let lastY = null;
    let brushOffsetX = 0;
    let brushOffsetY = 0;
    
    // 실제 이미지 요소 찾기
    const actualImgs = Array.from(imgs);
    if (actualImgs.length === 0) return;
    
    // 각 이미지마다 별도의 Canvas 생성 (각 이미지 크기에 정확히 맞춤)
    const eraseCanvases = []; // 각 이미지별 Canvas 배열
    const eraseCtxs = []; // 각 Canvas의 context 배열
    
    // 각 이미지에 대한 Canvas 생성 함수
    const createCanvasForImage = (img, index) => {
        const svgRect = svgContainer.getBoundingClientRect();
        const imgRect = img.getBoundingClientRect();
        const relativeLeft = imgRect.left - svgRect.left;
        const relativeTop = imgRect.top - svgRect.top;
        
        // 각 이미지 크기에 정확히 맞는 Canvas 생성
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(imgRect.width);
        canvas.height = Math.floor(imgRect.height);
        
        canvas.style.position = 'absolute';
        canvas.style.left = `${relativeLeft}px`;
        canvas.style.top = `${relativeTop}px`;
        canvas.style.width = `${imgRect.width}px`;
        canvas.style.height = `${imgRect.height}px`;
        canvas.style.pointerEvents = 'none';
        canvas.style.zIndex = '2';
        canvas.style.opacity = '0';
        canvas.setAttribute('data-img-index', index); // 이미지 인덱스 저장
        
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        svgContainer.appendChild(canvas);
        eraseCanvases.push(canvas);
        eraseCtxs.push(ctx);
    };
    
    // 이미지가 모두 로드된 후 각 이미지마다 Canvas 생성
    let imagesLoaded = 0;
    const totalImages = actualImgs.length;
    
    if (totalImages === 0) return;
    
    const checkAndCreateCanvases = () => {
        imagesLoaded++;
        if (imagesLoaded === totalImages) {
            // 모든 이미지가 로드된 후 약간의 지연을 두고 각 이미지마다 Canvas 생성
            setTimeout(() => {
                actualImgs.forEach((img, index) => {
                    createCanvasForImage(img, index);
                });
                updateTotalArea(); // 총 면적 계산
            }, 100);
        }
    };
    
    // 이미지 로드 이벤트 리스너 추가
    actualImgs.forEach(img => {
        if (img.complete && img.naturalWidth > 0) {
            checkAndCreateCanvases();
        } else {
            img.addEventListener('load', checkAndCreateCanvases);
            img.addEventListener('error', checkAndCreateCanvases);
        }
    });
    
    // 지워진 영역 추적을 위한 변수
    let totalErasedArea = 0;
    let totalArea = 0;
    
    // 전체 영역 계산 (모든 이미지의 총 면적 기준)
    const updateTotalArea = () => {
        totalArea = 0;
        
        actualImgs.forEach(img => {
            const imgRect = img.getBoundingClientRect();
            totalArea += imgRect.width * imgRect.height;
        });
    };
    
    // SVG 컨테이너 좌표를 해당 이미지의 Canvas 좌표로 변환하는 함수
    const toCanvasCoords = (svgX, svgY) => {
        const svgRect = svgContainer.getBoundingClientRect();
        
        // 어떤 이미지 영역에 있는지 찾기
        for (let i = 0; i < actualImgs.length; i++) {
            const img = actualImgs[i];
            const imgRect = img.getBoundingClientRect();
            const relativeLeft = imgRect.left - svgRect.left;
            const relativeTop = imgRect.top - svgRect.top;
            const relativeRight = relativeLeft + imgRect.width;
            const relativeBottom = relativeTop + imgRect.height;
            
            // 해당 이미지 영역 안에 있으면 해당 Canvas 좌표로 변환
            if (svgX >= relativeLeft && svgX <= relativeRight &&
                svgY >= relativeTop && svgY <= relativeBottom) {
                return {
                    canvasIndex: i,
                    x: svgX - relativeLeft,
                    y: svgY - relativeTop
                };
            }
        }
        
        // 어떤 이미지 영역에도 없으면 첫 번째 Canvas 기준으로 반환
        if (actualImgs.length > 0) {
            const imgRect = actualImgs[0].getBoundingClientRect();
            const relativeLeft = imgRect.left - svgRect.left;
            const relativeTop = imgRect.top - svgRect.top;
            return {
                canvasIndex: 0,
                x: svgX - relativeLeft,
                y: svgY - relativeTop
            };
        }
        
        return { canvasIndex: -1, x: 0, y: 0 };
    };
    
    // 지워진 영역 비율 계산 함수 (모든 Canvas 합산)
    const getErasedRatio = () => {
        if (totalArea === 0 || eraseCanvases.length === 0) {
            return 0;
        }
        
        let totalErasedPixels = 0;
        let totalImagePixels = 0;
        
        // 각 Canvas를 확인하여 지워진 픽셀 합산
        eraseCanvases.forEach((canvas, index) => {
            if (canvas.width === 0 || canvas.height === 0) return;
            
            const ctx = eraseCtxs[index];
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            // 샘플링하여 성능 향상
            for (let i = 0; i < data.length; i += 16) { // RGBA = 4바이트씩, 4픽셀마다 샘플링
                const alpha = data[i + 3];
                totalImagePixels++;
                // 완전히 투명한 픽셀 (지워진 픽셀)
                if (alpha < 10) {
                    totalErasedPixels++;
                }
            }
        });
        
        const ratio = totalImagePixels > 0 ? totalErasedPixels / totalImagePixels : 0;
        return ratio;
    };
    
    // 페이드아웃 애니메이션 (나머지 부분 스르륵 지워짐)
    let fadeOutAnimation = null;
    const startFadeOut = () => {
        if (fadeOutAnimation) return;
        
        fadeOutAnimation = true;
        const fadeOutRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        fadeOutRect.setAttribute('width', '100%');
        fadeOutRect.setAttribute('height', '100%');
        fadeOutRect.setAttribute('fill', 'black'); // 검은색 = 완전히 지워짐
        fadeOutRect.setAttribute('opacity', '0');
        fadeOutRect.style.transition = 'opacity 1.5s ease-out'; // 더 천천히 페이드아웃
        mask.appendChild(fadeOutRect);
        
        // transition이 적용되도록 브라우저에 스타일 적용 시간을 줌
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                fadeOutRect.setAttribute('opacity', '1'); // 나머지 부분 완전히 지워짐
            });
        });
    };
    
    // 드래그 시작
    brushContainer.addEventListener('mousedown', (e) => {
        isDragging = true;
        lastX = null;
        lastY = null;
        
        // 브러쉬 중심점 기준 오프셋 계산
        const brushRect = brushContainer.getBoundingClientRect();
        brushOffsetX = e.clientX - (brushRect.left + brushRect.width / 2);
        brushOffsetY = e.clientY - (brushRect.top + brushRect.height / 2);
        
        // 커서 숨기기
        document.body.style.cursor = 'none';
        
        e.preventDefault();
    });
    
    // 드래그 중
    const handleMouseMove = (e) => {
        if (!isDragging) return;
        
        // 브러쉬 위치 업데이트
        const brushX = e.clientX - brushOffsetX;
        const brushY = e.clientY - brushOffsetY;
        brushContainer.style.left = `${brushX}px`;
        brushContainer.style.top = `${brushY}px`;
        brushContainer.style.right = 'auto';
        brushContainer.style.bottom = 'auto';
        
        // 브러쉬 SVG 내의 붓 끝 부분 위치 계산
        const brushRect = brushContainer.getBoundingClientRect();
        
        // 브러쉬 컨테이너 내에서 붓 끝의 실제 위치
        const brushTipX = brushRect.left + brushRect.width * brushTipRatioX;
        const brushTipY = brushRect.top + brushRect.height * brushTipRatioY;
        
        const svgContainerRect = svgContainer.getBoundingClientRect();
        
        // 붓 끝이 SVG 컨테이너 영역 안에 있는지 확인
        if (brushTipX >= svgContainerRect.left && brushTipX <= svgContainerRect.right &&
            brushTipY >= svgContainerRect.top && brushTipY <= svgContainerRect.bottom) {
            
            // 붓 끝을 SVG 좌표로 변환
            const x = brushTipX - svgContainerRect.left;
            const y = brushTipY - svgContainerRect.top;
            
            if (lastX !== null && lastY !== null) {
                // 이전 위치와 현재 위치 사이의 거리 계산
                const dx = x - lastX;
                const dy = y - lastY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance > 0) {
                    // 두 점 사이에 여러 개의 원을 배치하여 스윽 이어지게
                    const steps = Math.ceil(distance / (brushRadius * 0.5)); // 원이 겹치도록 밀도 있게 배치
                    const stepX = dx / steps;
                    const stepY = dy / steps;
                    
                    for (let i = 0; i <= steps; i++) {
                        const circleX = lastX + stepX * i;
                        const circleY = lastY + stepY * i;
                        
                        // Canvas 좌표로 변환
                        const canvasCoords = toCanvasCoords(circleX, circleY);
                        
                        // 해당 이미지의 Canvas에 그리기
                        if (canvasCoords.canvasIndex >= 0 && canvasCoords.canvasIndex < eraseCanvases.length) {
                            const targetCanvas = eraseCanvases[canvasCoords.canvasIndex];
                            const targetCtx = eraseCtxs[canvasCoords.canvasIndex];
                            
                            // Canvas 영역 내에 있는지 확인
                            if (canvasCoords.x >= -brushRadius && canvasCoords.x < targetCanvas.width + brushRadius &&
                                canvasCoords.y >= -brushRadius && canvasCoords.y < targetCanvas.height + brushRadius) {
                                // 해당 Canvas에 지워진 영역 기록 (완전히 투명하게)
                                targetCtx.globalCompositeOperation = 'destination-out';
                                targetCtx.globalAlpha = 1.0;
                                targetCtx.beginPath();
                                targetCtx.arc(canvasCoords.x, canvasCoords.y, brushRadius, 0, Math.PI * 2);
                                targetCtx.fill();
                            }
                        }
                        
                        // 마스크에 검은색 원 추가 (fill-opacity로 60%만 지워지게)
                        // fill-opacity 0.6 = 60% 지워짐 (40% 보임)
                        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                        circle.setAttribute('cx', circleX);
                        circle.setAttribute('cy', circleY);
                        circle.setAttribute('r', brushRadius);
                        circle.setAttribute('fill', 'black'); // 검은색 = 지워짐
                        circle.setAttribute('fill-opacity', '0.6'); // 60%만 지워짐
                        mask.appendChild(circle);
                    }
                    
                    // 지워진 비율 확인
                    const erasedRatio = getErasedRatio();
                    if (erasedRatio >= 0.6 && !fadeOutAnimation) {
                        startFadeOut();
                    }
                }
            } else {
                // 첫 번째 점일 때는 원 하나만 추가
                // Canvas 좌표로 변환
                const canvasCoords = toCanvasCoords(x, y);
                
                // 해당 이미지의 Canvas에 그리기
                if (canvasCoords.canvasIndex >= 0 && canvasCoords.canvasIndex < eraseCanvases.length) {
                    const targetCanvas = eraseCanvases[canvasCoords.canvasIndex];
                    const targetCtx = eraseCtxs[canvasCoords.canvasIndex];
                    
                    // Canvas 영역 내에 있는지 확인
                    if (canvasCoords.x >= -brushRadius && canvasCoords.x < targetCanvas.width + brushRadius &&
                        canvasCoords.y >= -brushRadius && canvasCoords.y < targetCanvas.height + brushRadius) {
                        // 해당 Canvas에 지워진 영역 기록 (완전히 투명하게)
                        targetCtx.globalCompositeOperation = 'destination-out';
                        targetCtx.globalAlpha = 1.0;
                        targetCtx.beginPath();
                        targetCtx.arc(canvasCoords.x, canvasCoords.y, brushRadius, 0, Math.PI * 2);
                        targetCtx.fill();
                    }
                }
                
                // 마스크에 회색 원 추가 (60%만 지워지게)
                // SVG 마스크에서 회색 = 부분적으로 보임
                // 60% 지워지려면 40% 보여야 하므로, 마스크 값은 0.4 * 255 = 102 (회색)
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', x);
                circle.setAttribute('cy', y);
                circle.setAttribute('r', brushRadius);
                circle.setAttribute('fill', 'rgb(102, 102, 102)'); // 40% 보임 = 60% 지워짐
                mask.appendChild(circle);
                
                
                // 지워진 비율 확인
                const erasedRatio = getErasedRatio();
                if (erasedRatio >= 0.6 && !fadeOutAnimation) {
                    startFadeOut();
                }
            }
            
            lastX = x;
            lastY = y;
        }
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    
    // 드래그 종료
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            lastX = null;
            lastY = null;
            // 커서 다시 표시
            document.body.style.cursor = '';
        }
    });
    
    // 터치 이벤트 지원
    brushContainer.addEventListener('touchstart', (e) => {
        isDragging = true;
        lastX = null;
        lastY = null;
        
        const touch = e.touches[0];
        const brushRect = brushContainer.getBoundingClientRect();
        brushOffsetX = touch.clientX - (brushRect.left + brushRect.width / 2);
        brushOffsetY = touch.clientY - (brushRect.top + brushRect.height / 2);
        
        e.preventDefault();
    });
    
    const handleTouchMove = (e) => {
        if (!isDragging) return;
        const touch = e.touches[0];
        
        // 브러쉬 위치 업데이트
        const brushX = touch.clientX - brushOffsetX;
        const brushY = touch.clientY - brushOffsetY;
        brushContainer.style.left = `${brushX}px`;
        brushContainer.style.top = `${brushY}px`;
        brushContainer.style.right = 'auto';
        brushContainer.style.bottom = 'auto';
        
        // 브러쉬 SVG 내의 붓 끝 부분 위치 계산
        const brushRect = brushContainer.getBoundingClientRect();
        
        // 브러쉬 컨테이너 내에서 붓 끝의 실제 위치
        const brushTipX = brushRect.left + brushRect.width * brushTipRatioX;
        const brushTipY = brushRect.top + brushRect.height * brushTipRatioY;
        
        const svgContainerRect = svgContainer.getBoundingClientRect();
        
        // 붓 끝이 SVG 컨테이너 영역 안에 있는지 확인
        if (brushTipX >= svgContainerRect.left && brushTipX <= svgContainerRect.right &&
            brushTipY >= svgContainerRect.top && brushTipY <= svgContainerRect.bottom) {
            
            // 붓 끝을 SVG 좌표로 변환
            const x = brushTipX - svgContainerRect.left;
            const y = brushTipY - svgContainerRect.top;
            
            if (lastX !== null && lastY !== null) {
                // 이전 위치와 현재 위치 사이의 거리 계산
                const dx = x - lastX;
                const dy = y - lastY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance > 0) {
                    // 두 점 사이에 여러 개의 원을 배치하여 스윽 이어지게
                    const steps = Math.ceil(distance / (brushRadius * 0.5)); // 원이 겹치도록 밀도 있게 배치
                    const stepX = dx / steps;
                    const stepY = dy / steps;
                    
                    for (let i = 0; i <= steps; i++) {
                        const circleX = lastX + stepX * i;
                        const circleY = lastY + stepY * i;
                        
                        // Canvas 좌표로 변환
                        const canvasCoords = toCanvasCoords(circleX, circleY);
                        
                        // 해당 이미지의 Canvas에 그리기
                        if (canvasCoords.canvasIndex >= 0 && canvasCoords.canvasIndex < eraseCanvases.length) {
                            const targetCanvas = eraseCanvases[canvasCoords.canvasIndex];
                            const targetCtx = eraseCtxs[canvasCoords.canvasIndex];
                            
                            // Canvas 영역 내에 있는지 확인
                            if (canvasCoords.x >= -brushRadius && canvasCoords.x < targetCanvas.width + brushRadius &&
                                canvasCoords.y >= -brushRadius && canvasCoords.y < targetCanvas.height + brushRadius) {
                                // 해당 Canvas에 지워진 영역 기록 (완전히 투명하게)
                                targetCtx.globalCompositeOperation = 'destination-out';
                                targetCtx.globalAlpha = 1.0;
                                targetCtx.beginPath();
                                targetCtx.arc(canvasCoords.x, canvasCoords.y, brushRadius, 0, Math.PI * 2);
                                targetCtx.fill();
                            }
                        }
                        
                        // 마스크에 검은색 원 추가 (fill-opacity로 60%만 지워지게)
                        // fill-opacity 0.6 = 60% 지워짐 (40% 보임)
                        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                        circle.setAttribute('cx', circleX);
                        circle.setAttribute('cy', circleY);
                        circle.setAttribute('r', brushRadius);
                        circle.setAttribute('fill', 'black'); // 검은색 = 지워짐
                        circle.setAttribute('fill-opacity', '0.6'); // 60%만 지워짐
                        mask.appendChild(circle);
                    }
                    
                    // 지워진 비율 확인
                    const erasedRatio = getErasedRatio();
                    if (erasedRatio >= 0.6 && !fadeOutAnimation) {
                        startFadeOut();
                    }
                }
            } else {
                // 첫 번째 점일 때는 원 하나만 추가
                // Canvas 좌표로 변환
                const canvasCoords = toCanvasCoords(x, y);
                
                // 해당 이미지의 Canvas에 그리기
                if (canvasCoords.canvasIndex >= 0 && canvasCoords.canvasIndex < eraseCanvases.length) {
                    const targetCanvas = eraseCanvases[canvasCoords.canvasIndex];
                    const targetCtx = eraseCtxs[canvasCoords.canvasIndex];
                    
                    // Canvas 영역 내에 있는지 확인
                    if (canvasCoords.x >= -brushRadius && canvasCoords.x < targetCanvas.width + brushRadius &&
                        canvasCoords.y >= -brushRadius && canvasCoords.y < targetCanvas.height + brushRadius) {
                        // 해당 Canvas에 지워진 영역 기록 (완전히 투명하게)
                        targetCtx.globalCompositeOperation = 'destination-out';
                        targetCtx.globalAlpha = 1.0;
                        targetCtx.beginPath();
                        targetCtx.arc(canvasCoords.x, canvasCoords.y, brushRadius, 0, Math.PI * 2);
                        targetCtx.fill();
                    }
                }
                
                // 마스크에 회색 원 추가 (60%만 지워지게)
                // SVG 마스크에서 회색 = 부분적으로 보임
                // 60% 지워지려면 40% 보여야 하므로, 마스크 값은 0.4 * 255 = 102 (회색)
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', x);
                circle.setAttribute('cy', y);
                circle.setAttribute('r', brushRadius);
                circle.setAttribute('fill', 'rgb(102, 102, 102)'); // 40% 보임 = 60% 지워짐
                mask.appendChild(circle);
                
                
                // 지워진 비율 확인
                const erasedRatio = getErasedRatio();
                if (erasedRatio >= 0.6 && !fadeOutAnimation) {
                    startFadeOut();
                }
            }
            
            lastX = x;
            lastY = y;
        }
    };
    
    document.addEventListener('touchmove', handleTouchMove);
    
    document.addEventListener('touchend', () => {
        if (isDragging) {
            isDragging = false;
        }
    });
    
    // 윈도우 리사이즈 시 마스크 SVG 크기 업데이트
    window.addEventListener('resize', () => {
        updateMaskSvgSize();
    });
}

function turnPage() {
    // 우→좌 3D 페이지 넘김 효과
    const bookContent = document.querySelector('.book-content');
    if (!bookContent) return;
    
    const currentPageLayer = bookContent.querySelector('.page-layer.current');
    const nextPageLayer = bookContent.querySelector('.page-layer.next');
    
    if (!currentPageLayer) return;
    
    // 페이지 넘김 사운드 재생
    if (pageTurnAudio) {
        pageTurnAudio.pause();
        pageTurnAudio.currentTime = 0;
    }
    pageTurnAudio = new Audio('audio/page-turn.mp3');
    pageTurnAudio.volume = 0.5;
    pageTurnAudio.play().catch(error => {
        console.error('페이지 넘김 사운드 재생 실패:', error);
    });
    
    // 페이지 넘김 시작 시 스크롤 다시 활성화
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    
    // 페이지 넘김 중 플래그 설정
    isPageTurning = true;
    
    // 페이지 넘김 인디케이터 제거
    const pageTurnIndicator = currentPageLayer.querySelector('.page-turn-indicator');
    if (pageTurnIndicator) {
        pageTurnIndicator.remove();
    }
    
    // Brush-Drawing.svg 제거
    const brushDrawing = currentPageLayer.querySelector('.brush-drawing');
    if (brushDrawing) {
        brushDrawing.remove();
    }
    
    // 다음 페이지가 없으면 미리 준비 (항상 확인)
    if (currentSectionIndex + 1 < sections.length) {
        // 기존 .next 페이지가 있으면 제거하고 새로 로드
        if (nextPageLayer) {
            nextPageLayer.remove();
        }
        loadSection(currentSectionIndex + 1, true); // 다음 페이지 미리 로드
    }
    
    // 현재 페이지를 좌측으로 넘김 (내용은 그대로 유지)
    currentPageLayer.style.transition = 'transform 1.5s ease-in-out';
    currentPageLayer.style.transform = 'translateX(-100%) rotateY(-15deg)';
    currentPageLayer.style.transformOrigin = 'left center';
    
    setTimeout(() => {
        // 다음 섹션으로 이동
        currentSectionIndex++;
        if (currentSectionIndex < sections.length) {
            // 다음 페이지 레이어를 현재로 변경
            const newCurrentLayer = bookContent.querySelector('.page-layer.next');
            if (newCurrentLayer) {
                newCurrentLayer.className = 'page-layer current';
                newCurrentLayer.style.transform = 'translateX(0)';
                newCurrentLayer.style.opacity = '1';
            } else {
                // 다음 페이지 레이어가 없으면 새로 로드
                loadSection(currentSectionIndex);
                return;
            }
            
            // 이전 페이지 레이어는 애니메이션 완료 후 제거 (내용은 그대로 유지)
            setTimeout(() => {
                if (currentPageLayer && currentPageLayer.parentNode) {
                    currentPageLayer.remove();
                }
            }, 100);
            
            // 페이지 넘김 완료 플래그 해제
            isPageTurning = false;
            
            // 스크롤 다시 활성화
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
            
            // 이미 로드된 다음 페이지에서 SVG 경로 수집 및 초기화
            // loadSection을 다시 호출하지 않고 기존 내용 사용
            setTimeout(() => {
                const finalCurrentLayer = bookContent.querySelector('.page-layer.current');
                if (finalCurrentLayer) {
                    // 상태 초기화
                    sectionState = SectionState.SVG;
                    svgPaths = [];
                    totalPathLength = 0;
                    const section = sections[currentSectionIndex];
                    typingText = section.text || '';
                    typingIndex = 0;
                    typingComplete = false;
                    pageTurnTriggered = false;
                    brushDrawingShown = false;
                    
                    // 이전 페이지의 타이핑 사운드 정지
                    if (pencilWritingAudio) {
                        pencilWritingAudio.pause();
                        pencilWritingAudio.currentTime = 0;
                        pencilWritingAudio = null;
                    }
                    
                    // 이전 페이지의 드로잉 사운드 정지
                    if (drawingAudio) {
                        drawingAudio.pause();
                        drawingAudio.currentTime = 0;
                        drawingAudio = null;
                    }
                    lastSvgProgress = 0;
                    
                    // 이전 페이지의 모든 SVG를 명확하게 숨김 (혹시 남아있을 수 있는 경우 대비)
                    const allPreviousSvgs = document.querySelectorAll('.page-layer svg');
                    allPreviousSvgs.forEach(svg => {
                        const paths = svg.querySelectorAll('path');
                        paths.forEach(path => {
                            const length = path.getTotalLength();
                            if (length > 0) {
                                path.style.transition = 'none';
                                path.style.strokeDasharray = `${length}`;
                                path.style.strokeDashoffset = `${length}`;
                            }
                        });
                    });
                    
                    // 현재 페이지의 SVG 경로 수집 및 초기화
                    const svgs = finalCurrentLayer.querySelectorAll('svg');
                    if (svgs.length > 0) {
                        svgs.forEach(svg => {
                            const paths = Array.from(svg.querySelectorAll('path'));
                            paths.forEach((path) => {
                                // 먼저 transition 제거하여 즉시 적용되도록
                                path.style.transition = 'none';
                                
                                const length = path.getTotalLength();
                                if (length > 0) {
                                    totalPathLength += length;
                                    // 즉시 숨김 상태로 초기화 (이미 그려진 상태 방지)
                                    path.style.strokeDasharray = `${length}`;
                                    path.style.strokeDashoffset = `${length}`;
                                    svgPaths.push(path);
                                }
                            });
                        });
                        
                        // 강제로 다시 한 번 숨김 상태 확인 및 설정 (이전 SVG 잔존 방지)
                        requestAnimationFrame(() => {
                            // 모든 페이지의 SVG를 다시 한 번 확인하여 숨김
                            document.querySelectorAll('.page-layer svg path').forEach(path => {
                                const length = path.getTotalLength();
                                if (length > 0 && !svgPaths.includes(path)) {
                                    // 현재 페이지의 path가 아니면 숨김
                                    path.style.transition = 'none';
                                    path.style.strokeDasharray = `${length}`;
                                    path.style.strokeDashoffset = `${length}`;
                                }
                            });
                            
                            // 현재 페이지의 path들도 다시 한 번 확인
                            svgPaths.forEach((path) => {
                                const length = path.getTotalLength();
                                if (length > 0) {
                                    path.style.transition = 'none';
                                    path.style.strokeDasharray = `${length}`;
                                    path.style.strokeDashoffset = `${length}`;
                                }
                            });
                            
                            // 그 다음 transition 설정
                            requestAnimationFrame(() => {
                                svgPaths.forEach((path) => {
                                    path.style.transition = 'stroke-dashoffset 0.1s linear';
                                });
                            });
                        });
                    } else {
                        // SVG가 없는 경우
                        svgPaths = [];
                        totalPathLength = 0;
                    }
                    
                    // 애니메이션 시작
                    startSectionAnimation();
                    
                    // 새로운 다음 페이지 준비 (기존 .next 제거 후 새로 로드)
                    if (currentSectionIndex + 1 < sections.length) {
                        setTimeout(() => {
                            const existingNext = bookContent.querySelector('.page-layer.next');
                            if (existingNext) {
                                existingNext.remove();
                            }
                            loadSection(currentSectionIndex + 1, true);
                        }, 200);
                    }
                }
            }, 100);
        } else {
            // 모든 섹션 완료 - 책 닫기 로직 (추후 구현)
            isPageTurning = false;
            // 스크롤 다시 활성화
            document.body.style.overflow = '';
            // TODO: 책 닫기 애니메이션
        }
    }, 1500);
}

// 스크롤 이벤트로 페이지 넘김 감지 제거 - 클릭만 가능
// 페이지 넘김은 showPageTurnIndicator()의 클릭 이벤트로만 처리됨

// 섹션 데이터 로드 완료 후 초기화
let sectionsLoaded = false;
window.addEventListener('sectionsLoaded', () => {
    sectionsLoaded = true;
    // 스크롤 높이 업데이트 (섹션이 로드된 후)
    updateScrollHeight();
});

// .book-content 활성화 이벤트 리스닝
window.addEventListener('bookContentActivated', () => {
    if (sectionsLoaded && sections.length > 0) {
        initContourDrawing();
    } else {
        // 섹션이 아직 로드되지 않았으면 기다림
        window.addEventListener('sectionsLoaded', () => {
            if (sections.length > 0) {
                initContourDrawing();
            }
        }, { once: true });
    }
});

// 윈도우 리사이즈 시 스크롤 높이 재계산
window.addEventListener('resize', updateScrollHeight);
