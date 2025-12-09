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
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
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
        const materials = [sideMat, insideMat, sideMat, sideMat, insideMat, backCoverMat];
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

// 책 애니메이션 고정 높이 (vh 단위)
const BOOK_ANIMATION_HEIGHT = 600; // 600vh - 감도 빠르게

// 페이지 넘김 사운드 관리
let bookFlipAudio = null;
let lastFlipPhaseRatio = 0;

function updateBookAnimation() {
    // 책 애니메이션은 고정된 높이에서만 진행
    const bookAnimationHeight = window.innerHeight * (BOOK_ANIMATION_HEIGHT / 100);
    const scrollRatio = Math.min(window.scrollY / bookAnimationHeight, 1.0);
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
            
            // opacity가 1이 되었을 때 컨투어 드로잉 초기화 이벤트 발생
            if (currentOpacity >= 1 && previousOpacity < 1) {
                window.dispatchEvent(new CustomEvent('bookContentActivated'));
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
        if (bookFlipAudio) {
            bookFlipAudio.pause();
            bookFlipAudio.currentTime = 0;
            bookFlipAudio = null;
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
        
        // 페이지 넘김 사운드 재생 (루프)
        if (phaseRatio > 0 && phaseRatio < 1) {
            if (!bookFlipAudio) {
                bookFlipAudio = new Audio('audio/page-filp.mp3');
                bookFlipAudio.loop = true;
                bookFlipAudio.volume = 0.5;
                bookFlipAudio.play().catch(error => {
                    console.error('책 넘김 사운드 재생 실패:', error);
                });
            }
        } else {
            // 구간 종료 시 사운드 정지
            if (bookFlipAudio) {
                bookFlipAudio.pause();
                bookFlipAudio.currentTime = 0;
                bookFlipAudio = null;
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

    } else {
        // [PHASE 4] 책 페이드 아웃 + .book-content 페이드 인
        const phaseRatio = (scrollRatio - PHASE_ZOOM_END) / (1 - PHASE_ZOOM_END);
        const easedFadeRatio = phaseRatio * phaseRatio * (3 - 2 * phaseRatio); // Smoothstep easing
        
        // 페이지 상태 유지
        pages.forEach((pageGroup, i) => {
            if (i < middleIndex) {
                pageGroup.rotation.y = -Math.PI;
                pageGroup.position.z = -1 * (middleIndex - 1 - i) * pageThickness;
            } else {
                pageGroup.rotation.y = 0;
                pageGroup.position.z = -1 * (i - middleIndex) * pageThickness;
            }
        });
        
        // 책 페이드 아웃
        book.traverse((child) => {
            if (child.isMesh && child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => {
                        mat.opacity = lerp(1, 0, easedFadeRatio);
                        mat.transparent = true;
                    });
                } else {
                    child.material.opacity = lerp(1, 0, easedFadeRatio);
                    child.material.transparent = true;
                }
            }
        });
        
        // 카메라는 최종 줌인 상태 유지
        camera.position.x = 0;
        camera.position.y = 0;
        camera.position.z = 1.5;
        lookAtTarget.set(0, 0, 0);
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