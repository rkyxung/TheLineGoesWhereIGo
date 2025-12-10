// JavaScript와 Three.js 코드가 시작되는 영역입니다.

// --- 1. Three.js 기본 3요소 설정 --- 
const container = document.getElementById('scene-container');
const scene = new THREE.Scene();
scene.background = null;

// 카메라 설정
const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
// 초기 카메라 위치: 중앙에서 정면으로
camera.position.set(0, 0, 5); 

// 렌더러 설정
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.shadowMap.enabled = true; 
renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
container.appendChild(renderer.domElement);

// --- 조명 설정 --- 
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7); 
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2); 
directionalLight.position.set(5, 10, 7.5);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 512;
directionalLight.shadow.mapSize.height = 512;
directionalLight.shadow.radius = 4; 
scene.add(directionalLight);

// --- 2. 3D 책 객체 생성 --- 
const book = new THREE.Group();
const pages = [];
const numPages = 30; 
const pageHeight = 4;
const pageWidth = 3;
const coverThickness = 0.05;
const pageThickness = 0.01; // 페이지 두께

// 텍스처 로드 (경로는 실제 환경에 맞게 확인해주세요)
const textureLoader = new THREE.TextureLoader();
const frontCoverTexture = textureLoader.load('img/book-front.png'); 
const backCoverTexture = textureLoader.load('img/book-back.png'); 
const sideTexture = textureLoader.load('img/book-side.png'); 
const coverInsideTexture = textureLoader.load('img/book-cover.png'); 
const pageTexture = textureLoader.load('img/paper_texture.png'); 
// 뒷면용 텍스처 (좌우 반전)
const pageTextureFlipped = textureLoader.load('img/paper_texture.png');
pageTextureFlipped.wrapS = THREE.RepeatWrapping;
pageTextureFlipped.repeat.x = -1; // 좌우 반전
pageTextureFlipped.offset.x = 1; // 오프셋 조정

// Material 정의
const frontCoverMat = new THREE.MeshBasicMaterial({ map: frontCoverTexture });
const backCoverMat = new THREE.MeshBasicMaterial({ map: backCoverTexture });
const insideMat = new THREE.MeshBasicMaterial({ map: coverInsideTexture });
const sideMat = new THREE.MeshBasicMaterial({ map: sideTexture });
const pageMatFront = new THREE.MeshBasicMaterial({ map: pageTexture, side: THREE.DoubleSide });
const pageMatBack = new THREE.MeshBasicMaterial({ map: pageTextureFlipped, side: THREE.DoubleSide });

// 책 생성 루프
const totalItems = numPages + 2; 

for (let i = 0; i < totalItems; i++) {
    const pageGroup = new THREE.Group();
    let pageMesh;
    
    // 1. 앞표지
    if (i === 0) {
        const geometry = new THREE.BoxGeometry(pageWidth, pageHeight, coverThickness);
        const materials = [insideMat, insideMat, sideMat, sideMat, frontCoverMat, insideMat];
        pageMesh = new THREE.Mesh(geometry, materials);
        pageMesh.position.z = coverThickness / 2; 
    } 
    // 2. 뒷표지
    else if (i === totalItems - 1) {
        const geometry = new THREE.BoxGeometry(pageWidth, pageHeight, coverThickness);
        const materials = [sideMat, pageTexture, sideMat, sideMat, pageTexture, backCoverMat];
        pageMesh = new THREE.Mesh(geometry, materials);
        pageMesh.position.z = coverThickness / 2; 
    } 
    // 3. 속지 (수정된 부분)
    else {
        // [수정] PlaneGeometry -> BoxGeometry로 변경하여 두께 생성 (빈틈 제거)
        const geometry = new THREE.BoxGeometry(pageWidth, pageHeight, pageThickness);
        
        // 앞면(Front): 원본 텍스처, 뒷면(Back): 좌우 반전 텍스처
        // 순서: Right, Left, Top, Bottom, Front, Back
        const materials = [
            pageMatBack, pageMatBack, pageMatBack, pageMatBack, pageMatBack, pageMatFront
        ];
        
        pageMesh = new THREE.Mesh(geometry, materials);
        pageMesh.position.z = 0; 
    }

    pageMesh.position.x = pageWidth / 2 - 0.02;
    pageGroup.add(pageMesh);
    pageGroup.position.z = -i * pageThickness;

    book.add(pageGroup);
    pages.push(pageGroup);
}

// 책등(Spine) 생성
const spineThickness = (totalItems - 1) * pageThickness + coverThickness; 
const spineGeometry = new THREE.BoxGeometry(coverThickness, pageHeight, spineThickness);

// 책등 재질 설정
const spineMaterials = [
    insideMat,    // Right (+x): 안쪽 (페이지와 닿는 면) -> paper-texture
    sideMat,    // Left (-x): 바깥쪽 (우리가 보는 책등) -> book-side
    sideMat,    // Top (+y): 바깥쪽 -> book-side
    sideMat,    // Bottom (-y): 바깥쪽 -> book-side
    insideMat,    // Front (+z): 바깥쪽 끝부분 -> book-side
    sideMat     // Back (-z): 바깥쪽 끝부분 -> book-side
];

const spine = new THREE.Mesh(spineGeometry, spineMaterials);
spine.position.x = 0;
spine.position.y = 0;
spine.position.z = -spineThickness / 2 + coverThickness; 
book.add(spine);

scene.add(book);

// 그림자 바닥
const floorGeometry = new THREE.PlaneGeometry(30, 30);
const floorMaterial = new THREE.ShadowMaterial({ opacity: 0.1 }); 
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2; 
floor.position.y = -pageHeight / 2 - 0.01; 
floor.receiveShadow = true; 
scene.add(floor);

book.traverse((child) => {
    if (child.isMesh) {
        child.castShadow = true; 
        child.receiveShadow = false; 
    }
});


// --- 3. 스크롤 애니메이션 로직 --- 
const descText = document.getElementById('description-text');
let lookAtTarget = new THREE.Vector3(0, 0, 0);

// 단계별 끝나는 지점 (비율)
const PHASE_ORIENT_END = 0.25; 
const PHASE_FLIP_END = 0.6;
const PHASE_ZOOM_END = 0.85; // 줌인 완료 지점
const PHASE_ZOOM_OUT_END = 1.1; // 줌아웃 완료 지점 (줌인과 같은 범위로)
const PHASE_CLOSE_END = 1.6; // 책 닫히기 완료 지점 (범위 확대)

// 책 펼쳐지는 오디오 타이밍 조절 (PHASE_FLIP_END 기준 통합 비율)
// 음수 = PHASE 2 (책 펼치기), 양수 = PHASE 3 (줌인)
// 예: -0.5 = PHASE 2의 중간, 0 = PHASE_FLIP_END, 0.7 = PHASE 3의 70%
const BOOK_FLIP_AUDIO_START_RATIO = -1; // 오디오 시작 시점 (PHASE 2에서 시작)
const BOOK_FLIP_AUDIO_END_RATIO = 0;    // 오디오 종료 시점 (PHASE 3의 70%에서 종료)
 

// 책 애니메이션 고정 높이 (vh 단위)
const BOOK_ANIMATION_HEIGHT = 600; // 600vh - 감도 빠르게

// 페이지 넘김 사운드 관리 (전역에서 한 번만 생성)
const bookFlipAudio = new Audio('audio/pages-filp.mp3');
bookFlipAudio.loop = true;
bookFlipAudio.volume = 0.5;
bookFlipAudio.playbackRate = 0.7; // 재생 속도 설정
let isBookFlipAudioPlaying = false; // 재생 상태 추적
let lastFlipPhaseRatio = 0;

// 배경 음악 관리 (전역에서 한 번만 생성)
const backgroundAudio = new Audio('audio/background.mp3');
backgroundAudio.loop = true;
backgroundAudio.volume = 0; // 초기 볼륨 0 (페이드 인을 위해)
let isBackgroundAudioPlaying = false; // 재생 상태 추적
let backgroundAudioFadeInterval = null; // 페이드 애니메이션 인터벌

// 전역 접근을 위해 window 객체에 할당
window.backgroundAudio = backgroundAudio;
window.isBackgroundAudioPlaying = isBackgroundAudioPlaying;

// 백그라운드 오디오 페이드 인 함수
function fadeInBackgroundAudio() {
    if (backgroundAudioFadeInterval) {
        clearInterval(backgroundAudioFadeInterval);
    }
    
    const targetVolume = 0.5;
    const fadeDuration = 1000; // 1초 동안 페이드 인
    const steps = 50; // 50단계로 나눔
    const stepDuration = fadeDuration / steps;
    const volumeStep = targetVolume / steps;
    
    let currentStep = 0;
    backgroundAudioFadeInterval = setInterval(() => {
        currentStep++;
        const newVolume = Math.min(targetVolume, volumeStep * currentStep);
        backgroundAudio.volume = newVolume;
        
        if (currentStep >= steps) {
            clearInterval(backgroundAudioFadeInterval);
            backgroundAudioFadeInterval = null;
            backgroundAudio.volume = targetVolume; // 정확히 0.5로 설정
        }
    }, stepDuration);
}

// 백그라운드 오디오 페이드 아웃 함수
function fadeOutBackgroundAudio() {
    if (backgroundAudioFadeInterval) {
        clearInterval(backgroundAudioFadeInterval);
    }
    
    const startVolume = backgroundAudio.volume;
    const fadeDuration = 2000; // 2초 동안 페이드 아웃
    const steps = 50; // 50단계로 나눔
    const stepDuration = fadeDuration / steps;
    const volumeStep = startVolume / steps;
    
    let currentStep = 0;
    backgroundAudioFadeInterval = setInterval(() => {
        currentStep++;
        const newVolume = Math.max(0, startVolume - (volumeStep * currentStep));
        backgroundAudio.volume = newVolume;
        
        if (currentStep >= steps) {
            clearInterval(backgroundAudioFadeInterval);
            backgroundAudioFadeInterval = null;
            backgroundAudio.volume = 0;
            backgroundAudio.pause();
            backgroundAudio.currentTime = 0;
        }
    }, stepDuration);
}

// 페이드 아웃 함수도 전역에 할당
window.fadeOutBackgroundAudio = fadeOutBackgroundAudio;

function updateBookAnimation() {
    let scrollRatio;
    let bookAnimationHeight = window.innerHeight * (BOOK_ANIMATION_HEIGHT / 100);
    // PHASE_CLOSE_END를 넘어가도 애니메이션이 완전히 끝나도록 제한하지 않음
    scrollRatio = window.scrollY / bookAnimationHeight;
    
    const lerp = (start, end, ratio) => start * (1 - ratio) + end * ratio;

    if(descText) descText.style.opacity = (1 - scrollRatio * 5);
    
    const scrollGuide = document.getElementById('scroll-guide');
    if(scrollGuide) {
        scrollGuide.style.opacity = Math.max(0, 1 - scrollRatio * 5);
    }
    
    // .book-content 페이드 인 제어
    const bookContent = document.querySelector('.book-content');
    if (scrollRatio > PHASE_ZOOM_END) {
        const fadeRatio = (scrollRatio - PHASE_ZOOM_END) / (1 - PHASE_ZOOM_END);
        const currentOpacity = Math.min(1, fadeRatio);
        if(bookContent) {
            const previousOpacity = parseFloat(bookContent.dataset.previousOpacity || '0');
            bookContent.style.opacity = currentOpacity;
            bookContent.dataset.previousOpacity = currentOpacity;
            
            // opacity가 1이 되었을 때 배경 음악 재생
            if (currentOpacity >= 1 && previousOpacity < 1) {
                // 배경 음악 재생 (루프) - 페이드 인
                if (!isBackgroundAudioPlaying) {
                    backgroundAudio.volume = 0; // 페이드 인을 위해 초기 볼륨 0으로 설정
                    backgroundAudio.play().catch(error => {
                        console.error('배경 음악 재생 실패:', error);
                    });
                    isBackgroundAudioPlaying = true;
                    window.isBackgroundAudioPlaying = true;
                    fadeInBackgroundAudio(); // 페이드 인 시작
                }
            }
        }
    } else {
        if(bookContent) {
            bookContent.style.opacity = 0;
            bookContent.dataset.previousOpacity = '0';
        }
    }

    const middleIndex = Math.floor(pages.length / 2);

    if (scrollRatio <= PHASE_ORIENT_END) {
        // [PHASE 1] 책 세우기
        // 이전 구간의 사운드 정리
        if (isBookFlipAudioPlaying) {
            bookFlipAudio.pause();
            bookFlipAudio.currentTime = 0;
            isBookFlipAudioPlaying = false;
            lastFlipPhaseRatio = 0;
        }
        const phaseRatio = scrollRatio / PHASE_ORIENT_END;
        const easedRatio = phaseRatio < 0.5 ? 4 * phaseRatio * phaseRatio * phaseRatio : 1 - Math.pow(-2 * phaseRatio + 2, 3) / 2;

        pages.forEach((p, i) => {
            p.rotation.y = 0;
            p.position.z = -i * pageThickness; 
        });

        // 초기 각도 및 카메라 이동
        const initialRotY = Math.PI / 6; 
        const initialRotX = 0; 

        book.rotation.y = lerp(initialRotY, 0, easedRatio);
        book.rotation.x = lerp(initialRotX, 0, easedRatio);
        
        // 책 위치
        const initialBookPos = { x: -0.8, y: 0, z: 0 };      
        const beforeFlipBookPos = { x: -1.3, y: 0, z: 0 };      
        
        book.position.x = lerp(initialBookPos.x, beforeFlipBookPos.x, easedRatio);
        book.position.y = lerp(initialBookPos.y, beforeFlipBookPos.y, easedRatio);
        book.position.z = lerp(initialBookPos.z, beforeFlipBookPos.z, easedRatio);

        // 카메라
        const initialCamPos = { x: 0, y: 0, z: 5.0 };        
        const beforeFlipCamPos = { x: 0, y: 0, z: 4.0 };     
        
        camera.position.x = lerp(initialCamPos.x, beforeFlipCamPos.x, easedRatio);
        camera.position.y = lerp(initialCamPos.y, beforeFlipCamPos.y, easedRatio);
        camera.position.z = lerp(initialCamPos.z, beforeFlipCamPos.z, easedRatio);
        
        lookAtTarget.set(0, 0, 0);

    } else if (scrollRatio <= PHASE_FLIP_END) {
        // [PHASE 2] 책 펼치기
        const phaseRatio = (scrollRatio - PHASE_ORIENT_END) / (PHASE_FLIP_END - PHASE_ORIENT_END);
        const easedPhaseRatio = phaseRatio * phaseRatio * (3 - 2 * phaseRatio);
        
        // PHASE 2와 PHASE 3을 통합한 비율 계산 (PHASE_FLIP_END 기준)
        // PHASE 2에서는 음수 값 (-1 ~ 0), PHASE 3에서는 양수 값 (0 ~ 1)
        const unifiedPhaseRatio = (scrollRatio - PHASE_FLIP_END) / (PHASE_ZOOM_END - PHASE_FLIP_END);
        
        // 페이지 넘김 사운드 재생 (PHASE 2와 PHASE 3 통합)
        if (unifiedPhaseRatio >= BOOK_FLIP_AUDIO_START_RATIO && unifiedPhaseRatio < BOOK_FLIP_AUDIO_END_RATIO) {
            if (!isBookFlipAudioPlaying) {
                bookFlipAudio.play().catch(error => {
                    console.error('책 넘김 사운드 재생 실패:', error);
                });
                isBookFlipAudioPlaying = true;
            }
        } else {
            // 사운드 정지
            if (isBookFlipAudioPlaying) {
                bookFlipAudio.pause();
                bookFlipAudio.currentTime = 0;
                isBookFlipAudioPlaying = false;
            }
        }
        
        lastFlipPhaseRatio = phaseRatio; 

        book.rotation.y = 0;
        book.rotation.x = 0;
        
        // 책 위치
        const beforeFlipBookPos = { x: -1.3, y: 0, z: 0 };   
        const flippedBookPos = { x: 0, y: 0, z: 0 };         
        
        book.position.x = lerp(beforeFlipBookPos.x, flippedBookPos.x, easedPhaseRatio);
        book.position.y = lerp(beforeFlipBookPos.y, flippedBookPos.y, easedPhaseRatio);
        book.position.z = lerp(beforeFlipBookPos.z, flippedBookPos.z, easedPhaseRatio);
        
        // 카메라
        const beforeFlipCamPos = { x: 0, y: 0, z: 4.0 };     
        const flippedCamPos = { x: 0, y: 0, z: 4.0 };        
        
        camera.position.x = lerp(beforeFlipCamPos.x, flippedCamPos.x, easedPhaseRatio);
        camera.position.y = lerp(beforeFlipCamPos.y, flippedCamPos.y, easedPhaseRatio);
        camera.position.z = lerp(beforeFlipCamPos.z, flippedCamPos.z, easedPhaseRatio);

        pages.forEach((pageGroup, i) => {
            const originZ = -i * pageThickness;
            if (i < middleIndex) {
                const pagePhaseRatio = Math.min(1, Math.max(0, phaseRatio * 1.5 - (i * 0.04)));
                pageGroup.rotation.y = lerp(0, -Math.PI, pagePhaseRatio);
                const leftStackZ = -1 * (middleIndex - 1 - i) * pageThickness;
                pageGroup.position.z = lerp(originZ, leftStackZ, pagePhaseRatio);
            } else {
                pageGroup.rotation.y = 0;
                const rightStackZ = -1 * (i - middleIndex) * pageThickness;
                pageGroup.position.z = lerp(originZ, rightStackZ, phaseRatio);
            }
        });

        camera.position.x = 0;
        camera.position.y = 0;
        camera.position.z = 4;
        lookAtTarget.set(0, 0, 0);

    } else if (scrollRatio <= PHASE_ZOOM_END) {
        // [PHASE 3] 상태 유지 + 줌인
        const phaseRatio = (scrollRatio - PHASE_FLIP_END) / (PHASE_ZOOM_END - PHASE_FLIP_END);
        const easedZoomRatio = phaseRatio * phaseRatio * (3 - 2 * phaseRatio);
        
        // PHASE 2와 PHASE 3을 통합한 비율 계산 (PHASE_FLIP_END 기준)
        // PHASE 2에서는 음수 값 (-1 ~ 0), PHASE 3에서는 양수 값 (0 ~ 1)
        const unifiedPhaseRatio = phaseRatio;
        
        // 페이지 넘김 사운드 재생 (PHASE 2와 PHASE 3 통합)
        if (unifiedPhaseRatio >= BOOK_FLIP_AUDIO_START_RATIO && unifiedPhaseRatio < BOOK_FLIP_AUDIO_END_RATIO) {
            if (!isBookFlipAudioPlaying) {
                bookFlipAudio.play().catch(error => {
                    console.error('책 넘김 사운드 재생 실패:', error);
                });
                isBookFlipAudioPlaying = true;
            }
        } else {
            // 사운드 정지
            if (isBookFlipAudioPlaying) {
                bookFlipAudio.pause();
                bookFlipAudio.currentTime = 0;
                isBookFlipAudioPlaying = false;
            }
        }
        lastFlipPhaseRatio = phaseRatio; 
        
        pages.forEach((pageGroup, i) => {
            if (i < middleIndex) {
                pageGroup.rotation.y = -Math.PI;
                pageGroup.position.z = -1 * (middleIndex - 1 - i) * pageThickness;
            } else {
                pageGroup.rotation.y = 0;
                pageGroup.position.z = -1 * (i - middleIndex) * pageThickness;
            }
        });
        
        // 카메라: 중앙 유지하면서 줌인 (4.0 -> 1.5)
        const startZoom = 4.0;
        const endZoom = 1.5;
        
        camera.position.x = 0;
        camera.position.y = 0;
        camera.position.z = lerp(startZoom, endZoom, easedZoomRatio);
        lookAtTarget.set(0, 0, 0);

        // 책은 보이게 유지
        book.traverse((child) => {
            if (child.isMesh && child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => {
                        mat.opacity = 1;
                        mat.transparent = true;
                    });
                } else {
                    child.material.opacity = 1;
                    child.material.transparent = true;
                }
            }
        });

    } else if (scrollRatio <= PHASE_ZOOM_OUT_END) {
        // [PHASE 4] 줌아웃만 (페이지는 펼쳐진 상태 유지)
        // 사운드 정지
        if (isBookFlipAudioPlaying) {
            bookFlipAudio.pause();
            bookFlipAudio.currentTime = 0;
            isBookFlipAudioPlaying = false;
        }
        
        const phaseRatio = (scrollRatio - PHASE_ZOOM_END) / (PHASE_ZOOM_OUT_END - PHASE_ZOOM_END);
        const easedRatio = phaseRatio * phaseRatio * (3 - 2 * phaseRatio); // Smoothstep easing
        
        // 페이지 상태 유지 (펼쳐진 상태)
        pages.forEach((pageGroup, i) => {
            if (i < middleIndex) {
                pageGroup.rotation.y = -Math.PI;
                pageGroup.position.z = -1 * (middleIndex - 1 - i) * pageThickness;
            } else {
                pageGroup.rotation.y = 0;
                pageGroup.position.z = -1 * (i - middleIndex) * pageThickness;
            }
        });
        
        // 책은 보이게 유지
        book.traverse((child) => {
            if (child.isMesh && child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => {
                        mat.opacity = 1;
                        mat.transparent = true;
                    });
                } else {
                    child.material.opacity = 1;
                    child.material.transparent = true;
                }
            }
        });
        
        // 카메라: 줌인 상태(1.5)에서 줌아웃(4.0)까지
        const startZoom = 1.5;
        const endZoom = 4.0;
        camera.position.x = 0;
        camera.position.y = 0;
        camera.position.z = lerp(startZoom, endZoom, easedRatio);
        lookAtTarget.set(0, 0, 0);
        
    } else {
        // [PHASE 5] 책 닫히기 (수정: 두께 보존 및 스태킹 연결)
        const phaseRatio = Math.min(1, (scrollRatio - PHASE_ZOOM_OUT_END) / (PHASE_CLOSE_END - PHASE_ZOOM_OUT_END));
        const easedRatio = Math.min(1, phaseRatio * phaseRatio * (3 - 2 * phaseRatio)); 
        
        const totalItems = numPages + 2; 
        
        // 왼쪽 페이지들이 쌓인 최종 높이 (오른쪽 페이지가 이 위로 올라가야 함)
        const leftStackHeight = middleIndex * pageThickness;

        pages.forEach((pageGroup, i) => {
            const isBackCover = (i === totalItems - 1);
            
            if (i < middleIndex) {
                // [왼쪽 페이지 수정]
                // 기존 * 0.1 제거 -> 원래 두께대로 차곡차곡 쌓이게 변경
                pageGroup.rotation.y = -Math.PI;
                const leftStackZ = -1 * (middleIndex - 1 - i) * pageThickness;
                const closedZ = i * pageThickness; // 압축 없이 정직하게 쌓음
                
                pageGroup.position.z = lerp(leftStackZ, closedZ, easedRatio);
            } else {
                // [오른쪽 페이지 수정]
                // 회전하면서 '왼쪽 페이지 더미' 위로 착륙해야 함
                
                // 1. 회전 각도
                const currentRotation = lerp(0, -Math.PI, easedRatio);
                pageGroup.rotation.y = currentRotation;

                // 2. 중심으로부터의 거리
                let distFromCenter = (i - middleIndex) * pageThickness;
                if (isBackCover) distFromCenter += coverThickness; 

                // 3. 베이스 높이 조정 (핵심)
                // 책이 닫힐수록 오른쪽 페이지들의 기준점(0)이 왼쪽 페이지 두께만큼 올라가야 함
                const currentBaseZ = lerp(0, leftStackHeight, easedRatio);
                
                // 4. 최종 위치 계산 (베이스 높이 + 회전 곡선)
                // Open(cos=1): 0 - dist = -dist (아래로 펼쳐짐)
                // Closed(cos=-1): leftStackHeight - (-dist) = height + dist (위로 쌓임)
                pageGroup.position.z = currentBaseZ - (distFromCenter * Math.cos(currentRotation));
            }
        });

        // 닫힌 책의 위치와 각도 조정 (기존과 동일하되 미세 조정 가능)
        const startBookPos = { x: book.position.x, y: book.position.y, z: book.position.z };
        const startBookRotY = book.rotation.y;
        const startBookRotX = book.rotation.x;
        const startCamPos = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
        const startLookAt = { x: lookAtTarget.x, y: lookAtTarget.y, z: lookAtTarget.z };
        
        const closedBookPos = { x: 1.1, y: 0, z: 0.5 };
        const closedBookRotY = 0; 
        const closedBookRotX = 0; 
        const closedCamPos = { x: -0.6, y: -0.1, z: 4.5 };
        const closedLookAt = { x: -pageWidth * 0.2, y: 0, z: 0 }; 
        
        book.position.x = lerp(startBookPos.x, closedBookPos.x, easedRatio);
        book.position.y = lerp(startBookPos.y, closedBookPos.y, easedRatio);
        book.position.z = lerp(startBookPos.z, closedBookPos.z, easedRatio);
        book.rotation.y = lerp(startBookRotY, closedBookRotY, easedRatio);
        book.rotation.x = lerp(startBookRotX, closedBookRotX, easedRatio);
        
        camera.position.x = lerp(startCamPos.x, closedCamPos.x, easedRatio);
        camera.position.y = lerp(startCamPos.y, closedCamPos.y, easedRatio);
        camera.position.z = lerp(startCamPos.z, closedCamPos.z, easedRatio);
        
        lookAtTarget.set(
            lerp(startLookAt.x, closedLookAt.x, easedRatio),
            lerp(startLookAt.y, closedLookAt.y, easedRatio),
            lerp(startLookAt.z, closedLookAt.z, easedRatio)
        );
    }
}

window.addEventListener('scroll', updateBookAnimation);

// --- 4. 렌더링 루프 ---
function animate() {
    requestAnimationFrame(animate);
    camera.lookAt(lookAtTarget);
    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
});


updateBookAnimation();
animate();

