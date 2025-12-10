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
        const materials = [insideMat, insideMat, insideMat, insideMat, frontCoverMat, insideMat];
        pageMesh = new THREE.Mesh(geometry, materials);
        pageMesh.position.z = coverThickness / 2; 
    } 
    // 2. 뒷표지
    else if (i === totalItems - 1) {
        const geometry = new THREE.BoxGeometry(pageWidth, pageHeight, coverThickness);
        const materials = [insideMat, insideMat, insideMat, insideMat, pageTexture, backCoverMat];
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
const backgroundAudio = new Audio('audio/background02.mp3');
backgroundAudio.loop = true;
backgroundAudio.volume = 0; // 초기 볼륨 0 (페이드 인을 위해)

// 전역 접근을 위해 window 객체에 할당
window.backgroundAudio = backgroundAudio;


function updateBookAnimation() {
    // 마지막 페이지 스크롤 시작점을 가져옴 (contour.js에서 설정)
    const lastPageScrollStart = window.lastPageScrollStart || 0;
    
    // 마지막 페이지에 도달했고, 현재 스크롤 위치가 시작점 이후일 때를 감지
    const isLastPageScroll = window.lastPageReached && window.scrollY >= lastPageScrollStart;

    let scrollRatio;
    let bookAnimationHeight;

    if (isLastPageScroll) {
        // [클로징 시퀀스]
        // 줌인 상태(PHASE_ZOOM_END)에서 시작해서 줌아웃(PHASE_ZOOM_OUT_END) 후 닫히기(PHASE_CLOSE_END)까지
        const closingScrollRange = window.innerHeight * ( (PHASE_CLOSE_END - PHASE_ZOOM_END) * (BOOK_ANIMATION_HEIGHT / 100) );
        const progress = (window.scrollY - lastPageScrollStart) / closingScrollRange;
        // progress가 0일 때 PHASE_ZOOM_END (줌인 완료 상태), progress가 1일 때 PHASE_CLOSE_END (닫히기 완료)
        scrollRatio = PHASE_ZOOM_END + progress * (PHASE_CLOSE_END - PHASE_ZOOM_END);
        // 마지막 페이지 스크롤 시작 시 최소값을 PHASE_ZOOM_END로 고정 (줌인 완료 상태에서 시작)
        scrollRatio = Math.max(PHASE_ZOOM_END, scrollRatio);
    } else {
        // [오프닝 시퀀스]
        bookAnimationHeight = window.innerHeight * (BOOK_ANIMATION_HEIGHT / 100);
        scrollRatio = Math.min(window.scrollY / bookAnimationHeight, 1.0);
    }
    
    const lerp = (start, end, ratio) => start * (1 - ratio) + end * ratio;

    if(descText) descText.style.opacity = (1 - scrollRatio * 5);
    
    const scrollGuide = document.getElementById('scroll-guide');
    if(scrollGuide) scrollGuide.style.opacity = Math.max(0, 1 - scrollRatio * 5);
    
    const audioToggle = document.getElementById('audio-toggle');
    if(audioToggle) audioToggle.style.opacity = Math.max(0, 1 - scrollRatio * 5);
    
    const bookContent = document.querySelector('.book-content');
    
    // 페이지 넘김 중일 때는 opacity 조절하지 않음 (깜빡임 방지)
    if (window.isPageTurning) {
        if(bookContent) {
            bookContent.style.opacity = '1'; // 페이지 넘김 중에는 항상 보이게
        }
        // 페이지 넘김 중에는 container opacity도 변경하지 않음 (현재 상태 유지)
        // 책 애니메이션은 계속 진행
    } else {
        // 페이지 넘김이 아닐 때만 opacity 조절
        if (scrollRatio > PHASE_ZOOM_END && !isLastPageScroll) {
            // [PHASE 4 이후] 책 페이드아웃 + .book-content 페이드인
            const fadeRatio = (scrollRatio - PHASE_ZOOM_END) / (1 - PHASE_ZOOM_END);
            const currentOpacity = Math.min(1, fadeRatio);
            
            // .book-content 페이드인
            if(bookContent) {
                const previousOpacity = parseFloat(bookContent.dataset.previousOpacity || '0');
                bookContent.style.opacity = currentOpacity;
                bookContent.dataset.previousOpacity = currentOpacity;
                
                if (currentOpacity >= 1 && previousOpacity < 1) {
                    window.dispatchEvent(new CustomEvent('bookContentActivated'));
                }
            }
            
            // 책(3D) 페이드아웃
            const bookOpacity = 1 - currentOpacity;
            container.style.opacity = bookOpacity;
            container.style.transition = 'opacity 0.5s ease-out';
            
        } else if (!isLastPageScroll) {
            // [PHASE 4 이전] 책 보임, .book-content 숨김
            if(bookContent) {
                bookContent.style.opacity = 0;
                bookContent.dataset.previousOpacity = '0';
            }
            container.style.opacity = '1';
        }
    }

    const middleIndex = Math.floor(pages.length / 2);

    if (scrollRatio <= PHASE_ORIENT_END) {
        // [PHASE 1] 책 세우기
        if (isBookFlipAudioPlaying) {
            bookFlipAudio.pause();
            bookFlipAudio.currentTime = 0;
            isBookFlipAudioPlaying = false;
        }
        const phaseRatio = scrollRatio / PHASE_ORIENT_END;
        const easedRatio = phaseRatio < 0.5 ? 4 * phaseRatio * phaseRatio * phaseRatio : 1 - Math.pow(-2 * phaseRatio + 2, 3) / 2;

        pages.forEach((p, i) => { p.rotation.y = 0; p.position.z = -i * pageThickness; });

        book.rotation.y = lerp(Math.PI / 6, 0, easedRatio);
        book.rotation.x = lerp(0, 0, easedRatio);
        book.position.x = lerp(-0.8, -1.3, easedRatio);
        book.position.y = lerp(0, 0, easedRatio);
        book.position.z = lerp(0, 0, easedRatio);

        camera.position.x = lerp(0, 0, easedRatio);
        camera.position.y = lerp(0, 0, easedRatio);
        camera.position.z = lerp(5.0, 4.0, easedRatio);
        
        lookAtTarget.set(0, 0, 0);

    } else if (scrollRatio <= PHASE_FLIP_END) {
        // [PHASE 2] 책 펼치기
        const phaseRatio = (scrollRatio - PHASE_ORIENT_END) / (PHASE_FLIP_END - PHASE_ORIENT_END);
        const easedPhaseRatio = phaseRatio * phaseRatio * (3 - 2 * phaseRatio);
        
        if (!isBookFlipAudioPlaying && window.isAudioEnabled) {
            bookFlipAudio.play().catch(e => console.error('Audio play failed:', e));
            isBookFlipAudioPlaying = true;
        }

        book.rotation.y = 0;
        book.rotation.x = 0;
        book.position.x = lerp(-1.3, 0, easedPhaseRatio);

        pages.forEach((pageGroup, i) => {
            const originZ = -i * pageThickness;
            if (i < middleIndex) {
                const pagePhaseRatio = Math.min(1, Math.max(0, phaseRatio * 1.5 - (i * 0.04)));
                pageGroup.rotation.y = lerp(0, -Math.PI, pagePhaseRatio);
                pageGroup.position.z = lerp(originZ, -1 * (middleIndex - 1 - i) * pageThickness, pagePhaseRatio);
            } else {
                pageGroup.rotation.y = 0;
                pageGroup.position.z = lerp(originZ, -1 * (i - middleIndex) * pageThickness, phaseRatio);
            }
        });

        camera.position.z = 4;
        lookAtTarget.set(0, 0, 0);

    } else if (scrollRatio <= PHASE_ZOOM_END && !isLastPageScroll) {
        // [PHASE 3] 줌인 (마지막 페이지 스크롤이 아닐 때만)
        const phaseRatio = (scrollRatio - PHASE_FLIP_END) / (PHASE_ZOOM_END - PHASE_FLIP_END);
        const easedZoomRatio = phaseRatio * phaseRatio * (3 - 2 * phaseRatio);
        
        if (isBookFlipAudioPlaying) {
            bookFlipAudio.pause();
            bookFlipAudio.currentTime = 0;
            isBookFlipAudioPlaying = false;
        }
        
        pages.forEach((pageGroup, i) => {
            if (i < middleIndex) {
                pageGroup.rotation.y = -Math.PI;
                pageGroup.position.z = -1 * (middleIndex - 1 - i) * pageThickness;
            } else {
                pageGroup.rotation.y = 0;
                pageGroup.position.z = -1 * (i - middleIndex) * pageThickness;
            }
        });
        
        camera.position.z = lerp(4.0, 1.5, easedZoomRatio);
        lookAtTarget.set(0, 0, 0);

    } else if (scrollRatio <= PHASE_ZOOM_OUT_END) {
        // [PHASE 4] 줌아웃만 (페이지는 펼쳐진 상태 유지)
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
        
        // 마지막 페이지 스크롤: .book-content 페이드아웃 + 책 페이드인
        if (isLastPageScroll) {
            // 마지막 페이지 스크롤 시작 시 즉시 줌인 상태로 설정
            if (scrollRatio <= PHASE_ZOOM_END + 0.001 || phaseRatio <= 0) {
                camera.position.z = 1.5; // 즉시 줌인 상태
                container.style.opacity = 1; // 즉시 보이게
                // 책 위치와 각도도 즉시 초기화
                book.position.x = 0;
                book.position.y = 0;
                book.position.z = 0;
                book.rotation.y = 0;
                book.rotation.x = 0;
            } else {
                const zoomOutFadeRatio = Math.min(1, Math.max(0, phaseRatio) * 2); // 줌아웃 진행에 따라 페이드
                if(bookContent) {
                    bookContent.style.opacity = 1 - zoomOutFadeRatio;
                }
                container.style.opacity = Math.max(0, zoomOutFadeRatio);
            }
            container.style.transition = 'opacity 0.5s ease-out';
        }
        
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
        
        // 마지막 페이지 스크롤: .book-content 페이드아웃 + 책 페이드인
        if (isLastPageScroll) {
            const closeFadeRatio = Math.min(1, phaseRatio * 1.5); // 닫히기 진행에 따라 페이드
            if(bookContent) {
                bookContent.style.opacity = 1 - closeFadeRatio;
            }
            container.style.opacity = closeFadeRatio;
            container.style.transition = 'opacity 0.5s ease-out';
        }
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