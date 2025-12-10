// 오디오 토글 기능
document.addEventListener('DOMContentLoaded', function() {
    const audioToggle = document.getElementById('audio-toggle');
    const audioIcon = document.getElementById('audio-icon');
    let isAudioEnabled = false;
    
    // 전역 변수로 오디오 활성화 상태 관리
    window.isAudioEnabled = false;

    // book.js에서 backgroundAudio 가져오기
    const backgroundAudio = window.backgroundAudio;
    backgroundAudio.loop = true;
    backgroundAudio.volume = 0.2;
    
    // window 객체에 할당하여 다른 스크립트에서도 접근 가능하게
    window.isBackgroundAudioPlaying = false;

    // 오디오 토글 클릭 이벤트
    audioToggle.addEventListener('click', function() {
        if (!isAudioEnabled) {
            // 사운드 활성화
            isAudioEnabled = true;
            window.isAudioEnabled = true;
            
            // 아이콘 페이드 아웃 후 변경
            audioIcon.style.opacity = '0';
            setTimeout(() => {
                audioIcon.src = 'svg/sounding.svg';
                audioIcon.classList.add('sounding');
                audioIcon.style.opacity = '1';
            }, 200);
            
            // 배경 음악 재생 (페이드 인)
            // 백그라운드 음악 비활성화
            /*
            if (backgroundAudio.paused) {
                backgroundAudio.volume = 0;
                backgroundAudio.play().catch(error => {
                    console.error('배경 음악 재생 실패:', error);
                });
                window.isBackgroundAudioPlaying = true;
                
                // 페이드 인
                if (window.fadeInBackgroundAudio) {
                    window.fadeInBackgroundAudio();
                } else {
                    // fadeInBackgroundAudio 함수가 없으면 직접 페이드 인
                    fadeInBackgroundAudio();
                }
            }
            */
        } else {
            // 사운드 비활성화
            isAudioEnabled = false;
            window.isAudioEnabled = false;
            
            // 모든 사운드 정지
            if (window.backgroundAudio && !window.backgroundAudio.paused) {
                if (window.fadeOutBackgroundAudio) {
                    window.fadeOutBackgroundAudio();
                } else {
                    fadeOutBackgroundAudio();
                }
            }
            
            // 다른 오디오들도 정지
            if (window.bookFlipAudio) {
                window.bookFlipAudio.pause();
                window.bookFlipAudio.currentTime = 0;
            }
            
            // contour.js의 모든 오디오 정지
            if (window.stopAllContourAudio) {
                window.stopAllContourAudio();
            }
            
            // 아이콘 페이드 아웃 후 변경
            audioIcon.style.opacity = '0';
            setTimeout(() => {
                audioIcon.src = 'svg/sound.svg';
                audioIcon.classList.remove('sounding');
                audioIcon.style.opacity = '1';
            }, 200);
        }
    });

    // 페이드 인 함수 (book.js와 동일한 로직)
    function fadeInBackgroundAudio() {
        if (window.backgroundAudioFadeInterval) {
            clearInterval(window.backgroundAudioFadeInterval);
        }
        
        const targetVolume = 0.3; // 백그라운드 볼륨 설정 (0 = 무음, 1 = 최대)
        // targetVolume이 0이면 페이드 인 없이 바로 볼륨 0으로 설정하고 종료
        if (targetVolume === 0) {
            backgroundAudio.volume = 0;
            return;
        }
        
        const fadeDuration = 1000;
        const steps = 50;
        const stepDuration = fadeDuration / steps;
        const volumeStep = targetVolume / steps;
        
        let currentStep = 0;
        window.backgroundAudioFadeInterval = setInterval(() => {
            currentStep++;
            const newVolume = Math.min(targetVolume, volumeStep * currentStep);
            backgroundAudio.volume = newVolume;
            
            if (currentStep >= steps) {
                clearInterval(window.backgroundAudioFadeInterval);
                window.backgroundAudioFadeInterval = null;
                backgroundAudio.volume = targetVolume;
            }
        }, stepDuration);
    }

    // 페이드 아웃 함수 (book.js와 동일한 로직)
    function fadeOutBackgroundAudio() {
        if (window.backgroundAudioFadeInterval) {
            clearInterval(window.backgroundAudioFadeInterval);
        }
        
        const startVolume = backgroundAudio.volume;
        const fadeDuration = 2000;
        const steps = 50;
        const stepDuration = fadeDuration / steps;
        const volumeStep = startVolume / steps;
        
        let currentStep = 0;
        window.backgroundAudioFadeInterval = setInterval(() => {
            currentStep++;
            const newVolume = Math.max(0, startVolume - (volumeStep * currentStep));
            backgroundAudio.volume = newVolume;
            
            if (currentStep >= steps) {
                clearInterval(window.backgroundAudioFadeInterval);
                window.backgroundAudioFadeInterval = null;
                backgroundAudio.volume = 0;
                backgroundAudio.pause();
                backgroundAudio.currentTime = 0;
                window.isBackgroundAudioPlaying = false;
            }
        }, stepDuration);
    }

    // pencil-writing 오디오 페이드 아웃 함수 (0.5초 동안 소리 점점 작아지면서 중지)
    function fadeOutPencilWritingAudio(audio) {
        if (!audio || audio.paused) return;
        
        const startVolume = audio.volume;
        const fadeDuration = 500; // 0.5초
        const steps = 25; // 25단계로 나눔
        const stepDuration = fadeDuration / steps;
        const volumeStep = startVolume / steps;
        
        let currentStep = 0;
        const fadeInterval = setInterval(() => {
            currentStep++;
            const newVolume = Math.max(0, startVolume - (volumeStep * currentStep));
            audio.volume = newVolume;
            
            if (currentStep >= steps) {
                clearInterval(fadeInterval);
                audio.volume = 0;
                audio.pause();
                audio.currentTime = 0;
            }
        }, stepDuration);
        
        return fadeInterval; // 필요시 취소할 수 있도록 반환
    }

    // contour.js 오디오 생성 함수들
    function createDrawingAudio(volume = 1) {
        const audio = new Audio('audio/drawing.mp3');
        audio.loop = true;
        audio.volume = volume;
        return audio;
    }

    function createPencilWritingAudio(volume = 0.7) {
        const audio = new Audio('audio/pencil-writing.mp3');
        audio.loop = true;
        audio.volume = volume;
        return audio;
    }

    function createPageTurnAudio(volume = 1) {
        const audio = new Audio('audio/page-turn.mp3');
        audio.volume = volume;
        return audio;
    }

    // contour.js 오디오 정지 함수
    function stopAllContourAudio(pencilWritingAudio, pageTurnAudio, drawingAudio) {
        if (pencilWritingAudio && window.fadeOutPencilWritingAudio) {
            window.fadeOutPencilWritingAudio(pencilWritingAudio);
        } else if (pencilWritingAudio) {
            pencilWritingAudio.pause();
            pencilWritingAudio.currentTime = 0;
        }
        if (pageTurnAudio) {
            pageTurnAudio.pause();
            pageTurnAudio.currentTime = 0;
        }
        if (drawingAudio) {
            drawingAudio.pause();
            drawingAudio.currentTime = 0;
        }
    }

    // 전역 함수로 할당
    window.fadeInBackgroundAudio = fadeInBackgroundAudio;
    window.fadeOutBackgroundAudio = fadeOutBackgroundAudio;
    window.fadeOutPencilWritingAudio = fadeOutPencilWritingAudio;
    window.createDrawingAudio = createDrawingAudio;
    window.createPencilWritingAudio = createPencilWritingAudio;
    window.createPageTurnAudio = createPageTurnAudio;
    window.stopAllContourAudio = stopAllContourAudio;
});

